"use strict";

function registerIntrospectionSceneRoutes({
  app,
  requireApiKey,
  parseInteger,
  parseBoolean,
  resolveSceneSnapshot,
  latestSceneSnapshot,
  summarizeSnapshot,
  queueCommand,
  commandRouteByPath,
  filterObjectRows,
  filterMaterialRows,
}) {
  app.post("/nova4d/introspection/request", requireApiKey, (req, res) => {
    const spec = commandRouteByPath.get("/nova4d/introspection/scene");
    return queueCommand(req, res, spec);
  });

  app.get("/nova4d/introspection/latest", requireApiKey, (req, res) => {
    const limit = parseInteger(req.query.limit, 1000, 1, 5000);
    const found = latestSceneSnapshot(limit);
    if (!found) {
      return res.status(404).json({
        status: "error",
        error: "no successful introspection snapshot found",
      });
    }
    return res.json({
      status: "ok",
      source: "cache",
      command_id: found.id,
      captured_at: found.completed_at || found.updated_at,
      delivered_to: found.delivered_to,
      summary: summarizeSnapshot(found.result),
      result: found.result,
    });
  });

  app.get("/nova4d/scene/graph", requireApiKey, async (req, res) => {
    const refresh = parseBoolean(req.query.refresh, false);
    const maxAgeMs = parseInteger(req.query.max_age_ms, 30000, 1000, 3600000);
    const snapshot = await resolveSceneSnapshot({
      refresh,
      maxAgeMs,
      requestedBy: "api:scene-graph",
      timeoutMs: parseInteger(req.query.timeout_ms, 8000, 500, 30000),
      payload: {
        max_objects: parseInteger(req.query.max_objects, 1500, 1, 5000),
        max_materials: parseInteger(req.query.max_materials, 1000, 1, 3000),
        include_paths: true,
      },
    });

    if (!snapshot.snapshot) {
      return res.status(404).json({
        status: "error",
        error: "scene snapshot unavailable",
        source: snapshot.source,
        warning: snapshot.warning,
      });
    }

    return res.json({
      status: "ok",
      source: snapshot.source,
      warning: snapshot.warning,
      age_ms: snapshot.age_ms,
      summary: summarizeSnapshot(snapshot.snapshot),
      graph: snapshot.snapshot,
    });
  });

  app.get("/nova4d/scene/objects", requireApiKey, async (req, res) => {
    const refresh = parseBoolean(req.query.refresh, false);
    const snapshot = await resolveSceneSnapshot({
      refresh,
      maxAgeMs: parseInteger(req.query.max_age_ms, 30000, 1000, 3600000),
      requestedBy: "api:scene-objects",
      timeoutMs: parseInteger(req.query.timeout_ms, 8000, 500, 30000),
    });

    if (!snapshot.snapshot) {
      return res.status(404).json({
        status: "error",
        error: "scene snapshot unavailable",
        source: snapshot.source,
        warning: snapshot.warning,
      });
    }

    const objects = Array.isArray(snapshot.snapshot.objects) ? snapshot.snapshot.objects : [];
    const filtered = filterObjectRows(objects, req);
    return res.json({
      status: "ok",
      source: snapshot.source,
      warning: snapshot.warning,
      age_ms: snapshot.age_ms,
      summary: summarizeSnapshot(snapshot.snapshot),
      total: filtered.total,
      count: filtered.items.length,
      limit: filtered.limit,
      offset: filtered.offset,
      objects: filtered.items,
    });
  });

  app.get("/nova4d/scene/materials", requireApiKey, async (req, res) => {
    const refresh = parseBoolean(req.query.refresh, false);
    const snapshot = await resolveSceneSnapshot({
      refresh,
      maxAgeMs: parseInteger(req.query.max_age_ms, 30000, 1000, 3600000),
      requestedBy: "api:scene-materials",
      timeoutMs: parseInteger(req.query.timeout_ms, 8000, 500, 30000),
    });

    if (!snapshot.snapshot) {
      return res.status(404).json({
        status: "error",
        error: "scene snapshot unavailable",
        source: snapshot.source,
        warning: snapshot.warning,
      });
    }

    const materials = Array.isArray(snapshot.snapshot.materials) ? snapshot.snapshot.materials : [];
    const filtered = filterMaterialRows(materials, req);
    return res.json({
      status: "ok",
      source: snapshot.source,
      warning: snapshot.warning,
      age_ms: snapshot.age_ms,
      summary: summarizeSnapshot(snapshot.snapshot),
      total: filtered.total,
      count: filtered.items.length,
      limit: filtered.limit,
      offset: filtered.offset,
      materials: filtered.items,
    });
  });

  app.get("/nova4d/scene/object", requireApiKey, async (req, res) => {
    const name = String(req.query.name || "").trim();
    const pathQuery = String(req.query.path || "").trim();
    if (!name && !pathQuery) {
      return res.status(400).json({
        status: "error",
        error: "name or path query param is required",
      });
    }

    const refresh = parseBoolean(req.query.refresh, false);
    const snapshot = await resolveSceneSnapshot({
      refresh,
      maxAgeMs: parseInteger(req.query.max_age_ms, 30000, 1000, 3600000),
      requestedBy: "api:scene-object",
      timeoutMs: parseInteger(req.query.timeout_ms, 8000, 500, 30000),
    });
    if (!snapshot.snapshot) {
      return res.status(404).json({
        status: "error",
        error: "scene snapshot unavailable",
        source: snapshot.source,
        warning: snapshot.warning,
      });
    }

    const objects = Array.isArray(snapshot.snapshot.objects) ? snapshot.snapshot.objects : [];
    let found = null;
    if (pathQuery) {
      found = objects.find((row) => String(row.path || "") === pathQuery) || null;
    }
    if (!found && name) {
      found = objects.find((row) => String(row.name || "") === name) || null;
    }
    if (!found) {
      return res.status(404).json({
        status: "error",
        error: "object not found in latest scene snapshot",
        source: snapshot.source,
      });
    }

    const objectPath = String(found.path || "");
    const descendants = objectPath
      ? objects.filter((row) => {
        const candidate = String(row.path || "");
        return candidate.startsWith(`${objectPath}/`);
      })
      : [];

    return res.json({
      status: "ok",
      source: snapshot.source,
      warning: snapshot.warning,
      age_ms: snapshot.age_ms,
      summary: summarizeSnapshot(snapshot.snapshot),
      object: found,
      descendants,
    });
  });
}

module.exports = {
  registerIntrospectionSceneRoutes,
};
