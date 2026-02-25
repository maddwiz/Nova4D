"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { CommandStore } = require("../../server/command_store");

test("command store persists commands to disk and restores after restart", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nova4d-store-test-"));
  const persistPath = path.join(dir, "command-store.json");

  const storeA = new CommandStore({ persistPath, persistDebounceMs: 20 });
  const command = storeA.enqueue({ route: "/nova4d/test/ping", category: "test", action: "test-ping", payload: { message: "hi" } });
  storeA.result({ command_id: command.id, status: "ok", ok: true, result: { message: "done" } });
  storeA.flush();

  const storeB = new CommandStore({ persistPath });
  const loaded = storeB.get(command.id);
  assert.ok(loaded);
  assert.equal(loaded.status, "succeeded");
  assert.deepEqual(loaded.result, { message: "done" });
});
