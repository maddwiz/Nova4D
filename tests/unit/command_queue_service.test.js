"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createCommandQueueService } = require("../../server/command_queue_service");

function parseInteger(value, fallback, min, max) {
  const parsed = parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function createMockRes() {
  return {
    code: 200,
    body: null,
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return body;
    },
  };
}

test("queueCommand enqueues valid command and merges metadata", () => {
  const calls = [];
  const service = createCommandQueueService({
    store: {
      enqueue(input) {
        calls.push(input);
        return {
          id: "cmd-1",
          category: input.category,
          action: input.action,
          route: input.route,
          created_at: "2026-02-25T00:00:00.000Z",
        };
      },
    },
    validatePayload: () => ({ ok: true, errors: [] }),
    filterCommandsBySafety: () => ({ policy: {}, allowed: [], blocked: [] }),
    normalizeSafetyPolicy: () => ({}),
    getRisk: () => "safe",
    parseInteger,
  });

  const req = {
    body: {
      priority: "7",
      metadata: { source: "test" },
      payload_only: true,
      client_hint: "cinema4d-live",
    },
    get(header) {
      if (header === "X-Request-By") {
        return "unit-test";
      }
      return null;
    },
  };
  const res = createMockRes();
  const spec = { path: "/nova4d/test/ping", category: "test", action: "test-ping" };
  service.queueCommand(req, res, spec, { injected: "value" });

  assert.equal(res.code, 200);
  assert.equal(res.body.status, "queued");
  assert.equal(res.body.command_id, "cmd-1");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].priority, 7);
  assert.equal(calls[0].metadata.requested_by, "unit-test");
  assert.equal(calls[0].metadata.source, "test");
  assert.equal(calls[0].payload.injected, "value");
});

test("queueCommand returns 400 when payload validation fails", () => {
  const service = createCommandQueueService({
    store: { enqueue() { throw new Error("should not enqueue"); } },
    validatePayload: () => ({ ok: false, errors: ["bad field"] }),
    filterCommandsBySafety: () => ({ policy: {}, allowed: [], blocked: [] }),
    normalizeSafetyPolicy: () => ({}),
    getRisk: () => "safe",
    parseInteger,
  });

  const req = { body: {}, get() { return null; } };
  const res = createMockRes();
  const spec = { path: "/nova4d/test/ping", category: "test", action: "test-ping" };
  service.queueCommand(req, res, spec);
  assert.equal(res.code, 400);
  assert.equal(res.body.error, "payload validation failed");
});

test("applyCommandGuards combines safety blocks and validation rejects", () => {
  const service = createCommandQueueService({
    store: { enqueue() { throw new Error("unused"); } },
    validatePayload(route) {
      if (route === "/invalid") {
        return { ok: false, errors: ["invalid"] };
      }
      return { ok: true, errors: [] };
    },
    filterCommandsBySafety(commands) {
      return {
        policy: { mode: "balanced" },
        allowed: commands.filter((cmd) => cmd.route !== "/blocked"),
        blocked: commands
          .filter((cmd) => cmd.route === "/blocked")
          .map((cmd) => ({ route: cmd.route, reason: "safety" })),
      };
    },
    normalizeSafetyPolicy: () => ({ mode: "balanced" }),
    getRisk: () => "safe",
    parseInteger,
  });

  const result = service.applyCommandGuards([
    { route: "/ok", payload: {} },
    { route: "/blocked", payload: {} },
    { route: "/invalid", payload: {} },
  ], { mode: "balanced" });

  assert.equal(result.allowed.length, 1);
  assert.equal(result.allowed[0].route, "/ok");
  assert.equal(result.blocked.length, 2);
  assert.equal(result.blocked.some((item) => item.reason === "safety"), true);
  assert.equal(result.blocked.some((item) => item.reason === "payload validation failed"), true);
});
