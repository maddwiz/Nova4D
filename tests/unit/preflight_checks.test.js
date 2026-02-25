"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createPreflightService } = require("../../server/preflight_checks");

function parseInteger(value, fallback, min, max) {
  const parsed = parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function isTerminalStatus(status) {
  return ["succeeded", "failed", "canceled"].includes(String(status || ""));
}

test("buildPreflightChecks includes worker probe status when enabled", async () => {
  const store = {
    listRecent() {
      return [
        {
          id: "recent-1",
          route: "/nova4d/test/ping",
          status: "succeeded",
          delivered_to: "mock-worker",
          updated_at: new Date().toISOString(),
        },
      ];
    },
    enqueue() {
      return { id: "probe-1" };
    },
    cancel() {},
  };

  const service = createPreflightService({
    fs,
    os,
    path,
    processEnv: process.env,
    processCwd: process.cwd(),
    store,
    commandRouteByPath: new Map([
      ["/nova4d/test/ping", { path: "/nova4d/test/ping", category: "test", action: "test-ping" }],
    ]),
    waitForCommandResult: async () => ({
      id: "probe-1",
      status: "succeeded",
      delivered_to: "mock-worker",
      completed_at: new Date().toISOString(),
    }),
    isTerminalStatus,
    parseInteger,
    c4dPath: process.execPath,
    importDir: fs.mkdtempSync(path.join(os.tmpdir(), "nova4d-import-test-")),
    exportDir: fs.mkdtempSync(path.join(os.tmpdir(), "nova4d-export-test-")),
  });

  const checks = await service.buildPreflightChecks({
    probeWorker: true,
    probeTimeoutMs: 1000,
  });

  const workerProbe = checks.find((check) => check.id === "worker_probe");
  assert.equal(Boolean(workerProbe), true);
  assert.equal(workerProbe.status, "pass");
});

test("summarizePreflight flags failure when required checks fail", () => {
  const service = createPreflightService({
    fs,
    os,
    path,
    processEnv: process.env,
    processCwd: process.cwd(),
    store: { listRecent() { return []; } },
    commandRouteByPath: new Map(),
    waitForCommandResult: async () => null,
    isTerminalStatus,
    parseInteger,
    c4dPath: "c4dpy",
    importDir: "/tmp",
    exportDir: "/tmp",
  });

  const preflight = service.summarizePreflight(
    [
      { id: "required-1", required: true, status: "fail" },
      { id: "optional-1", required: false, status: "warn" },
    ],
    false,
    8000
  );

  assert.equal(preflight.overall_status, "fail");
  assert.equal(preflight.ready_for_local_use, false);
  assert.equal(preflight.summary.fail, 1);
});
