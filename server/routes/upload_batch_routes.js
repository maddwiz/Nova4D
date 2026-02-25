"use strict";

function registerUploadAndBatchRoutes({
  app,
  requireApiKey,
  upload,
  queueCommand,
  parseInteger,
  parseFloatSafe,
  importDir,
  exportDir,
  blenderToC4DScale,
  c4dPath,
  headlessTimeoutSec,
  fs,
  path,
  spawn,
  headlessJobs,
  createJobRecord,
  finalizeJob,
}) {
  function queueUploadedImport(req, res, spec, defaults = {}) {
    let localPath = req.body.file_path || null;
    let originalName = null;
    if (req.file && req.file.path) {
      const extension = path.extname(req.file.originalname || "").toLowerCase();
      const safeName = `${req.file.filename}${extension}`;
      const finalPath = path.join(importDir, safeName);
      fs.renameSync(req.file.path, finalPath);
      localPath = finalPath;
      originalName = req.file.originalname || null;
    }

    if (!localPath) {
      return res.status(400).json({ status: "error", error: "Provide multipart file upload or file_path" });
    }

    const scaleRaw = req.body.scale_factor !== undefined ? req.body.scale_factor : req.body.scale;
    const scaleFactor = parseFloatSafe(scaleRaw, defaults.scale_factor || 1.0);

    return queueCommand(req, res, spec, {
      file_path: localPath,
      original_name: originalName,
      scale_factor: scaleFactor,
      scale_fix: req.body.scale_fix || defaults.scale_fix || "none",
    });
  }

  app.post("/nova4d/io/import/upload", requireApiKey, upload.single("file"), (req, res) => {
    const format = String(req.body.format || "").toLowerCase();
    const routeByFormat = {
      gltf: { path: "/nova4d/io/import/gltf", category: "io", action: "import-gltf" },
      glb: { path: "/nova4d/io/import/gltf", category: "io", action: "import-gltf" },
      fbx: { path: "/nova4d/io/import/fbx", category: "io", action: "import-fbx" },
      obj: { path: "/nova4d/io/import/obj", category: "io", action: "import-obj" },
    };
    const spec = routeByFormat[format] || routeByFormat.gltf;
    return queueUploadedImport(req, res, spec, { scale_factor: 1.0, scale_fix: "native" });
  });

  app.post("/nova4d/blender/import/upload", requireApiKey, upload.single("file"), (req, res) => {
    const format = String(req.body.format || "gltf").toLowerCase();
    const spec = format === "fbx"
      ? { path: "/nova4d/blender/import-fbx", category: "blender", action: "import-blender-fbx" }
      : { path: "/nova4d/blender/import-gltf", category: "blender", action: "import-blender-gltf" };

    return queueUploadedImport(req, res, spec, {
      scale_fix: "blender_to_c4d",
      scale_factor: blenderToC4DScale,
    });
  });

  app.post("/nova4d/export/upload-result", requireApiKey, upload.single("file"), (req, res) => {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ status: "error", error: "multipart file is required" });
    }
    const extension = path.extname(req.file.originalname || "").toLowerCase();
    const safeName = `${req.file.filename}${extension}`;
    const finalPath = path.join(exportDir, safeName);
    fs.renameSync(req.file.path, finalPath);
    return res.json({
      status: "ok",
      path: finalPath,
      original_name: req.file.originalname,
      bytes: req.file.size,
    });
  });

  app.post("/nova4d/batch/render", requireApiKey, (req, res) => {
    const sceneFile = req.body.scene_file ? path.resolve(String(req.body.scene_file)) : null;
    const customArgs = Array.isArray(req.body.args) ? req.body.args.map((item) => String(item)) : [];
    const outputPath = req.body.output_path ? path.resolve(String(req.body.output_path)) : path.join(exportDir, `nova4d-render-${Date.now()}`);
    const timeoutSec = parseInteger(req.body.timeout_sec, headlessTimeoutSec, 30, 86400);

    const args = [];
    if (sceneFile) {
      args.push(sceneFile);
    }
    args.push(...customArgs);

    const logPath = path.join(exportDir, `batch-${Date.now()}-${Math.random().toString(16).slice(2, 10)}.log`);
    const job = createJobRecord(c4dPath, args, logPath);
    job.output_path = outputPath;
    job.timeout_sec = timeoutSec;

    const logFd = fs.openSync(logPath, "a");
    const child = spawn(c4dPath, args, {
      stdio: ["ignore", logFd, logFd],
      env: Object.assign({}, process.env, {
        NOVA4D_OUTPUT_PATH: outputPath,
      }),
    });

    job.pid = child.pid;
    headlessJobs.set(job.id, job);

    const timeout = setTimeout(() => {
      if (job.status === "running") {
        child.kill("SIGKILL");
        finalizeJob(job, "timed_out", -1, "SIGKILL");
      }
    }, timeoutSec * 1000);

    child.on("error", (err) => {
      clearTimeout(timeout);
      finalizeJob(job, "failed", -1, null);
      job.error = err.message;
      fs.closeSync(logFd);
    });

    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      const status = code === 0 ? "succeeded" : "failed";
      finalizeJob(job, status, code, signal);
      fs.closeSync(logFd);
    });

    return res.json({
      status: "accepted",
      job_id: job.id,
      pid: job.pid,
      command: c4dPath,
      args,
      output_path: outputPath,
      log_path: logPath,
      timeout_sec: timeoutSec,
    });
  });

  app.get("/nova4d/batch/jobs/:jobId", requireApiKey, (req, res) => {
    const job = headlessJobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ status: "error", error: "job not found" });
    }
    return res.json({ status: "ok", job });
  });

  app.get("/nova4d/batch/jobs", requireApiKey, (req, res) => {
    const limit = parseInteger(req.query.limit, 50, 1, 500);
    const jobs = Array.from(headlessJobs.values())
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
    return res.json({ status: "ok", count: jobs.length, jobs });
  });

  app.post("/nova4d/batch/jobs/:jobId/cancel", requireApiKey, (req, res) => {
    const job = headlessJobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ status: "error", error: "job not found" });
    }
    if (job.status !== "running") {
      return res.status(400).json({ status: "error", error: `job is ${job.status}` });
    }
    try {
      process.kill(job.pid, "SIGTERM");
      finalizeJob(job, "canceled", -1, "SIGTERM");
      return res.json({ status: "ok", job });
    } catch (err) {
      return res.status(500).json({ status: "error", error: err.message });
    }
  });
}

module.exports = {
  registerUploadAndBatchRoutes,
};
