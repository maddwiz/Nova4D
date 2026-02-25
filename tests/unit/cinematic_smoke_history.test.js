"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  sanitizeCinematicSmokeCommand,
  normalizeCinematicSmokeHistoryEntry,
} = require("../../server/ui/modules/cinematic_smoke");

test("sanitizeCinematicSmokeCommand requires id and normalizes status", () => {
  assert.equal(sanitizeCinematicSmokeCommand({ route: "/x" }), null);

  const command = sanitizeCinematicSmokeCommand({
    id: "cmd-1",
    route: "/nova4d/test/ping",
    action: "test",
    status: "SUCCEEDED",
    error: "",
  });
  assert.deepEqual(command, {
    id: "cmd-1",
    route: "/nova4d/test/ping",
    action: "test",
    status: "succeeded",
    error: "",
  });
});

test("normalizeCinematicSmokeHistoryEntry computes summary and defaults", () => {
  const entry = normalizeCinematicSmokeHistoryEntry({
    commands: [
      { id: "a", route: "/r/1", action: "one", status: "queued" },
      { id: "b", route: "/r/2", action: "two", status: "succeeded" },
      { id: "c", route: "/r/3", action: "three", status: "failed", error: "boom" },
      { route: "/ignored/no-id", status: "queued" },
    ],
    blocked_commands: [{ route: "/blocked", reason: "safety" }],
  });

  assert.ok(entry);
  assert.equal(entry.workflow_id, "cinematic_smoke");
  assert.equal(entry.workflow_name, "Cinematic Smoke");
  assert.equal(entry.status, "unknown");
  assert.deepEqual(entry.command_ids, ["a", "b", "c"]);
  assert.equal(entry.summary.total, 3);
  assert.equal(entry.summary.queued, 1);
  assert.equal(entry.summary.succeeded, 1);
  assert.equal(entry.summary.failed, 1);
  assert.equal(entry.summary.terminal, 2);
  assert.equal(entry.blocked_commands.length, 1);
});

test("normalizeCinematicSmokeHistoryEntry keeps explicit command_ids when provided", () => {
  const entry = normalizeCinematicSmokeHistoryEntry({
    command_ids: ["x", "x", "y", ""],
    commands: [{ id: "a", status: "succeeded" }],
  });
  assert.ok(entry);
  assert.deepEqual(entry.command_ids, ["x", "y"]);
});
