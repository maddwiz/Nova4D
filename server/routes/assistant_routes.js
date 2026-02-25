"use strict";

function registerAssistantRoutes({
  app,
  requireApiKey,
  parseInteger,
  parseBoolean,
  path,
  exportDir,
  store,
  commandRoutes,
  commandRouteByPath,
  normalizeProvider,
  normalizeSafetyPolicy,
  queuePlannedCommands,
  planCommands,
  visionFeedbackPlan,
  testProviderConnection,
  toPublicProvider,
  applyCommandGuards,
  resolveSceneSnapshot,
  summarizeSnapshot,
  waitForCommandResult,
  waitForCommandsResult,
  visionScreenshotPath,
}) {
  app.get("/nova4d/assistant/providers", requireApiKey, (_req, res) => {
    const provider = normalizeProvider({}, process.env);
    res.json({
      status: "ok",
      default_provider: toPublicProvider(provider),
      supported_providers: [
        "builtin",
        "openai",
        "openrouter",
        "anthropic",
        "openai-compatible",
      ],
      supported_safety_modes: [
        "strict",
        "balanced",
        "unrestricted",
      ],
      defaults: {
        use_scene_context: true,
        refresh_scene_context: true,
        scene_context_max_age_ms: 30000,
        safety_mode: "balanced",
      },
    });
  });

  app.post("/nova4d/assistant/provider-test", requireApiKey, async (req, res) => {
    const provider = normalizeProvider(req.body.provider || {}, process.env);
    if (provider.kind !== "builtin" && (!provider.base_url || !provider.model)) {
      return res.status(400).json({
        status: "error",
        error: "provider base_url and model are required",
        provider: toPublicProvider(provider),
      });
    }

    try {
      const result = await testProviderConnection(provider, commandRoutes);
      return res.json({
        status: "ok",
        provider: toPublicProvider(provider),
        result,
      });
    } catch (err) {
      return res.status(502).json({
        status: "error",
        error: err.message,
        provider: toPublicProvider(provider),
      });
    }
  });

  app.post("/nova4d/assistant/vision/evaluate", requireApiKey, async (req, res) => {
    const input = String(req.body.input || "").trim();
    const screenshotPath = String(req.body.screenshot_path || "").trim();
    if (!input) {
      return res.status(400).json({ status: "error", error: "input is required" });
    }
    if (!screenshotPath) {
      return res.status(400).json({ status: "error", error: "screenshot_path is required" });
    }

    const provider = normalizeProvider(req.body.provider || {}, process.env);
    const maxCommands = parseInteger(req.body.max_commands, 8, 1, 30);
    const safety = normalizeSafetyPolicy(req.body.safety || {});
    const iteration = parseInteger(req.body.iteration, 1, 1, 20);
    const previousSummary = String(req.body.previous_summary || "").trim();

    try {
      const feedback = await visionFeedbackPlan({
        input,
        provider,
        commandRoutes,
        routeMap: commandRouteByPath,
        maxCommands,
        screenshotPath,
        iteration,
        previousSummary,
      });
      const guarded = applyCommandGuards(feedback.commands || [], safety);
      return res.json({
        status: "ok",
        provider: toPublicProvider(provider),
        safety_policy: guarded.policy,
        feedback: Object.assign({}, feedback, {
          commands: guarded.allowed,
        }),
        blocked_commands: guarded.blocked,
      });
    } catch (err) {
      return res.status(502).json({
        status: "error",
        error: err.message,
        provider: toPublicProvider(provider),
      });
    }
  });

  app.post("/nova4d/assistant/plan", requireApiKey, async (req, res) => {
    const input = String(req.body.input || "").trim();
    if (!input) {
      return res.status(400).json({ status: "error", error: "input is required" });
    }

    const provider = normalizeProvider(req.body.provider || {}, process.env);
    const maxCommands = parseInteger(req.body.max_commands, 10, 1, 30);
    const safety = normalizeSafetyPolicy(req.body.safety || {});
    const useSceneContext = parseBoolean(req.body.use_scene_context, true);
    const refreshSceneContext = parseBoolean(req.body.refresh_scene_context, true);
    const sceneContextMaxAgeMs = parseInteger(req.body.scene_context_max_age_ms, 30000, 1000, 3600000);
    const sceneContextTimeoutMs = parseInteger(req.body.scene_context_timeout_ms, 8000, 500, 30000);

    const warnings = [];
    let sceneSnapshot = null;
    let sceneMeta = {
      enabled: useSceneContext,
      source: "disabled",
      warning: null,
      command_id: null,
      captured_at: null,
    };

    if (useSceneContext) {
      const contextResult = await resolveSceneSnapshot({
        refresh: refreshSceneContext,
        maxAgeMs: sceneContextMaxAgeMs,
        timeoutMs: sceneContextTimeoutMs,
        requestedBy: "assistant:plan-context",
      });
      sceneSnapshot = contextResult.snapshot || null;
      sceneMeta = {
        enabled: true,
        source: contextResult.source,
        warning: contextResult.warning,
        command_id: contextResult.command ? contextResult.command.id : null,
        captured_at: contextResult.command ? (contextResult.command.completed_at || contextResult.command.updated_at || null) : null,
      };
      if (contextResult.warning) {
        warnings.push(`scene_context: ${contextResult.warning}`);
      }
      if (!sceneSnapshot) {
        warnings.push("scene_context: unavailable");
      }
    }

    let plan;
    try {
      plan = await planCommands({
        input,
        provider,
        commandRoutes,
        routeMap: commandRouteByPath,
        maxCommands,
        sceneContext: sceneSnapshot,
      });
    } catch (err) {
      warnings.push(err.message);
      const builtinProvider = normalizeProvider({ kind: "builtin" }, process.env);
      plan = await planCommands({
        input,
        provider: builtinProvider,
        commandRoutes,
        routeMap: commandRouteByPath,
        maxCommands,
        sceneContext: sceneSnapshot,
      });
    }

    const guarded = applyCommandGuards(plan.commands, safety);
    const warning = warnings.length ? warnings.join(" | ") : null;

    return res.json({
      status: "ok",
      warning,
      warnings,
      provider: toPublicProvider(provider),
      safety_policy: guarded.policy,
      scene_context: Object.assign({}, sceneMeta, {
        summary: summarizeSnapshot(sceneSnapshot),
      }),
      plan: {
        mode: plan.mode,
        summary: plan.summary,
        commands: guarded.allowed,
      },
      blocked_commands: guarded.blocked,
      valid_command_count: guarded.allowed.length,
    });
  });

  app.post("/nova4d/assistant/run", requireApiKey, async (req, res) => {
    const input = String(req.body.input || "").trim();
    if (!input) {
      return res.status(400).json({ status: "error", error: "input is required" });
    }

    const provider = normalizeProvider(req.body.provider || {}, process.env);
    const maxCommands = parseInteger(req.body.max_commands, 10, 1, 30);
    const clientHint = String(req.body.client_hint || "cinema4d-live").trim();
    const safety = normalizeSafetyPolicy(req.body.safety || {});
    const useSceneContext = parseBoolean(req.body.use_scene_context, true);
    const refreshSceneContext = parseBoolean(req.body.refresh_scene_context, true);
    const sceneContextMaxAgeMs = parseInteger(req.body.scene_context_max_age_ms, 30000, 1000, 3600000);
    const sceneContextTimeoutMs = parseInteger(req.body.scene_context_timeout_ms, 8000, 500, 30000);
    const visionLoop = req.body.vision_loop && typeof req.body.vision_loop === "object" && !Array.isArray(req.body.vision_loop)
      ? req.body.vision_loop
      : {};
    const visionEnabled = parseBoolean(visionLoop.enabled, false);
    const visionMaxIterations = parseInteger(visionLoop.max_iterations, 2, 1, 5);
    const visionMaxCommands = parseInteger(visionLoop.max_commands, Math.min(maxCommands, 10), 1, 30);
    const visionWaitTimeoutMs = parseInteger(visionLoop.wait_timeout_ms, 35000, 1000, 180000);
    const visionPollMs = parseInteger(visionLoop.poll_ms, 750, 200, 5000);
    const visionFrame = parseInteger(visionLoop.frame, 0, -100000, 100000);
    const visionScreenshotTemplate = String(visionLoop.screenshot_path || path.join(exportDir, "nova4d-vision-iter-{{iteration}}.png"))
      .trim();

    const warnings = [];
    let sceneSnapshot = null;
    let sceneMeta = {
      enabled: useSceneContext,
      source: "disabled",
      warning: null,
      command_id: null,
      captured_at: null,
    };

    if (useSceneContext) {
      const contextResult = await resolveSceneSnapshot({
        refresh: refreshSceneContext,
        maxAgeMs: sceneContextMaxAgeMs,
        timeoutMs: sceneContextTimeoutMs,
        requestedBy: "assistant:run-context",
      });
      sceneSnapshot = contextResult.snapshot || null;
      sceneMeta = {
        enabled: true,
        source: contextResult.source,
        warning: contextResult.warning,
        command_id: contextResult.command ? contextResult.command.id : null,
        captured_at: contextResult.command ? (contextResult.command.completed_at || contextResult.command.updated_at || null) : null,
      };
      if (contextResult.warning) {
        warnings.push(`scene_context: ${contextResult.warning}`);
      }
      if (!sceneSnapshot) {
        warnings.push("scene_context: unavailable");
      }
    }

    let plan;
    try {
      plan = await planCommands({
        input,
        provider,
        commandRoutes,
        routeMap: commandRouteByPath,
        maxCommands,
        sceneContext: sceneSnapshot,
      });
    } catch (err) {
      warnings.push(err.message);
      const builtinProvider = normalizeProvider({ kind: "builtin" }, process.env);
      plan = await planCommands({
        input,
        provider: builtinProvider,
        commandRoutes,
        routeMap: commandRouteByPath,
        maxCommands,
        sceneContext: sceneSnapshot,
      });
    }

    const guarded = applyCommandGuards(plan.commands, safety);

    const queued = queuePlannedCommands({
      commands: guarded.allowed,
      routeMap: commandRouteByPath,
      store,
      requestedBy: `assistant:${plan.mode}`,
      clientHint,
    });

    const allQueued = queued.slice();
    const visionResponse = {
      enabled: visionEnabled,
      provider_kind: provider.kind,
      max_iterations: visionMaxIterations,
      max_commands: visionMaxCommands,
      wait_timeout_ms: visionWaitTimeoutMs,
      iterations: [],
      warnings: [],
    };

    if (visionEnabled) {
      if (!queued.length) {
        visionResponse.warnings.push("scene_vision:no_initial_commands");
      } else if (provider.kind === "builtin") {
        visionResponse.warnings.push("scene_vision:builtin_provider_not_supported");
      } else {
        let activeQueued = queued.slice();
        let previousSummary = plan.summary || "";
        const screenshotSpec = commandRouteByPath.get("/nova4d/viewport/screenshot");

        if (!screenshotSpec) {
          visionResponse.warnings.push("scene_vision:screenshot_route_unavailable");
        } else {
          for (let iteration = 1; iteration <= visionMaxIterations; iteration += 1) {
            const activeCommandIds = activeQueued
              .map((command) => String(command?.id || "").trim())
              .filter(Boolean);
            if (!activeCommandIds.length) {
              break;
            }

            const completed = await waitForCommandsResult(activeCommandIds, visionWaitTimeoutMs, visionPollMs);
            const statusCounts = completed.reduce((acc, command) => {
              const status = String(command?.status || "unknown");
              acc[status] = (acc[status] || 0) + 1;
              return acc;
            }, {});

            const screenshotPath = visionScreenshotPath(visionScreenshotTemplate, iteration);
            const screenshotCommand = store.enqueue({
              route: screenshotSpec.path,
              category: screenshotSpec.category,
              action: screenshotSpec.action,
              payload: {
                frame: visionFrame,
                output_path: screenshotPath,
              },
              priority: 0,
              metadata: {
                requested_by: `assistant:vision-snapshot:${iteration}`,
                client_hint: clientHint,
              },
            });

            const screenshotFinal = await waitForCommandResult(screenshotCommand.id, visionWaitTimeoutMs, visionPollMs);
            if (!screenshotFinal || screenshotFinal.status !== "succeeded") {
              const errText = screenshotFinal
                ? `scene_vision:screenshot_${screenshotFinal.status}`
                : "scene_vision:screenshot_timeout";
              visionResponse.warnings.push(errText);
              visionResponse.iterations.push({
                iteration,
                source_command_ids: activeCommandIds,
                source_status_counts: statusCounts,
                screenshot_command_id: screenshotCommand.id,
                screenshot_status: screenshotFinal ? screenshotFinal.status : "timeout",
                screenshot_path: screenshotPath,
                queued_corrections: 0,
                blocked_corrections: 0,
                needs_correction: false,
                match_score: null,
                summary: "",
                analysis: "",
              });
              break;
            }

            let feedback;
            try {
              feedback = await visionFeedbackPlan({
                input,
                provider,
                commandRoutes,
                routeMap: commandRouteByPath,
                maxCommands: visionMaxCommands,
                screenshotPath: String(screenshotFinal.result?.output_path || screenshotPath),
                iteration,
                previousSummary,
              });
            } catch (err) {
              visionResponse.warnings.push(`scene_vision:feedback_error:${err.message}`);
              visionResponse.iterations.push({
                iteration,
                source_command_ids: activeCommandIds,
                source_status_counts: statusCounts,
                screenshot_command_id: screenshotCommand.id,
                screenshot_status: "succeeded",
                screenshot_path: String(screenshotFinal.result?.output_path || screenshotPath),
                queued_corrections: 0,
                blocked_corrections: 0,
                needs_correction: false,
                match_score: null,
                summary: "",
                analysis: "",
              });
              break;
            }

            const guardedVision = applyCommandGuards(feedback.commands || [], safety);
            const correctionQueued = queuePlannedCommands({
              commands: guardedVision.allowed,
              routeMap: commandRouteByPath,
              store,
              requestedBy: `assistant:vision:${iteration}`,
              clientHint,
            });
            allQueued.push(...correctionQueued);

            visionResponse.iterations.push({
              iteration,
              source_command_ids: activeCommandIds,
              source_status_counts: statusCounts,
              screenshot_command_id: screenshotCommand.id,
              screenshot_status: "succeeded",
              screenshot_path: feedback.screenshot_path || String(screenshotFinal.result?.output_path || screenshotPath),
              queued_corrections: correctionQueued.length,
              blocked_corrections: guardedVision.blocked.length,
              needs_correction: Boolean(feedback.needs_correction),
              match_score: feedback.match_score,
              summary: feedback.summary || "",
              analysis: feedback.analysis || "",
              blocked_commands: guardedVision.blocked,
            });

            if (!feedback.needs_correction || correctionQueued.length === 0) {
              break;
            }
            activeQueued = correctionQueued;
            previousSummary = feedback.summary || previousSummary;
          }
        }
      }
    }

    const combinedWarnings = warnings.concat(visionResponse.warnings || []);
    const warning = combinedWarnings.length ? combinedWarnings.join(" | ") : null;

    return res.json({
      status: "ok",
      warning,
      warnings: combinedWarnings,
      provider: toPublicProvider(provider),
      safety_policy: guarded.policy,
      scene_context: Object.assign({}, sceneMeta, {
        summary: summarizeSnapshot(sceneSnapshot),
      }),
      plan: {
        mode: plan.mode,
        summary: plan.summary,
        commands: guarded.allowed,
      },
      blocked_commands: guarded.blocked,
      queued_count: allQueued.length,
      queued: allQueued,
      vision_loop: visionResponse,
    });
  });

  app.post("/nova4d/assistant/queue", requireApiKey, (req, res) => {
    const requestedBy = String(req.body.requested_by || "assistant:manual").trim();
    const clientHint = String(req.body.client_hint || "cinema4d-live").trim();
    const maxCommands = parseInteger(req.body.max_commands, 20, 1, 100);
    const safety = normalizeSafetyPolicy(req.body.safety || {});
    const incoming = Array.isArray(req.body.commands) ? req.body.commands : [];
    if (incoming.length === 0) {
      return res.status(400).json({ status: "error", error: "commands[] is required" });
    }

    const sanitized = (incoming || [])
      .slice(0, maxCommands)
      .map((item) => ({
        route: String(item.route || "").trim(),
        payload: item.payload && typeof item.payload === "object" && !Array.isArray(item.payload) ? item.payload : {},
        reason: String(item.reason || "").slice(0, 800),
        priority: parseInteger(item.priority, 0, -100, 100),
      }))
      .filter((item) => commandRouteByPath.has(item.route));

    if (sanitized.length === 0) {
      return res.status(400).json({ status: "error", error: "no valid command routes in commands[]" });
    }

    const guarded = applyCommandGuards(sanitized, safety);
    const queued = queuePlannedCommands({
      commands: guarded.allowed,
      routeMap: commandRouteByPath,
      store,
      requestedBy,
      clientHint,
    });

    return res.json({
      status: "ok",
      safety_policy: guarded.policy,
      blocked_commands: guarded.blocked,
      queued_count: queued.length,
      queued,
    });
  });
}

module.exports = {
  registerAssistantRoutes,
};
