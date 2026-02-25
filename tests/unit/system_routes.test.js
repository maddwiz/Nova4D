"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { registerSystemRoutes } = require("../../server/routes/system_routes");

function createMockApp() {
  const getRoutes = new Map();
  const postRoutes = new Map();
  return {
    getRoutes,
    postRoutes,
    get(routePath, ...handlers) {
      getRoutes.set(routePath, handlers[handlers.length - 1]);
    },
    post(routePath, ...handlers) {
      postRoutes.set(routePath, handlers[handlers.length - 1]);
    },
  };
}

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return payload;
    },
  };
}

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

function registerRoutes(overrides = {}) {
  const app = createMockApp();
  const queueCalls = [];

  registerSystemRoutes({
    app,
    requireApiKey: (_req, _res, next) => next(),
    parseInteger,
    parseBoolean,
    buildPreflightChecks: overrides.buildPreflightChecks || (async () => [{ id: "check-1", status: "pass", required: true }]),
    summarizePreflight: overrides.summarizePreflight || ((checks) => ({
      overall_status: "pass",
      ready_for_local_use: true,
      probe_worker: false,
      probe_timeout_ms: 8000,
      summary: { pass: checks.length, warn: 0, fail: 0 },
      checks,
    })),
    latestSceneSnapshot: overrides.latestSceneSnapshot || (() => null),
    snapshotTimestampMs: overrides.snapshotTimestampMs || (() => 0),
    recentWorkerCommand: overrides.recentWorkerCommand || (() => null),
    summarizeSnapshot: overrides.summarizeSnapshot || (() => null),
    minimalCapabilities: overrides.minimalCapabilities || (() => ({ categories: ["test"] })),
    normalizeSafetyPolicy: overrides.normalizeSafetyPolicy || ((input) => input || {}),
    queuePlannedCommands: overrides.queuePlannedCommands || ((args) => {
      queueCalls.push(args);
      return [{ id: "queued-1", route: "/nova4d/test/ping" }];
    }),
    commandRoutes: [{ path: "/nova4d/test/ping", category: "test", action: "test-ping" }],
    commandRouteByPath: new Map([["/nova4d/test/ping", { path: "/nova4d/test/ping", category: "test", action: "test-ping" }]]),
    routeCatalog: [{ path: "/nova4d/test/ping" }],
    workflowSpecs: [{ id: "simple", name: "Simple", description: "Simple workflow" }],
    workflowDefaults: () => ({ object_name: "Cube" }),
    buildWorkflowPlan: overrides.buildWorkflowPlan || ((workflowId) => ({
      ok: true,
      workflow: { id: workflowId, name: "Simple", description: "Simple workflow" },
      options: { object_name: "Cube" },
      guarded: {
        policy: { mode: "balanced" },
        allowed: [{ route: "/nova4d/test/ping", payload: {} }],
        blocked: [],
      },
    })),
    store: {
      summary: () => ({ pending_count: 0 }),
      listSseClients: () => [],
    },
    product: "Nova4D",
    service: "Cinema4DBridge",
    version: "1.0.1",
    importDir: "/tmp/import",
    exportDir: "/tmp/export",
    storeDriver: "json",
    effectiveStorePath: "/tmp/store.json",
    apiKey: "",
    c4dPath: "c4dpy",
  });

  return {
    app,
    queueCalls,
  };
}

test("health endpoint returns configured service metadata", async () => {
  const { app } = registerRoutes();
  const handler = app.getRoutes.get("/nova4d/health");
  const res = createRes();
  await handler({}, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "ok");
  assert.equal(res.body.product, "Nova4D");
  assert.equal(res.body.store_driver, "json");
  assert.equal(res.body.c4d_path, "c4dpy");
});

test("workflows preview requires workflow_id", async () => {
  const { app } = registerRoutes();
  const handler = app.postRoutes.get("/nova4d/workflows/preview");
  const req = { body: {} };
  const res = createRes();
  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "workflow_id is required");
});

test("workflows run queues guarded commands", async () => {
  const { app, queueCalls } = registerRoutes();
  const handler = app.postRoutes.get("/nova4d/workflows/run");
  const req = { body: { workflow_id: "simple", requested_by: "unit-test", client_hint: "worker-1" } };
  const res = createRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "ok");
  assert.equal(res.body.queued_count, 1);
  assert.equal(queueCalls.length, 1);
  assert.equal(queueCalls[0].requestedBy, "unit-test");
  assert.equal(queueCalls[0].clientHint, "worker-1");
});

test("system preflight returns summarized readiness", async () => {
  const { app } = registerRoutes({
    buildPreflightChecks: async () => [{ id: "required", required: true, status: "pass" }],
    summarizePreflight: () => ({
      overall_status: "pass",
      ready_for_local_use: true,
      probe_worker: true,
      probe_timeout_ms: 9000,
      summary: { pass: 1, warn: 0, fail: 0 },
      checks: [{ id: "required", required: true, status: "pass" }],
    }),
  });
  const handler = app.getRoutes.get("/nova4d/system/preflight");
  const req = { query: { probe_worker: "true", probe_timeout_ms: "9000" } };
  const res = createRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.overall_status, "pass");
  assert.equal(res.body.ready_for_local_use, true);
  assert.equal(res.body.probe_worker, true);
  assert.equal(res.body.probe_timeout_ms, 9000);
});
