"use strict";

const path = require("path");

function createSceneSnapshotService({
  store,
  commandRouteByPath,
  validateQueuedPayload,
  summarizeSceneContext,
  parseInteger,
  parseBoolean,
  exportDir,
}) {
  function isTerminalStatus(status) {
    return ["succeeded", "failed", "canceled"].includes(String(status || ""));
  }

  function isSceneSnapshotCommand(command) {
    return Boolean(
      command &&
      command.action === "introspect-scene" &&
      command.status === "succeeded" &&
      command.result &&
      typeof command.result === "object"
    );
  }

  function latestSceneSnapshot(limit = 1000) {
    const recent = store.listRecent(limit);
    return recent.find((command) => isSceneSnapshotCommand(command)) || null;
  }

  function snapshotTimestampMs(snapshotCommand) {
    const stamp = snapshotCommand?.completed_at || snapshotCommand?.updated_at || snapshotCommand?.created_at;
    const ms = Date.parse(stamp || "");
    return Number.isFinite(ms) ? ms : 0;
  }

  function summarizeSnapshot(snapshotResult) {
    const summary = summarizeSceneContext(snapshotResult);
    if (!summary) {
      return null;
    }
    return {
      document_name: summary.document_name || "unknown",
      active_object: summary.active_object || null,
      fps: Number.isFinite(summary.fps) ? summary.fps : null,
      objects_total: summary.counts?.objects_total ?? summary.raw?.objects?.length ?? 0,
      materials_total: summary.counts?.materials_total ?? summary.raw?.materials?.length ?? 0,
    };
  }

  function queueSceneSnapshotCommand(payload = {}, requestedBy = "api:introspection") {
    const spec = commandRouteByPath.get("/nova4d/introspection/scene");
    if (!spec) {
      throw new Error("introspection route missing");
    }
    const normalizedPayload = Object.assign({}, payload || {});
    const validation = validateQueuedPayload(spec.path, normalizedPayload);
    if (!validation.ok) {
      const details = validation.errors.join("; ");
      throw new Error(`invalid introspection payload: ${details}`);
    }
    const command = store.enqueue({
      route: spec.path,
      category: spec.category,
      action: spec.action,
      payload: normalizedPayload,
      priority: 0,
      metadata: {
        requested_by: requestedBy,
        client_hint: "cinema4d-live",
      },
    });
    return command;
  }

  async function waitForCommandResult(commandId, timeoutMs = 8000, pollMs = 250) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const command = store.get(commandId);
      if (command && isTerminalStatus(command.status)) {
        return command;
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    return store.get(commandId) || null;
  }

  async function waitForCommandsResult(commandIds, timeoutMs = 30000, pollMs = 500) {
    const ids = Array.isArray(commandIds)
      ? commandIds.map((id) => String(id || "").trim()).filter(Boolean)
      : [];
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const commands = ids.map((id) => store.get(id)).filter(Boolean);
      if (commands.length === ids.length && commands.every((command) => isTerminalStatus(command.status))) {
        return commands;
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    return ids.map((id) => store.get(id)).filter(Boolean);
  }

  function visionScreenshotPath(template, iteration) {
    const fallback = path.join(exportDir, `nova4d-vision-iter-${iteration}-${Date.now()}.png`);
    const raw = String(template || "").trim();
    if (!raw) {
      return fallback;
    }
    const replaced = raw.includes("{{iteration}}")
      ? raw.replace(/\{\{iteration\}\}/g, String(iteration))
      : raw;
    return path.resolve(replaced);
  }

  async function resolveSceneSnapshot(options = {}) {
    const maxAgeMs = parseInteger(options.maxAgeMs, 30000, 1000, 3600000);
    const refresh = options.refresh === true;
    const requestedBy = options.requestedBy || "assistant:context";
    const timeoutMs = parseInteger(options.timeoutMs, 8000, 500, 30000);
    const payload = options.payload || {
      max_objects: 600,
      max_materials: 300,
      include_paths: true,
    };

    const cached = latestSceneSnapshot();
    const ageMs = cached ? Date.now() - snapshotTimestampMs(cached) : Number.POSITIVE_INFINITY;
    const freshEnough = Boolean(cached) && ageMs <= maxAgeMs;
    if (cached && freshEnough && !refresh) {
      return {
        source: "cache",
        command: cached,
        snapshot: cached.result,
        age_ms: ageMs,
        warning: null,
      };
    }

    if (!refresh && cached) {
      return {
        source: "stale-cache",
        command: cached,
        snapshot: cached.result,
        age_ms: ageMs,
        warning: "scene snapshot is stale",
      };
    }

    let queued;
    try {
      queued = queueSceneSnapshotCommand(payload, requestedBy);
    } catch (err) {
      return {
        source: cached ? "cache" : "none",
        command: cached,
        snapshot: cached ? cached.result : null,
        age_ms: cached ? ageMs : null,
        warning: err.message,
      };
    }

    const completed = await waitForCommandResult(queued.id, timeoutMs, 250);
    if (completed && completed.status === "succeeded" && completed.result) {
      return {
        source: "fresh",
        command: completed,
        snapshot: completed.result,
        age_ms: 0,
        warning: null,
      };
    }

    const fallback = latestSceneSnapshot();
    if (fallback) {
      return {
        source: "cache-after-timeout",
        command: fallback,
        snapshot: fallback.result,
        age_ms: Date.now() - snapshotTimestampMs(fallback),
        warning: completed
          ? `refresh command finished with status ${completed.status}`
          : "refresh command timed out",
      };
    }

    return {
      source: "none",
      command: completed || queued || null,
      snapshot: null,
      age_ms: null,
      warning: completed
        ? `refresh command finished with status ${completed.status}`
        : "refresh command timed out",
    };
  }

  function filterObjectRows(rows, req) {
    const q = String(req.query.q || "").trim().toLowerCase();
    const selectedFilter = req.query.selected;
    const typeIdFilter = req.query.type_id !== undefined ? parseInteger(req.query.type_id, 0, -2147483648, 2147483647) : null;
    const limit = parseInteger(req.query.limit, 200, 1, 5000);
    const offset = parseInteger(req.query.offset, 0, 0, 500000);

    let filtered = Array.isArray(rows) ? rows.slice() : [];
    if (q) {
      filtered = filtered.filter((row) => {
        const name = String(row.name || "").toLowerCase();
        const pathValue = String(row.path || "").toLowerCase();
        return name.includes(q) || pathValue.includes(q);
      });
    }
    if (selectedFilter !== undefined) {
      const wantSelected = parseBoolean(selectedFilter, true);
      filtered = filtered.filter((row) => Boolean(row.selected) === wantSelected);
    }
    if (typeIdFilter !== null) {
      filtered = filtered.filter((row) => Number(row.type_id) === Number(typeIdFilter));
    }
    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit);
    return { total, items, limit, offset };
  }

  function filterMaterialRows(rows, req) {
    const q = String(req.query.q || "").trim().toLowerCase();
    const limit = parseInteger(req.query.limit, 200, 1, 5000);
    const offset = parseInteger(req.query.offset, 0, 0, 500000);
    let filtered = Array.isArray(rows) ? rows.slice() : [];
    if (q) {
      filtered = filtered.filter((row) => String(row.name || "").toLowerCase().includes(q));
    }
    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit);
    return { total, items, limit, offset };
  }

  return {
    isTerminalStatus,
    latestSceneSnapshot,
    snapshotTimestampMs,
    summarizeSnapshot,
    waitForCommandResult,
    waitForCommandsResult,
    visionScreenshotPath,
    resolveSceneSnapshot,
    filterObjectRows,
    filterMaterialRows,
  };
}

module.exports = {
  createSceneSnapshotService,
};
