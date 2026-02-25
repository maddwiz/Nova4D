"use strict";

function registerSystemRoutes({
  app,
  requireApiKey,
  parseInteger,
  parseBoolean,
  buildPreflightChecks,
  summarizePreflight,
  latestSceneSnapshot,
  snapshotTimestampMs,
  recentWorkerCommand,
  summarizeSnapshot,
  minimalCapabilities,
  normalizeSafetyPolicy,
  queuePlannedCommands,
  commandRoutes,
  commandRouteByPath,
  routeCatalog,
  workflowSpecs,
  workflowDefaults,
  buildWorkflowPlan,
  store,
  product,
  service,
  version,
  importDir,
  exportDir,
  storeDriver,
  effectiveStorePath,
  apiKey,
  c4dPath,
}) {
  app.get("/nova4d/health", (_req, res) => {
    res.json({
      status: "ok",
      product,
      service,
      version,
      queue: store.summary(),
      import_dir: importDir,
      export_dir: exportDir,
      store_driver: storeDriver,
      store_path: effectiveStorePath,
      api_key_enabled: Boolean(apiKey),
      c4d_path: c4dPath,
    });
  });

  app.get("/nova4d/system/preflight", requireApiKey, async (req, res) => {
    const probeWorker = parseBoolean(req.query.probe_worker, false);
    const probeTimeoutMs = parseInteger(req.query.probe_timeout_ms, 8000, 1000, 30000);
    const checks = await buildPreflightChecks({
      probeWorker,
      probeTimeoutMs,
    });
    const preflight = summarizePreflight(checks, probeWorker, probeTimeoutMs);

    return res.json({
      status: "ok",
      overall_status: preflight.overall_status,
      ready_for_local_use: preflight.ready_for_local_use,
      probe_worker: preflight.probe_worker,
      probe_timeout_ms: preflight.probe_timeout_ms,
      summary: preflight.summary,
      checks: preflight.checks,
    });
  });

  app.get("/nova4d/system/status", requireApiKey, async (_req, res) => {
    const checks = await buildPreflightChecks({
      probeWorker: false,
      probeTimeoutMs: 8000,
    });
    const preflight = summarizePreflight(checks, false, 8000);
    const snapshotCommand = latestSceneSnapshot(1000);
    const snapshotAgeMs = snapshotCommand ? Math.max(0, Date.now() - snapshotTimestampMs(snapshotCommand)) : null;
    const worker = recentWorkerCommand();
    const workerAgeMs = worker
      ? Math.max(0, Date.now() - Date.parse(worker.updated_at || worker.completed_at || worker.created_at || ""))
      : null;
    const clients = store.listSseClients(50);

    return res.json({
      status: "ok",
      product,
      service,
      version,
      queue: store.summary(),
      preflight: {
        overall_status: preflight.overall_status,
        ready_for_local_use: preflight.ready_for_local_use,
        summary: preflight.summary,
      },
      latest_snapshot: snapshotCommand
        ? {
          available: true,
          command_id: snapshotCommand.id,
          captured_at: snapshotCommand.completed_at || snapshotCommand.updated_at || null,
          age_ms: snapshotAgeMs,
          delivered_to: snapshotCommand.delivered_to || null,
          summary: summarizeSnapshot(snapshotCommand.result),
        }
        : {
          available: false,
          command_id: null,
          captured_at: null,
          age_ms: null,
          delivered_to: null,
          summary: null,
        },
      recent_worker_activity: worker
        ? {
          available: true,
          command_id: worker.id,
          route: worker.route,
          status: worker.status,
          delivered_to: worker.delivered_to || null,
          updated_at: worker.updated_at || worker.completed_at || null,
          age_ms: Number.isFinite(workerAgeMs) ? workerAgeMs : null,
        }
        : {
          available: false,
          command_id: null,
        },
      stream_clients: {
        count: clients.length,
        clients,
      },
    });
  });

  app.get("/nova4d/capabilities", requireApiKey, (_req, res) => {
    const summary = minimalCapabilities(commandRoutes);
    res.json({
      status: "ok",
      product,
      service,
      version,
      capabilities: Object.assign({}, summary, {
        risk_levels: ["safe", "moderate", "dangerous"],
        scene_query_endpoints: [
          "/nova4d/scene/graph",
          "/nova4d/scene/objects",
          "/nova4d/scene/materials",
          "/nova4d/scene/object",
        ],
        workflow_endpoints: [
          "/nova4d/workflows",
          "/nova4d/workflows/preview",
          "/nova4d/workflows/run",
        ],
      }),
      routes: routeCatalog,
    });
  });

  app.get("/nova4d/routes", requireApiKey, (_req, res) => {
    res.json({
      status: "ok",
      count: routeCatalog.length,
      routes: routeCatalog,
    });
  });

  app.get("/nova4d/workflows", requireApiKey, (_req, res) => {
    res.json({
      status: "ok",
      workflows: workflowSpecs,
      defaults: workflowDefaults(),
    });
  });

  app.post("/nova4d/workflows/preview", requireApiKey, (req, res) => {
    const workflowId = String(req.body.workflow_id || "").trim();
    if (!workflowId) {
      return res.status(400).json({ status: "error", error: "workflow_id is required" });
    }
    const options = req.body.options && typeof req.body.options === "object" && !Array.isArray(req.body.options)
      ? req.body.options
      : {};
    const maxCommands = parseInteger(req.body.max_commands, 20, 1, 100);
    const safety = normalizeSafetyPolicy(req.body.safety || {});

    const plan = buildWorkflowPlan(workflowId, options, safety, maxCommands);
    if (!plan.ok) {
      return res.status(plan.error === "workflow not found" ? 404 : 400).json({
        status: "error",
        error: plan.error,
        workflow_id: workflowId,
      });
    }

    return res.json({
      status: "ok",
      workflow: {
        id: plan.workflow.id,
        name: plan.workflow.name,
        description: plan.workflow.description,
        options: plan.options,
      },
      safety_policy: plan.guarded.policy,
      commands: plan.guarded.allowed,
      blocked_commands: plan.guarded.blocked,
    });
  });

  app.post("/nova4d/workflows/run", requireApiKey, (req, res) => {
    const workflowId = String(req.body.workflow_id || "").trim();
    if (!workflowId) {
      return res.status(400).json({ status: "error", error: "workflow_id is required" });
    }

    const options = req.body.options && typeof req.body.options === "object" && !Array.isArray(req.body.options)
      ? req.body.options
      : {};
    const maxCommands = parseInteger(req.body.max_commands, 20, 1, 100);
    const safety = normalizeSafetyPolicy(req.body.safety || {});
    const clientHint = String(req.body.client_hint || "cinema4d-live").trim();
    const requestedBy = String(req.body.requested_by || `workflow:${workflowId}`).trim();
    const plan = buildWorkflowPlan(workflowId, options, safety, maxCommands);
    if (!plan.ok) {
      return res.status(plan.error === "workflow not found" ? 404 : 400).json({
        status: "error",
        error: plan.error,
        workflow_id: workflowId,
      });
    }

    const queued = queuePlannedCommands({
      commands: plan.guarded.allowed,
      routeMap: commandRouteByPath,
      store,
      requestedBy,
      clientHint,
    });

    return res.json({
      status: "ok",
      workflow: {
        id: plan.workflow.id,
        name: plan.workflow.name,
        description: plan.workflow.description,
        options: plan.options,
      },
      safety_policy: plan.guarded.policy,
      blocked_commands: plan.guarded.blocked,
      queued_count: queued.length,
      queued,
    });
  });
}

module.exports = {
  registerSystemRoutes,
};
