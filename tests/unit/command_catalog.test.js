"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validatePayload,
  normalizeSafetyPolicy,
  filterCommandsBySafety,
  getRisk,
} = require("../../server/command_catalog");

test("validatePayload enforces any_of and at_least_one_of", () => {
  const invalid = validatePayload("/nova4d/scene/set-transform", { position: [0, 0, 0] });
  assert.equal(invalid.ok, false);
  assert.match(invalid.errors.join(" | "), /one of \[target_name, target_path\] is required/);

  const valid = validatePayload("/nova4d/scene/set-transform", {
    target_name: "Cube",
    position: [0, 0, 0],
  });
  assert.equal(valid.ok, true);
});

test("normalizeSafetyPolicy defaults and clamps mode", () => {
  const policy = normalizeSafetyPolicy({ mode: "invalid", allow_dangerous: true });
  assert.equal(policy.mode, "balanced");
  assert.equal(policy.allow_dangerous, true);
});

test("filterCommandsBySafety blocks dangerous in balanced mode", () => {
  const commands = [
    { route: "/nova4d/scene/spawn-object", payload: {} },
    { route: "/nova4d/scene/delete-object", payload: { target_name: "Cube" } },
  ];
  const result = filterCommandsBySafety(commands, getRisk, { mode: "balanced", allow_dangerous: false });
  assert.equal(result.allowed.length, 1);
  assert.equal(result.blocked.length, 1);
  assert.equal(result.blocked[0].route, "/nova4d/scene/delete-object");
});

test("filterCommandsBySafety strict mode blocks moderate and dangerous routes", () => {
  const commands = [
    { route: "/nova4d/scene/spawn-object", payload: {} },
    { route: "/nova4d/render/frame", payload: {} },
    { route: "/nova4d/system/new-scene", payload: {} },
  ];
  const result = filterCommandsBySafety(commands, getRisk, { mode: "strict", allow_dangerous: true });

  assert.equal(result.allowed.length, 1);
  assert.equal(result.allowed[0].route, "/nova4d/scene/spawn-object");
  assert.equal(result.blocked.length, 2);
  assert.deepEqual(
    result.blocked.map((row) => row.route).sort(),
    ["/nova4d/render/frame", "/nova4d/system/new-scene"].sort()
  );
});

test("filterCommandsBySafety unrestricted mode allows dangerous routes", () => {
  const commands = [
    { route: "/nova4d/scene/delete-object", payload: {} },
  ];
  const result = filterCommandsBySafety(commands, getRisk, { mode: "unrestricted", allow_dangerous: false });
  assert.equal(result.allowed.length, 1);
  assert.equal(result.blocked.length, 0);
});

test("validatePayload rejects non-object payloads", () => {
  const invalid = validatePayload("/nova4d/test/ping", ["bad"]);
  assert.equal(invalid.ok, false);
  assert.match(invalid.errors.join(" | "), /payload must be an object/);
});
