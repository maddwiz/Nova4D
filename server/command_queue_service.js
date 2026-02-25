"use strict";

function createCommandQueueService({
  store,
  validatePayload,
  filterCommandsBySafety,
  normalizeSafetyPolicy,
  getRisk,
  parseInteger,
}) {
  function validateQueuedPayload(routePath, payload) {
    return validatePayload(routePath, payload || {});
  }

  function queueCommand(req, res, spec, extraPayload = {}) {
    if (!spec) {
      return res.status(404).json({ status: "error", error: "route spec not found" });
    }
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const priority = parseInteger(body.priority, 0, -100, 100);
    const metadata = Object.assign({}, body.metadata || {}, {
      requested_by: req.get("X-Request-By") || "api",
      client_hint: body.client_hint || null,
    });

    const payload = Object.assign({}, body, extraPayload);
    const validation = validateQueuedPayload(spec.path, payload);
    if (!validation.ok) {
      return res.status(400).json({
        status: "error",
        error: "payload validation failed",
        route: spec.path,
        details: validation.errors,
      });
    }
    const command = store.enqueue({
      route: spec.path,
      category: spec.category,
      action: spec.action,
      payload,
      priority,
      metadata,
    });

    return res.json({
      status: "queued",
      command_id: command.id,
      category: command.category,
      action: command.action,
      route: command.route,
      queued_at: command.created_at,
    });
  }

  function applyCommandGuards(commands, safetyInput) {
    const rejectedByValidation = [];
    const valid = [];

    commands.forEach((command) => {
      const validation = validateQueuedPayload(command.route, command.payload);
      if (!validation.ok) {
        rejectedByValidation.push({
          route: command.route,
          reason: "payload validation failed",
          details: validation.errors,
          payload: command.payload || {},
        });
        return;
      }
      valid.push(command);
    });

    const safetyResult = filterCommandsBySafety(valid, getRisk, safetyInput);

    return {
      policy: safetyResult.policy || normalizeSafetyPolicy(safetyInput || {}),
      allowed: safetyResult.allowed || [],
      blocked: (safetyResult.blocked || []).concat(rejectedByValidation),
    };
  }

  return {
    validateQueuedPayload,
    queueCommand,
    applyCommandGuards,
  };
}

module.exports = {
  createCommandQueueService,
};
