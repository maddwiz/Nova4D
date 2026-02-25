"use strict";

function createHeadlessJobsStore(options = {}) {
  const maxSize = Number.isFinite(options.maxSize) ? options.maxSize : 1000;
  const keepSize = Number.isFinite(options.keepSize) ? options.keepSize : 500;
  const headlessJobs = new Map();

  function createJobRecord(command, args, logPath) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    const now = new Date().toISOString();
    return {
      id,
      status: "running",
      command,
      args,
      log_path: logPath,
      created_at: now,
      updated_at: now,
      started_at: now,
      completed_at: null,
      exit_code: null,
      signal: null,
      pid: null,
      timeout_sec: null,
    };
  }

  function finalizeJob(job, status, exitCode, signal) {
    const now = new Date().toISOString();
    job.status = status;
    job.exit_code = exitCode;
    job.signal = signal || null;
    job.completed_at = now;
    job.updated_at = now;
  }

  function pruneJobs() {
    if (headlessJobs.size <= maxSize) {
      return 0;
    }
    const sorted = Array.from(headlessJobs.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const keep = new Set(sorted.slice(0, keepSize).map((job) => job.id));
    let removed = 0;
    for (const id of headlessJobs.keys()) {
      if (!keep.has(id)) {
        headlessJobs.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  return {
    headlessJobs,
    createJobRecord,
    finalizeJob,
    pruneJobs,
  };
}

module.exports = {
  createHeadlessJobsStore,
};
