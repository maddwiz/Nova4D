"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeProvider,
  fallbackPlanFromText,
  sanitizePlan,
  planCommands,
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

test("sanitizePlan enforces maxCommands and defaults invalid payload to object", () => {
  const routeMap = new Map([
    ["/nova4d/test/ping", { path: "/nova4d/test/ping" }],
    ["/nova4d/scene/spawn-object", { path: "/nova4d/scene/spawn-object" }],
  ]);
  const output = sanitizePlan({
    summary: "",
    commands: [
      { route: "/nova4d/test/ping", payload: ["invalid"], priority: -900 },
      { route: "/nova4d/scene/spawn-object", payload: { name: "Cube" }, priority: 12 },
    ],
  }, routeMap, 1);

  assert.equal(output.summary, "AI-generated command plan");
  assert.equal(output.commands.length, 1);
  assert.deepEqual(output.commands[0], {
    route: "/nova4d/test/ping",
    payload: {},
    reason: "",
    priority: -100,
  });
});

test("fallbackPlanFromText prefers active scene object for animation target", () => {
  const sceneContext = {
    active_object: "HeroCube",
    objects: [
      { name: "HeroCube", path: "Root/HeroCube", type_id: 5159 },
    ],
    materials: [],
  };
  const plan = fallbackPlanFromText("animate and render", 10, sceneContext);
  const animation = plan.commands.filter((item) => item.route === "/nova4d/animation/set-key");

  assert.equal(animation.length, 2);
  assert.equal(animation[0].payload.target_name, "HeroCube");
  assert.equal(animation[1].payload.target_name, "HeroCube");
});

test("normalizeProvider clamps bounds and respects openai-compatible env defaults", () => {
  const provider = normalizeProvider(
    {
      kind: "openai-compatible",
      temperature: 42,
      max_tokens: 99999,
    },
    {
      NOVA4D_AI_BASE_URL: "http://127.0.0.1:9090",
      NOVA4D_AI_MODEL: "custom-model",
    }
  );

  assert.equal(provider.kind, "openai-compatible");
  assert.equal(provider.base_url, "http://127.0.0.1:9090");
  assert.equal(provider.model, "custom-model");
  assert.equal(provider.temperature, 1);
  assert.equal(provider.max_tokens, 4096);
});

test("planCommands falls back when provider response has no valid routes", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    text: async () => JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: "provider output",
              commands: [{ route: "/invalid/route", payload: { a: 1 } }],
            }),
          },
        },
      ],
    }),
  });

  try {
    const commandRoutes = [
      { path: "/nova4d/test/ping", category: "test", action: "test-ping" },
    ];
    const routeMap = new Map(commandRoutes.map((route) => [route.path, route]));
    const result = await planCommands({
      input: "hello",
      provider: {
        kind: "openai",
        base_url: "https://api.openai.com",
        model: "gpt-4o-mini",
        api_key: "",
        temperature: 0.2,
        max_tokens: 800,
      },
      commandRoutes,
      routeMap,
      maxCommands: 3,
    });

    assert.equal(result.mode, "openai-fallback");
    assert.equal(result.commands.length, 1);
    assert.equal(result.commands[0].route, "/nova4d/test/ping");
  } finally {
    global.fetch = originalFetch;
  }
});
