"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createRateLimitMiddleware, requestIdentity } = require("../../server/rate_limiter");

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test("rate limiter allows up to max and then returns 429", () => {
  let now = 1_000;
  const limiter = createRateLimitMiddleware({
    windowMs: 60_000,
    max: 30,
    now: () => now,
  });

  const req = {
    path: "/nova4d/command",
    ip: "127.0.0.1",
    query: {},
    get(name) {
      if (name === "X-API-Key") return "abc";
      if (name === "X-Forwarded-For") return "";
      return "";
    },
  };

  let nextCalls = 0;
  for (let i = 0; i < 30; i += 1) {
    limiter(req, makeRes(), () => { nextCalls += 1; });
  }
  assert.equal(nextCalls, 30);

  const blocked = makeRes();
  limiter(req, blocked, () => { throw new Error("should not call next"); });
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.payload?.error, "rate limit exceeded");
  assert.ok(blocked.headers["Retry-After"]);

  now += 61_000;
  limiter(req, makeRes(), () => { nextCalls += 1; });
  assert.equal(nextCalls, 31);
});

test("requestIdentity prefers forwarded IP and separates by API key", () => {
  const reqA = {
    ip: "127.0.0.1",
    query: {},
    get(name) {
      if (name === "X-Forwarded-For") return "10.0.0.2, 10.0.0.3";
      if (name === "X-API-Key") return "key-a";
      return "";
    },
  };
  const reqB = {
    ip: "127.0.0.1",
    query: { api_key: "key-b" },
    get(name) {
      if (name === "X-Forwarded-For") return "10.0.0.2, 10.0.0.3";
      if (name === "X-API-Key") return "";
      return "";
    },
  };

  assert.equal(requestIdentity(reqA), "10.0.0.2|key-a");
  assert.equal(requestIdentity(reqB), "10.0.0.2|key-b");
});

test("skipPaths bypasses counting and prune removes stale buckets", () => {
  let now = 10_000;
  const limiter = createRateLimitMiddleware({
    windowMs: 10_000,
    max: 30,
    now: () => now,
    skipPaths: ["/nova4d/health"],
  });
  const reqBase = {
    ip: "127.0.0.1",
    query: {},
    get(name) {
      if (name === "X-API-Key") return "abc";
      if (name === "X-Forwarded-For") return "";
      return "";
    },
  };

  let nextCalls = 0;
  limiter({ ...reqBase, path: "/nova4d/health" }, makeRes(), () => { nextCalls += 1; });
  limiter({ ...reqBase, path: "/nova4d/command" }, makeRes(), () => { nextCalls += 1; });
  assert.equal(nextCalls, 2);
  assert.equal(limiter.state.size, 1);

  now += 120_000;
  const removed = limiter.prune(5_000);
  assert.equal(removed, 1);
  assert.equal(limiter.state.size, 0);
});
