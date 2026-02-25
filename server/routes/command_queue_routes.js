"use strict";

function registerCommandQueueRoutes({
  app,
  requireApiKey,
  parseInteger,
  parseBoolean,
  inferClientId,
  store,
  commandRouteByPath,
  commandRoutes,
  queueCommand,
  validateQueuedPayload,
  rateLimitWindowMs,
  rateLimitMax,
}) {
  app.get("/nova4d/stats", requireApiKey, (_req, res) => {
    res.json({ status: "ok", stats: store.summary(), rate_limit: { window_ms: rateLimitWindowMs, max: rateLimitMax } });
  });

  app.get("/nova4d/commands/recent", requireApiKey, (req, res) => {
    const limit = parseInteger(req.query.limit, 50, 1, 500);
    const statusFilter = String(req.query.status || "").trim().toLowerCase();
    const routeFilter = String(req.query.route || "").trim().toLowerCase();
    const actionFilter = String(req.query.action || "").trim().toLowerCase();
    const clientFilter = String(req.query.client || "").trim().toLowerCase();

    const statusSet = new Set(
      statusFilter
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    );

    let commands = store.listRecent(500);
    if (statusSet.size > 0) {
      commands = commands.filter((command) => statusSet.has(String(command.status || "").toLowerCase()));
    }
    if (routeFilter) {
      commands = commands.filter((command) => String(command.route || "").toLowerCase().includes(routeFilter));
    }
    if (actionFilter) {
      commands = commands.filter((command) => String(command.action || "").toLowerCase().includes(actionFilter));
    }
    if (clientFilter) {
      commands = commands.filter((command) => String(command.delivered_to || "").toLowerCase().includes(clientFilter));
    }

    res.json({ status: "ok", commands: commands.slice(0, limit) });
  });

  app.get("/nova4d/commands/:id", requireApiKey, (req, res) => {
    const command = store.get(req.params.id);
    if (!command) {
      return res.status(404).json({ status: "error", error: "not found" });
    }
    return res.json({ status: "ok", command });
  });

  app.post("/nova4d/command", requireApiKey, (req, res) => {
    const { route, category, action, payload } = req.body || {};
    if (!route || !action) {
      return res.status(400).json({ status: "error", error: "route and action are required" });
    }
    const routeSpec = commandRouteByPath.get(String(route));
    if (routeSpec) {
      const validation = validateQueuedPayload(routeSpec.path, payload || {});
      if (!validation.ok) {
        return res.status(400).json({
          status: "error",
          error: "payload validation failed",
          route: routeSpec.path,
          details: validation.errors,
        });
      }
    }

    const command = store.enqueue({
      route,
      category: category || (routeSpec ? routeSpec.category : "custom"),
      action: routeSpec ? routeSpec.action : action,
      payload: payload || {},
      priority: parseInteger(req.body.priority, 0, -100, 100),
      metadata: req.body.metadata || {},
    });
    return res.json({ status: "queued", command_id: command.id, command });
  });

  app.post("/nova4d/commands/batch", requireApiKey, (req, res) => {
    const commands = Array.isArray(req.body.commands) ? req.body.commands : [];
    if (commands.length === 0) {
      return res.status(400).json({ status: "error", error: "commands[] is required" });
    }
    const normalized = [];
    for (const cmd of commands) {
      const route = cmd.route || "/nova4d/custom";
      const routeSpec = commandRouteByPath.get(String(route));
      const payload = cmd.payload || {};
      if (routeSpec) {
        const validation = validateQueuedPayload(routeSpec.path, payload);
        if (!validation.ok) {
          return res.status(400).json({
            status: "error",
            error: "payload validation failed",
            route: routeSpec.path,
            details: validation.errors,
          });
        }
      }
      normalized.push({
        route,
        category: cmd.category || (routeSpec ? routeSpec.category : "custom"),
        action: routeSpec ? routeSpec.action : (cmd.action || "command"),
        payload,
        priority: parseInteger(cmd.priority, 0, -100, 100),
        metadata: cmd.metadata || {},
      });
    }
    const queued = store.enqueueBatch(normalized);
    return res.json({
      status: "queued",
      count: queued.length,
      command_ids: queued.map((cmd) => cmd.id),
    });
  });

  app.get("/nova4d/commands", requireApiKey, (req, res) => {
    const clientId = inferClientId(req);
    const limit = parseInteger(req.query.limit, 20, 1, 100);
    const commands = store.dispatch(clientId, limit);
    res.json({
      status: "ok",
      client_id: clientId,
      count: commands.length,
      commands,
    });
  });

  app.post("/nova4d/results", requireApiKey, (req, res) => {
    const result = store.result(req.body || {});
    if (!result.ok) {
      return res.status(400).json({ status: "error", error: result.error });
    }
    return res.json({
      status: "ok",
      ignored: Boolean(result.ignored),
      command_id: result.command.id,
      command_status: result.command.status,
      updated_at: result.command.updated_at,
    });
  });

  app.post("/nova4d/commands/:id/requeue", requireApiKey, (req, res) => {
    const result = store.requeue(req.params.id);
    if (!result.ok) {
      return res.status(400).json({ status: "error", error: result.error });
    }
    return res.json({ status: "ok", command: result.command });
  });

  app.post("/nova4d/commands/:id/cancel", requireApiKey, (req, res) => {
    const result = store.cancel(req.params.id);
    if (!result.ok) {
      return res.status(400).json({ status: "error", error: result.error });
    }
    return res.json({ status: "ok", command: result.command });
  });

  app.post("/nova4d/commands/cancel-pending", requireApiKey, (_req, res) => {
    const result = store.cancelPending();
    return res.json({
      status: "ok",
      canceled_count: result.canceled_count,
      command_ids: result.command_ids,
    });
  });

  app.post("/nova4d/commands/retry-failed", requireApiKey, (req, res) => {
    const limit = parseInteger(req.body.limit, 20, 1, 200);
    const includeCanceled = parseBoolean(req.body.include_canceled, false);
    const result = store.retryFailed({
      limit,
      includeCanceled,
    });
    return res.json({
      status: "ok",
      requested_limit: result.requested_limit,
      include_canceled: result.include_canceled,
      requeued_count: result.requeued_count,
      command_ids: result.command_ids,
    });
  });

  app.get("/nova4d/stream", requireApiKey, (req, res) => {
    const clientId = inferClientId(req);
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    res.write("event: connected\n");
    res.write(`data: ${JSON.stringify({ client_id: clientId, ts: new Date().toISOString() })}\n\n`);

    store.addSseClient(clientId, res);

    const keepAlive = setInterval(() => {
      try {
        res.write("event: heartbeat\n");
        res.write(`data: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
      } catch (_err) {
        clearInterval(keepAlive);
        store.removeSseClient(res);
      }
    }, 15000);

    req.on("close", () => {
      clearInterval(keepAlive);
      store.removeSseClient(res);
    });
  });

  commandRoutes.forEach((spec) => {
    app.post(spec.path, requireApiKey, (req, res) => queueCommand(req, res, spec));
  });
}

module.exports = {
  registerCommandQueueRoutes,
};
