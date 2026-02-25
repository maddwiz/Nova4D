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
