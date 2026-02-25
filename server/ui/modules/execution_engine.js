/* Execution engine module extracted from app.js */
function renderMonitorFailureList(commands, sourceLabel = "Run") {
  const rows = Array.isArray(commands) ? commands : [];
  if (!rows.length) {
    nodes.queuedCommands.innerHTML = "<li class='hint'>No failed commands to show.</li>";
    return;
  }
  nodes.queuedCommands.innerHTML = rows.map((command) => {
    const route = escapeHtml(command.route || "-");
    const action = escapeHtml(command.action || "-");
    const status = escapeHtml(command.status || "unknown");
    const id = escapeHtml(command.id || "");
    const err = escapeHtml(command.error || "");
    const detail = err ? `${action} | ${status} | ${id} | ${err}` : `${action} | ${status} | ${id}`;
    return `<li><div><span class="code-inline">${route}</span></div><div class="mono small">${detail}</div></li>`;
  }).join("");
  nodes.runSummary.textContent =
    `${sourceLabel}: ${rows.length} failed/canceled command${rows.length === 1 ? "" : "s"} in last monitored run.`;
}

async function showLastRunFailures() {
  if (!lastRunMonitorCommandIds.length) {
    nodes.runSummary.textContent = "No monitored run available yet.";
    return;
  }
  const snapshots = await fetchCommandSnapshots(lastRunMonitorCommandIds);
  lastRunMonitorSnapshots = snapshots;
  const failures = snapshots.filter((command) => {
    const status = normalizeCommandStatus(command?.status);
    return status === "failed" || status === "canceled";
  });
  if (!failures.length) {
    nodes.runSummary.textContent = `${lastRunMonitorSource}: no failed/canceled commands in last monitored run.`;
    nodes.queuedCommands.innerHTML = "<li class='hint'>No failed commands detected.</li>";
    return;
  }
  renderMonitorFailureList(failures, lastRunMonitorSource);
}

async function retryLastRunFailures() {
  if (!lastRunMonitorCommandIds.length) {
    nodes.runSummary.textContent = "No monitored run available yet.";
    return;
  }
  const snapshots = await fetchCommandSnapshots(lastRunMonitorCommandIds);
  lastRunMonitorSnapshots = snapshots;
  const retryable = snapshots.filter((command) => normalizeCommandStatus(command?.status) === "failed");
  if (!retryable.length) {
    nodes.runSummary.textContent = `${lastRunMonitorSource}: no failed commands to retry.`;
    return;
  }

  let requeued = 0;
  let retryErrors = 0;
  const queuedRows = [];
  for (const command of retryable) {
    const commandId = String(command?.id || "").trim();
    if (!commandId) {
      continue;
    }
    try {
      const response = await api(`/nova4d/commands/${encodeURIComponent(commandId)}/requeue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const requeuedCommand = response.command || {};
      requeued += 1;
      queuedRows.push({
        id: commandId,
        route: requeuedCommand.route || command.route || "",
        action: requeuedCommand.action || command.action || "",
        status: requeuedCommand.status || "queued",
      });
    } catch (_err) {
      retryErrors += 1;
    }
  }

  nodes.runSummary.textContent =
    `${lastRunMonitorSource}: retried ${requeued}/${retryable.length} failed command${retryable.length === 1 ? "" : "s"}${retryErrors ? ` | retry errors ${retryErrors}` : ""}.`;
  await loadRecent();
  await loadHealth();
  await loadSystemStatus();
  if (requeued > 0) {
    void maybeAutoMonitorQueued(queuedRows, `${lastRunMonitorSource} retry`);
  }
}

async function exportLastRunMonitorReport() {
  if (!lastRunMonitorCommandIds.length) {
    nodes.runSummary.textContent = "No monitored run available yet.";
    return;
  }
  try {
    const snapshots = await ensureLatestRunMonitorSnapshots();
    const summary = summarizeCommandStatuses(snapshots);
    const payload = {
      exported_at: new Date().toISOString(),
      source: lastRunMonitorSource || "Run",
      command_ids: lastRunMonitorCommandIds,
      summary,
      commands: snapshots,
      monitor_status_text: nodes.runMonitorStatus.textContent || "",
      monitor_status_class: nodes.runMonitorStatus.className || "",
    };
    const serialized = JSON.stringify(payload, null, 2);
    const blob = new Blob([serialized], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = payload.exported_at.replace(/[:.]/g, "-");
    anchor.href = url;
    anchor.download = `nova4d-run-monitor-${stamp}.json`;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
    nodes.runSummary.textContent =
      `${payload.source}: exported run monitor report (${summary.total} command${summary.total === 1 ? "" : "s"}).`;
  } catch (err) {
    nodes.runSummary.textContent = `Run monitor export failed: ${err.message}`;
  }
}

async function monitorQueuedCommands(queuedCommands, sourceLabel = "Run") {
  const queueRows = Array.isArray(queuedCommands) ? queuedCommands : [];
  const commandIds = Array.from(new Set(
    queueRows
      .map((row) => String(row?.id || "").trim())
      .filter(Boolean)
  ));
  if (!commandIds.length) {
    runMonitorActive = false;
    updateRunMonitorButtons();
    setRunMonitorStatus(`${sourceLabel}: queued commands have no IDs to monitor.`, "status-warn");
    return { monitored: false, reason: "missing-command-ids" };
  }

  const token = runMonitorToken + 1;
  runMonitorToken = token;
  runMonitorActive = true;
  setRunMonitorSession(sourceLabel, commandIds, queueRows);
  const startedAt = Date.now();
  setRunMonitorStatus(
    `${sourceLabel}: monitoring ${commandIds.length} command${commandIds.length === 1 ? "" : "s"}...`,
    "status-warn"
  );

  while (Date.now() - startedAt <= RUN_MONITOR_TIMEOUT_MS) {
    if (token !== runMonitorToken) {
      return { monitored: false, canceled: true };
    }

    const snapshots = await fetchCommandSnapshots(commandIds);

    if (token !== runMonitorToken) {
      return { monitored: false, canceled: true };
    }

    lastRunMonitorSnapshots = snapshots;
    const summary = summarizeCommandStatuses(snapshots);
    const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
    const completed = summary.terminal === summary.total;
    const className = completed
      ? (summary.failed > 0 ? "status-error" : "status-ok")
      : "status-warn";
    const text =
      `${sourceLabel}: ${summary.terminal}/${summary.total} complete | ok ${summary.succeeded} failed ${summary.failed} canceled ${summary.canceled} queued ${summary.queued} dispatched ${summary.dispatched} | ${elapsedSec}s`;
    setRunMonitorStatus(text, className);

    if (completed) {
      runMonitorActive = false;
      updateRunMonitorButtons();
      await loadRecent();
      await loadHealth();
      await loadSystemStatus();
      captureRunMonitorHistorySession(sourceLabel, commandIds, snapshots, "completed", startedAt, Date.now());
      setRunMonitorHistoryStatus(
        `${sourceLabel}: saved run monitor session (${summary.total} command${summary.total === 1 ? "" : "s"}).`,
        summary.failed > 0 ? "status-warn" : "hint"
      );
      return { monitored: true, completed: true, summary };
    }

    await new Promise((resolve) => setTimeout(resolve, RUN_MONITOR_POLL_MS));
  }

  if (token === runMonitorToken) {
    const timeoutSnapshots = await fetchCommandSnapshots(commandIds);
    lastRunMonitorSnapshots = timeoutSnapshots;
    const timeoutSummary = summarizeCommandStatuses(timeoutSnapshots);
    captureRunMonitorHistorySession(sourceLabel, commandIds, timeoutSnapshots, "timeout", startedAt, Date.now());
    setRunMonitorHistoryStatus(
      `${sourceLabel}: monitor timeout saved to history (${timeoutSummary.terminal}/${timeoutSummary.total} complete).`,
      "status-warn"
    );
    runMonitorActive = false;
    updateRunMonitorButtons();
    setRunMonitorStatus(
      `${sourceLabel}: monitor timeout after ${Math.floor(RUN_MONITOR_TIMEOUT_MS / 1000)}s. Check recent commands for pending jobs.`,
      "status-warn"
    );
  }
  return { monitored: true, completed: false, timeout: true };
}

async function maybeAutoMonitorQueued(queuedCommands, sourceLabel = "Run") {
  const queueRows = Array.isArray(queuedCommands) ? queuedCommands : [];
  if (!queueRows.length) {
    runMonitorActive = false;
    updateRunMonitorButtons();
    setRunMonitorStatus(`${sourceLabel}: no queued commands to monitor.`, "hint");
    return { monitored: false, reason: "none-queued" };
  }
  if (!nodes.autoMonitorRuns.checked) {
    runMonitorActive = false;
    setRunMonitorSession(sourceLabel, queueRows.map((row) => row?.id), queueRows);
    setRunMonitorStatus(
      `${sourceLabel}: queued ${queueRows.length} command${queueRows.length === 1 ? "" : "s"} (auto monitor disabled).`,
      "hint"
    );
    return { monitored: false, reason: "auto-monitor-disabled" };
  }
  return monitorQueuedCommands(queueRows, sourceLabel);
}

async function testProviderConnection() {
  const fingerprint = providerConfigFingerprint();
  setProviderStatus("Testing provider connection...", "status-warn");
  try {
    const response = await api("/nova4d/assistant/provider-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: providerPayload(),
      }),
    });
    const result = response.result || {};
    const latency = Number.isFinite(Number(result.latency_ms))
      ? ` | ${result.latency_ms}ms`
      : "";
    const detail = result.details ? ` | ${result.details}` : "";
    setProviderStatus(`Provider ready (${result.mode || "unknown"})${latency}${detail}`, "status-ok");
    providerTestState = {
      tested: true,
      ok: true,
      fingerprint,
      mode: String(result.mode || nodes.providerKind.value || "unknown"),
      latency_ms: Number.isFinite(Number(result.latency_ms)) ? Number(result.latency_ms) : null,
      error: "",
      at: new Date().toISOString(),
    };
  } catch (err) {
    setProviderStatus(`Provider test failed: ${err.message}`, "status-error");
    providerTestState = {
      tested: true,
      ok: false,
      fingerprint,
      mode: String(nodes.providerKind.value || "unknown"),
      latency_ms: null,
      error: err.message,
      at: new Date().toISOString(),
    };
  }
}

async function planOnly() {
  const input = (nodes.promptInput.value || "").trim();
  if (!input) {
    nodes.planSummary.textContent = "Enter a prompt first.";
    return false;
  }

  nodes.planSummary.textContent = "Planning...";
  try {
    const response = await api("/nova4d/assistant/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input,
        provider: providerPayload(),
        safety: safetyPayload(),
        vision_loop: visionLoopPayload(),
        ...contextPayload(),
        max_commands: Number(nodes.maxCommands.value || 10),
      }),
    });
    renderPlan(response);
    return true;
  } catch (err) {
    nodes.planSummary.textContent = `Plan failed: ${err.message}`;
    return false;
  }
}

async function runPlan() {
  const input = (nodes.promptInput.value || "").trim();
  if (!input) {
    nodes.runSummary.textContent = "Enter a prompt first.";
    return false;
  }

  nodes.runSummary.textContent = "Running...";
  try {
    const response = await api("/nova4d/assistant/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input,
        provider: providerPayload(),
        safety: safetyPayload(),
        ...contextPayload(),
        max_commands: Number(nodes.maxCommands.value || 10),
      }),
    });
    renderPlan(response);
    renderRun(response);
    await loadRecent();
    void maybeAutoMonitorQueued(response.queued || [], "AI run");
    return true;
  } catch (err) {
    nodes.runSummary.textContent = `Run failed: ${err.message}`;
    return false;
  }
}

async function smartRun() {
  const input = (nodes.promptInput.value || "").trim();
  if (!input) {
    nodes.runSummary.textContent = "Enter a prompt first.";
    return false;
  }
  if (smartRunInProgress) {
    nodes.runSummary.textContent = "Smart Run is already in progress.";
    return false;
  }

  smartRunInProgress = true;
  try {
    nodes.runSummary.textContent = "Smart Run: validating prerequisites...";
    const providerReady = await ensureProviderReady();
    if (!providerReady.ok) {
      return false;
    }

    nodes.runSummary.textContent = "Smart Run: executing plan...";
    const runOk = await runPlan();
    await loadHealth();
    await loadSystemStatus();
    return runOk;
  } finally {
    smartRunInProgress = false;
  }
}

async function queueLastPlan() {
  const commands = Array.isArray(lastPlan?.plan?.commands) ? lastPlan.plan.commands : [];
  if (!commands.length) {
    nodes.runSummary.textContent = "No reviewed plan available. Click Plan Only first.";
    return;
  }

  nodes.runSummary.textContent = "Queueing reviewed plan...";
  try {
    const response = await api("/nova4d/assistant/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requested_by: "assistant:studio-approved-plan",
        client_hint: "cinema4d-live",
        max_commands: Number(nodes.maxCommands.value || 10),
        safety: safetyPayload(),
        commands: commands.map((command) => ({
          route: command.route,
          payload: command.payload || {},
          reason: command.reason || "",
          priority: command.priority || 0,
        })),
      }),
    });
    renderRun({
      plan: { summary: "Queued reviewed plan." },
      queued: response.queued || [],
      blocked_commands: response.blocked_commands || [],
      scene_context: { enabled: false },
    });
    await loadRecent();
    void maybeAutoMonitorQueued(response.queued || [], "Reviewed plan queue");
  } catch (err) {
    nodes.runSummary.textContent = `Queue failed: ${err.message}`;
  }
}

function renderWorkflowPreview(workflowLabel, commands, blocked, summaryLabel) {
  const safeCommands = Array.isArray(commands) ? commands : [];
  const safeBlocked = Array.isArray(blocked) ? blocked : [];
  nodes.planSummary.textContent =
    `${workflowLabel} | ${summaryLabel} | commands ${safeCommands.length}${safeBlocked.length ? ` | blocked ${safeBlocked.length}` : ""}`;

  const commandRows = safeCommands.map((item) => {
    const route = escapeHtml(item.route || "");
    const reason = escapeHtml(item.reason || "");
    const payload = escapeHtml(JSON.stringify(item.payload || {}));
    return `<li><div><span class="code-inline">${route}</span></div><div class="hint">${reason}</div><div class="mono small">${payload}</div></li>`;
  });
  const blockedRows = safeBlocked.map((item) => {
    const route = escapeHtml(item.route || "");
    const reason = escapeHtml(item.reason || "blocked");
    return `<li><div><span class="code-inline">${route}</span></div><div class="status-warn">${reason}</div></li>`;
  });
  const rows = commandRows.concat(blockedRows);
  nodes.planCommands.innerHTML = rows.length
    ? rows.join("")
    : "<li class='hint'>No commands generated.</li>";
}

async function previewTemplateWorkflow() {
  const selected = findTemplate(nodes.templateSelect.value);
  if (!selected || selected.id === "none") {
    nodes.planSummary.textContent = "Select a quick workflow template first.";
    return;
  }

  if (!nodes.deterministicWorkflow.checked) {
    if (selected.prompt) {
      nodes.promptInput.value = selected.prompt;
    }
    await planOnly();
    return;
  }

  nodes.planSummary.textContent = "Previewing deterministic workflow...";
  try {
    const response = await api("/nova4d/workflows/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflow_id: selected.id,
        options: workflowOptionsPayload(),
        safety: safetyPayload(),
        max_commands: Number(nodes.maxCommands.value || 10),
      }),
    });
    const workflow = response.workflow || {};
    renderWorkflowPreview(
      workflow.name || selected.label,
      response.commands || [],
      response.blocked_commands || [],
      "deterministic preview"
    );
  } catch (err) {
    nodes.planSummary.textContent = `Preview failed: ${err.message}`;
  }
}

async function runTemplateWorkflow() {
  const selected = findTemplate(nodes.templateSelect.value);
  if (!selected || selected.id === "none") {
    nodes.runSummary.textContent = "Select a quick workflow template first.";
    return;
  }
  if (nodes.deterministicWorkflow.checked) {
    nodes.runSummary.textContent = "Running deterministic workflow...";
    try {
      const response = await api("/nova4d/workflows/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow_id: selected.id,
          options: workflowOptionsPayload(),
          safety: safetyPayload(),
          max_commands: Number(nodes.maxCommands.value || 10),
          client_hint: "cinema4d-live",
          requested_by: "workflow:studio-template",
        }),
      });
      const workflow = response.workflow || {};
      const blocked = Array.isArray(response.blocked_commands) ? response.blocked_commands : [];
      const queued = Array.isArray(response.queued) ? response.queued : [];
      const previewCommands = queued.map((item) => ({
        route: item.route,
        payload: {},
        reason: item.action || "",
      }));
      renderWorkflowPreview(workflow.name || selected.label, previewCommands, blocked, "deterministic workflow");

      renderRun({
        plan: { summary: `${workflow.name || selected.label} complete.` },
        queued,
        blocked_commands: blocked,
        scene_context: { enabled: false },
      });
      await loadRecent();
      await loadHealth();
      await loadSystemStatus();
      void maybeAutoMonitorQueued(queued, `${workflow.name || selected.label}`);
      return;
    } catch (err) {
      nodes.runSummary.textContent = `Deterministic workflow failed: ${err.message}`;
      return;
    }
  }

  if (selected.prompt) {
    nodes.promptInput.value = selected.prompt;
  }
  await runPlan();
}

async function runCinematicSmoke() {
  if (nodes.runCinematicSmokeButton.disabled) {
    return;
  }
  const token = cinematicSmokeToken + 1;
  cinematicSmokeToken = token;
  nodes.runCinematicSmokeButton.disabled = true;
  updateCinematicSmokeButtons();
  const options = workflowOptionsPayload();
  renderCinematicSmokeArtifacts(options, []);
  setCinematicSmokeStatus("Queueing cinematic smoke workflow...", "status-warn");
  const startedAt = Date.now();
  try {
    const response = await api("/nova4d/workflows/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflow_id: "cinematic_smoke",
        options,
        safety: safetyPayload(),
        max_commands: Number(nodes.maxCommands.value || 10),
        client_hint: "cinema4d-live",
        requested_by: "workflow:studio-cinematic-smoke",
      }),
    });
    const workflow = response.workflow || { name: "Cinematic Smoke" };
    const queued = Array.isArray(response.queued) ? response.queued : [];
    const blocked = Array.isArray(response.blocked_commands) ? response.blocked_commands : [];
    const stages = buildCinematicSmokeStages(queued, blocked);
    renderCinematicSmokeProgress(stages, new Map());
    const commandIds = queued
      .map((command) => String(command.id || "").trim())
      .filter(Boolean);
    setCinematicSmokeSession({
      workflow_id: "cinematic_smoke",
      workflow_name: workflow.name || "Cinematic Smoke",
      status: commandIds.length ? "running" : "queued",
      started_at: new Date(startedAt).toISOString(),
      ended_at: new Date(startedAt).toISOString(),
      options: response.options || options,
      command_ids: commandIds,
      commands: queued,
      blocked_commands: blocked,
      retries: 0,
      retry_errors: 0,
      last_retry_at: "",
      last_error: "",
    });
    renderRun({
      plan: { summary: `${workflow.name || "Cinematic Smoke"} queued.` },
      queued,
      blocked_commands: blocked,
      scene_context: { enabled: false },
    });
    await loadRecent();
    await loadHealth();
    await loadSystemStatus();

    renderCinematicSmokeArtifacts(response.options || options, commandIds);
    if (!commandIds.length) {
      setCinematicSmokeStatus(
        `${workflow.name || "Cinematic Smoke"}: no commands queued${blocked.length ? ` | blocked ${blocked.length}` : ""}.`,
        blocked.length ? "status-error" : "status-warn"
      );
      const finalized = Object.assign({}, lastCinematicSmokeSession || {}, {
        status: blocked.length ? "blocked" : "queued",
        ended_at: new Date().toISOString(),
      });
      setCinematicSmokeSession(finalized);
      appendCinematicSmokeHistory(finalized);
      setCinematicSmokeHistoryStatus("Saved cinematic smoke session to history.", "hint");
      return;
    }

    void maybeAutoMonitorQueued(queued, workflow.name || "Cinematic Smoke");
    while (Date.now() - startedAt <= CINEMATIC_SMOKE_TIMEOUT_MS) {
      if (token !== cinematicSmokeToken) {
        return;
      }
      const snapshots = await fetchCommandSnapshots(commandIds);
      if (token !== cinematicSmokeToken) {
        return;
      }
      const snapshotById = new Map(
        snapshots.map((snapshot) => [String(snapshot?.id || ""), snapshot])
      );
      renderCinematicSmokeProgress(stages, snapshotById);
      const summary = summarizeCommandStatuses(snapshots);
      const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
      const complete = summary.terminal === summary.total;
      const statusClass = complete
        ? (summary.failed > 0 ? "status-error" : "status-ok")
        : "status-warn";
      setCinematicSmokeStatus(
        `${workflow.name || "Cinematic Smoke"}: ${summary.terminal}/${summary.total} complete | ok ${summary.succeeded} failed ${summary.failed} canceled ${summary.canceled} queued ${summary.queued} dispatched ${summary.dispatched} | ${elapsedSec}s`,
        statusClass
      );
      if (complete) {
        const finalized = Object.assign({}, lastCinematicSmokeSession || {}, {
          status: summary.failed > 0 ? "completed_with_failures" : "completed",
          ended_at: new Date().toISOString(),
          commands: snapshots,
        });
        setCinematicSmokeSession(finalized);
        appendCinematicSmokeHistory(finalized);
        setCinematicSmokeHistoryStatus(
          `Saved cinematic smoke session to history (${summary.total} command${summary.total === 1 ? "" : "s"}).`,
          summary.failed > 0 ? "status-warn" : "hint"
        );
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, RUN_MONITOR_POLL_MS));
    }
    if (token === cinematicSmokeToken) {
      const timeoutSnapshots = await fetchCommandSnapshots(commandIds);
      const finalized = Object.assign({}, lastCinematicSmokeSession || {}, {
        status: "timeout",
        ended_at: new Date().toISOString(),
        commands: timeoutSnapshots,
      });
      setCinematicSmokeSession(finalized);
      appendCinematicSmokeHistory(finalized);
      setCinematicSmokeHistoryStatus("Saved timed-out cinematic smoke session to history.", "status-warn");
      setCinematicSmokeStatus(
        `Cinematic smoke monitor timed out after ${Math.floor(CINEMATIC_SMOKE_TIMEOUT_MS / 1000)}s.`,
        "status-warn"
      );
    }
  } catch (err) {
    const existing = lastCinematicSmokeSession || {};
    const finalized = Object.assign({}, existing, {
      workflow_id: existing.workflow_id || "cinematic_smoke",
      workflow_name: existing.workflow_name || "Cinematic Smoke",
      status: "error",
      started_at: existing.started_at || new Date(startedAt).toISOString(),
      ended_at: new Date().toISOString(),
      options: existing.options || options,
      command_ids: existing.command_ids || [],
      commands: existing.commands || [],
      blocked_commands: existing.blocked_commands || [],
      last_error: err.message,
    });
    setCinematicSmokeSession(finalized);
    appendCinematicSmokeHistory(finalized);
    setCinematicSmokeHistoryStatus("Saved failed cinematic smoke session to history.", "status-error");
    setCinematicSmokeStatus(`Cinematic smoke run failed: ${err.message}`, "status-error");
  } finally {
    if (token === cinematicSmokeToken) {
      nodes.runCinematicSmokeButton.disabled = false;
      updateCinematicSmokeButtons();
    }
  }
}

async function waitForCommand(commandId, timeoutMs = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const response = await api(`/nova4d/commands/${encodeURIComponent(commandId)}`);
    const command = response.command || {};
    if (["succeeded", "failed", "canceled"].includes(command.status)) {
      return command;
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  throw new Error("timed out waiting for command result");
}

async function captureSnapshot() {
  nodes.runSummary.textContent = "Requesting scene snapshot...";
  try {
    const queued = await api("/nova4d/introspection/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ max_objects: 300, max_materials: 120, include_paths: true }),
    });
    const commandId = queued.command_id;
    if (!commandId) {
      throw new Error("snapshot command did not return command_id");
    }
    const final = await waitForCommand(commandId);
    if (final.status !== "succeeded") {
      throw new Error(final.error || `snapshot ${final.status}`);
    }

    const latest = await api("/nova4d/introspection/latest");
    const counts = latest.result?.counts || {};
    nodes.runSummary.textContent = `Snapshot captured | objects ${counts.objects_total ?? 0} | materials ${counts.materials_total ?? 0}`;
    nodes.queuedCommands.innerHTML = `<li><div><span class="code-inline">/nova4d/introspection/scene</span></div><div class="mono small">${escapeHtml(commandId)}</div></li>`;
    await loadRecent();
  } catch (err) {
    nodes.runSummary.textContent = `Snapshot failed: ${err.message}`;
  }
}
