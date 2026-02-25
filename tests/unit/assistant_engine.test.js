"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeProvider,
  fallbackPlanFromText,
  sanitizePlan,
} = require("../../server/assistant_engine");

test("normalizeProvider falls back to builtin for unknown kind", () => {
  const provider = normalizeProvider({ kind: "unknown-provider", base_url: "https://x", model: "m" }, {});
  assert.equal(provider.kind, "builtin");
  assert.equal(provider.configured, true);
});

test("fallbackPlanFromText returns deterministic command routes and respects maxCommands", () => {
  const plan = fallbackPlanFromText("create cube cloner redshift animate render", 3, null);
  assert.equal(plan.mode, "builtin");
  assert.equal(plan.commands.length, 3);
  assert.deepEqual(
    plan.commands.map((item) => item.route),
    [
      "/nova4d/scene/spawn-object",
      "/nova4d/mograph/cloner/create",
      "/nova4d/material/create-redshift",
    ]
  );
});

test("sanitizePlan keeps only known routes and clamps priority", () => {
  const routeMap = new Map([
    ["/nova4d/test/ping", { path: "/nova4d/test/ping" }],
  ]);
  const output = sanitizePlan({
    summary: "x",
    commands: [
      { route: "/invalid/route", payload: { a: 1 }, priority: 99 },
      { route: "/nova4d/test/ping", payload: { message: "ok" }, priority: 120 },
    ],
  }, routeMap, 10);

  assert.equal(output.commands.length, 1);
  assert.equal(output.commands[0].route, "/nova4d/test/ping");
  assert.equal(output.commands[0].priority, 100);
  assert.deepEqual(output.commands[0].payload, { message: "ok" });
});
