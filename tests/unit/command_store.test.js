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

test("dispatch requeues expired leases and increments attempts", async () => {
  const store = new CommandStore({ leaseMs: 5 });
  const command = store.enqueue({ route: "/nova4d/test/ping", category: "test", action: "test-ping", payload: {} });
  const firstDispatch = store.dispatch("client-a", 1);
  assert.equal(firstDispatch.length, 1);
  assert.equal(firstDispatch[0].id, command.id);
  assert.equal(firstDispatch[0].attempts, 1);

  await new Promise((resolve) => {
    setTimeout(resolve, 20);
  });

  const secondDispatch = store.dispatch("client-b", 1);
  assert.equal(secondDispatch.length, 1);
  assert.equal(secondDispatch[0].id, command.id);
  assert.equal(secondDispatch[0].attempts, 2);
  assert.equal(store.summary().counters.requeued_total, 1);
});

test("cancelPending cancels queued and dispatched commands", () => {
  const store = new CommandStore();
  const queued = store.enqueue({ route: "/nova4d/test/ping", category: "test", action: "queued", payload: {} });
  const dispatched = store.enqueue({ route: "/nova4d/test/ping", category: "test", action: "dispatched", payload: {} });
  store.dispatch("client-a", 1);

  const result = store.cancelPending();
  assert.equal(result.ok, true);
  assert.equal(result.canceled_count, 2);
  assert.equal(store.get(queued.id)?.status, "canceled");
  assert.equal(store.get(dispatched.id)?.status, "canceled");
  assert.equal(store.summary().pending_count, 0);
});

test("retryFailed can include canceled commands", () => {
  const store = new CommandStore();
  const failed = store.enqueue({ route: "/nova4d/test/ping", category: "test", action: "failed", payload: {} });
  const canceled = store.enqueue({ route: "/nova4d/test/ping", category: "test", action: "canceled", payload: {} });
  store.result({ command_id: failed.id, status: "error", ok: false, error: "boom" });
  store.cancel(canceled.id);

  const retryFailedOnly = store.retryFailed({ includeCanceled: false, limit: 10 });
  assert.equal(retryFailedOnly.requeued_count, 1);
  assert.deepEqual(retryFailedOnly.command_ids, [failed.id]);

  store.cancel(failed.id);
  const retryIncludingCanceled = store.retryFailed({ includeCanceled: true, limit: 10 });
  assert.equal(retryIncludingCanceled.requeued_count, 2);
  assert.deepEqual(
    retryIncludingCanceled.command_ids.sort(),
    [failed.id, canceled.id].sort()
  );
});

test("command store sqlite mode persists commands when node:sqlite is available", () => {
  let sqliteAvailable = true;
  try {
    require("node:sqlite");
  } catch (_err) {
    sqliteAvailable = false;
  }
  if (!sqliteAvailable) {
    return;
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nova4d-store-sqlite-test-"));
  const sqlitePath = path.join(dir, "command-store.sqlite");

  const storeA = new CommandStore({ persistDriver: "sqlite", sqlitePath, persistDebounceMs: 20 });
  const command = storeA.enqueue({ route: "/nova4d/test/ping", category: "test", action: "sqlite-ping", payload: { message: "sqlite" } });
  storeA.result({ command_id: command.id, status: "ok", ok: true, result: { message: "done" } });
  storeA.flush();

  const storeB = new CommandStore({ persistDriver: "sqlite", sqlitePath });
  const loaded = storeB.get(command.id);
  assert.ok(loaded);
  assert.equal(loaded.status, "succeeded");
  assert.deepEqual(loaded.result, { message: "done" });
  assert.equal(storeB.summary().persistence.driver, "sqlite");
});
