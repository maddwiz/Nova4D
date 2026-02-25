"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const { registerUploadAndBatchRoutes } = require("../../server/routes/upload_batch_routes");

function createMockApp() {
  const getRoutes = new Map();
  const postRoutes = new Map();
  return {
    getRoutes,
    postRoutes,
    get(routePath, ...handlers) {
      getRoutes.set(routePath, handlers[handlers.length - 1]);
    },
    post(routePath, ...handlers) {
      postRoutes.set(routePath, handlers[handlers.length - 1]);
    },
  };
}

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return payload;
    },
  };
}

function parseInteger(value, fallback, min, max) {
  const parsed = parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function parseFloatSafe(value, fallback) {
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function registerRoutes(overrides = {}) {
  const app = createMockApp();
  const queued = [];
  const headlessJobs = new Map();
  const fsMock = {
    renameSync: overrides.renameSync || (() => {}),
    openSync: overrides.openSync || (() => 1),
    closeSync: overrides.closeSync || (() => {}),
  };
  const spawnMock = overrides.spawn || (() => {
    const listeners = new Map();
    const child = {
      pid: 4321,
      kill: () => {},
      on(event, handler) {
        listeners.set(event, handler);
        if (event === "close") {
          setImmediate(() => handler(0, null));
        }
        return child;
      },
    };
    return child;
  });
  const finalizeJob = overrides.finalizeJob || ((job, status, exitCode, signal) => {
    job.status = status;
    job.exit_code = exitCode;
    job.signal = signal || null;
    job.completed_at = new Date().toISOString();
    job.updated_at = job.completed_at;
  });

  registerUploadAndBatchRoutes({
    app,
    requireApiKey: (_req, _res, next) => next(),
    upload: { single: () => (_req, _res, next) => next() },
    queueCommand: overrides.queueCommand || ((req, res, spec, extraPayload) => {
      queued.push({ spec, extraPayload, reqBody: req.body || {} });
      return res.json({ status: "queued", route: spec.path, payload: extraPayload });
    }),
    parseInteger,
    parseFloatSafe,
    importDir: "/tmp/import",
    exportDir: "/tmp/export",
    blenderToC4DScale: 1.0,
    c4dPath: "c4dpy",
    headlessTimeoutSec: 1800,
    fs: fsMock,
    path,
    spawn: spawnMock,
    headlessJobs,
    createJobRecord: overrides.createJobRecord || (() => ({
      id: "job-1",
      status: "running",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })),
    finalizeJob,
  });

  return {
    app,
    queued,
    headlessJobs,
  };
}

test("io import upload requires multipart file or file_path", async () => {
  const { app } = registerRoutes();
  const handler = app.postRoutes.get("/nova4d/io/import/upload");
  const req = { body: {} };
  const res = createRes();
  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "Provide multipart file upload or file_path");
});

test("io import upload routes gltf to queueCommand with defaults", async () => {
  const { app, queued } = registerRoutes();
  const handler = app.postRoutes.get("/nova4d/io/import/upload");
  const req = { body: { format: "gltf", file_path: "/tmp/test.gltf" } };
  const res = createRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "queued");
  assert.equal(queued.length, 1);
  assert.equal(queued[0].spec.path, "/nova4d/io/import/gltf");
  assert.equal(queued[0].extraPayload.file_path, "/tmp/test.gltf");
  assert.equal(queued[0].extraPayload.scale_fix, "native");
});

test("batch render returns accepted job and stores it", async () => {
  const { app, headlessJobs } = registerRoutes();
  const handler = app.postRoutes.get("/nova4d/batch/render");
  const req = { body: { output_path: "/tmp/render-output", timeout_sec: 60, args: ["-nogui"] } };
  const res = createRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "accepted");
  assert.equal(res.body.job_id, "job-1");
  assert.equal(headlessJobs.has("job-1"), true);
});

test("batch job cancel returns 404 when job is missing", async () => {
  const { app } = registerRoutes();
  const handler = app.postRoutes.get("/nova4d/batch/jobs/:jobId/cancel");
  const req = { params: { jobId: "missing" } };
  const res = createRes();
  await handler(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, "job not found");
});
