"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createSceneSnapshotService } = require("../../server/scene_snapshot_service");

function parseInteger(value, fallback, min, max) {
  const parsed = parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function buildService(overrides = {}) {
  const nowIso = new Date().toISOString();
  const store = overrides.store || {
    listRecent() {
      return [
        {
          id: "snap-1",
          action: "introspect-scene",
          status: "succeeded",
          result: {
            document_name: "Test",
            objects: [{ name: "Cube", path: "/Cube", selected: true, type_id: 1 }],
            materials: [{ name: "Mat" }],
          },
          updated_at: nowIso,
          completed_at: nowIso,
        },
      ];
    },
    get() {
      return null;
    },
    enqueue() {
      return { id: "queued-1" };
    },
  };
  const commandRouteByPath = overrides.commandRouteByPath || new Map([
    ["/nova4d/introspection/scene", { path: "/nova4d/introspection/scene", category: "introspection", action: "introspect-scene" }],
  ]);
  const summarizeSceneContext = overrides.summarizeSceneContext || (() => ({
    document_name: "Doc",
    active_object: "Cube",
    fps: 30,
    counts: { objects_total: 1, materials_total: 1 },
    raw: { objects: [{}], materials: [{}] },
  }));

  return createSceneSnapshotService({
    store,
    commandRouteByPath,
    validateQueuedPayload: () => ({ ok: true, errors: [] }),
    summarizeSceneContext,
    parseInteger,
    parseBoolean,
    exportDir: "/tmp",
  });
}

test("summarizeSnapshot returns normalized scene summary", () => {
  const service = buildService();
  const summary = service.summarizeSnapshot({ any: "value" });
  assert.equal(summary.document_name, "Doc");
  assert.equal(summary.active_object, "Cube");
  assert.equal(summary.fps, 30);
  assert.equal(summary.objects_total, 1);
  assert.equal(summary.materials_total, 1);
});

test("visionScreenshotPath applies iteration token", () => {
  const service = buildService();
  const out = service.visionScreenshotPath("/tmp/snap-{{iteration}}.png", 3);
  assert.equal(out.endsWith("/tmp/snap-3.png"), true);
});

test("resolveSceneSnapshot returns cache result when snapshot is fresh", async () => {
  const service = buildService();
  const result = await service.resolveSceneSnapshot({
    refresh: false,
    maxAgeMs: 60000,
  });
  assert.equal(result.source, "cache");
  assert.equal(Boolean(result.snapshot), true);
});

test("filterObjectRows respects query, selected filter, and pagination", () => {
  const service = buildService();
  const rows = [
    { name: "CubeA", path: "/CubeA", selected: true, type_id: 1001 },
    { name: "SphereA", path: "/SphereA", selected: false, type_id: 1002 },
  ];
  const filtered = service.filterObjectRows(rows, {
    query: {
      q: "cube",
      selected: "true",
      limit: "10",
      offset: "0",
    },
  });
  assert.equal(filtered.total, 1);
  assert.equal(filtered.items.length, 1);
  assert.equal(filtered.items[0].name, "CubeA");
});
