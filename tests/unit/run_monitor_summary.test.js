"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeCommandStatus,
  summarizeCommandStatuses,
} = require("../../server/ui/modules/run_monitor");

test("normalizeCommandStatus lowercases and defaults unknown", () => {
  assert.equal(normalizeCommandStatus("SUCCEEDED"), "succeeded");
  assert.equal(normalizeCommandStatus("  queued "), "queued");
  assert.equal(normalizeCommandStatus(""), "unknown");
  assert.equal(normalizeCommandStatus(null), "unknown");
});

test("summarizeCommandStatuses counts queue lifecycle buckets", () => {
  const summary = summarizeCommandStatuses([
    { status: "queued" },
    { status: "DISPATCHED" },
    { status: "succeeded" },
    { status: "failed" },
    { status: "canceled" },
    { status: "mystery" },
  ]);

  assert.equal(summary.total, 6);
  assert.equal(summary.queued, 1);
  assert.equal(summary.dispatched, 1);
  assert.equal(summary.succeeded, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.canceled, 1);
  assert.equal(summary.unknown, 1);
  assert.equal(summary.terminal, 3);
});
