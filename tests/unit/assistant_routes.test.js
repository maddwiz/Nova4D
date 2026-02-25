"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const { registerAssistantRoutes } = require("../../server/routes/assistant_routes");

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
  const applyCalls = [];
  const commandRouteByPath = new Map([
    ["/nova4d/test/ping", { path: "/nova4d/test/ping", category: "test", action: "test-ping" }],
  ]);

  registerAssistantRoutes({
    app,
    requireApiKey: (_req, _res, next) => next(),
    parseInteger,
    parseBoolean,
    path,
    exportDir: "/tmp",
    store: {},
    commandRoutes: [{ path: "/nova4d/test/ping", category: "test", action: "test-ping" }],
    commandRouteByPath,
    normalizeProvider: overrides.normalizeProvider || ((input) => Object.assign({ kind: "builtin", base_url: "", model: "" }, input || {})),
    normalizeSafetyPolicy: overrides.normalizeSafetyPolicy || ((input) => input || {}),
    queuePlannedCommands: overrides.queuePlannedCommands || ((args) => {
      queueCalls.push(args);
      return (args.commands || []).map((command, index) => ({ id: `queued-${index + 1}`, route: command.route }));
    }),
    planCommands: overrides.planCommands || (async () => ({ mode: "builtin", summary: "ok", commands: [] })),
    visionFeedbackPlan: overrides.visionFeedbackPlan || (async () => ({ commands: [] })),
    testProviderConnection: overrides.testProviderConnection || (async () => ({ ok: true })),
    toPublicProvider: overrides.toPublicProvider || ((provider) => ({
      kind: provider.kind,
      base_url: provider.base_url || "",
      model: provider.model || "",
      api_key_configured: false,
    })),
    applyCommandGuards: overrides.applyCommandGuards || ((commands, safety) => {
      applyCalls.push({ commands, safety });
      return { policy: safety || {}, allowed: commands, blocked: [] };
    }),
    resolveSceneSnapshot: overrides.resolveSceneSnapshot || (async () => ({
      source: "cache",
      warning: null,
      command: null,
      snapshot: null,
    })),
    summarizeSnapshot: overrides.summarizeSnapshot || (() => null),
    waitForCommandResult: overrides.waitForCommandResult || (async () => null),
    waitForCommandsResult: overrides.waitForCommandsResult || (async () => []),
    visionScreenshotPath: overrides.visionScreenshotPath || (() => "/tmp/snap.png"),
  });

  return {
    app,
    queueCalls,
    applyCalls,
  };
}

test("provider-test returns 400 when non-builtin provider lacks base_url/model", async () => {
  const { app } = registerRoutes({
    normalizeProvider: () => ({ kind: "openai", base_url: "", model: "" }),
  });
  const handler = app.postRoutes.get("/nova4d/assistant/provider-test");
  const req = { body: { provider: { kind: "openai" } } };
  const res = createRes();
  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "provider base_url and model are required");
});

test("assistant queue rejects empty commands array", async () => {
  const { app } = registerRoutes();
  const handler = app.postRoutes.get("/nova4d/assistant/queue");
  const req = { body: {} };
  const res = createRes();
  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "commands[] is required");
});

test("assistant queue sanitizes invalid routes and queues valid commands", async () => {
  const { app, queueCalls, applyCalls } = registerRoutes();
  const handler = app.postRoutes.get("/nova4d/assistant/queue");
  const req = {
    body: {
      requested_by: "unit-test",
      client_hint: "mock-client",
      safety: { mode: "balanced" },
      commands: [
        { route: "/invalid-route", payload: { x: 1 } },
        { route: "/nova4d/test/ping", payload: { message: "ok" }, priority: 8, reason: "valid" },
      ],
    },
  };
  const res = createRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "ok");
  assert.equal(res.body.queued_count, 1);
  assert.equal(queueCalls.length, 1);
  assert.equal(queueCalls[0].commands.length, 1);
  assert.equal(queueCalls[0].commands[0].route, "/nova4d/test/ping");
  assert.equal(applyCalls.length, 1);
  assert.equal(applyCalls[0].commands.length, 1);
});
