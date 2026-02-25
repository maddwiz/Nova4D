"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createHeadlessJobsStore } = require("../../server/headless_jobs_store");

test("createJobRecord initializes running job shape", () => {
  const jobs = createHeadlessJobsStore();
  const record = jobs.createJobRecord("c4dpy", ["scene.c4d"], "/tmp/job.log");
  assert.equal(record.status, "running");
  assert.equal(record.command, "c4dpy");
  assert.deepEqual(record.args, ["scene.c4d"]);
  assert.equal(record.log_path, "/tmp/job.log");
  assert.equal(Boolean(record.id), true);
});

test("finalizeJob updates terminal status and timestamps", () => {
  const jobs = createHeadlessJobsStore();
  const record = jobs.createJobRecord("c4dpy", [], "/tmp/job.log");
  jobs.finalizeJob(record, "failed", 2, "SIGTERM");
  assert.equal(record.status, "failed");
  assert.equal(record.exit_code, 2);
  assert.equal(record.signal, "SIGTERM");
  assert.equal(Boolean(record.completed_at), true);
});

test("pruneJobs removes oldest jobs when size limit is exceeded", () => {
  const jobs = createHeadlessJobsStore({ maxSize: 3, keepSize: 2 });
  jobs.headlessJobs.set("1", { id: "1", created_at: "2026-02-25T00:00:01.000Z" });
  jobs.headlessJobs.set("2", { id: "2", created_at: "2026-02-25T00:00:02.000Z" });
  jobs.headlessJobs.set("3", { id: "3", created_at: "2026-02-25T00:00:03.000Z" });
  jobs.headlessJobs.set("4", { id: "4", created_at: "2026-02-25T00:00:04.000Z" });

  const removed = jobs.pruneJobs();
  assert.equal(removed, 2);
  assert.equal(jobs.headlessJobs.size, 2);
  assert.equal(jobs.headlessJobs.has("4"), true);
  assert.equal(jobs.headlessJobs.has("3"), true);
});
