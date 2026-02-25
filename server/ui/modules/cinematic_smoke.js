/* Cinematic smoke module extracted from app.js */
function classForCommandStatus(status) {
  const normalized = normalizeCommandStatus(status);
  if (normalized === "succeeded") {
    return "status-ok";
  }
  if (normalized === "failed" || normalized === "canceled" || normalized === "blocked") {
    return "status-error";
  }
  if (normalized === "queued" || normalized === "dispatched") {
    return "status-warn";
  }
  return "hint";
}

function setCinematicSmokeStatus(text, className = "hint") {
  nodes.cinematicSmokeStatus.textContent = text;
  nodes.cinematicSmokeStatus.className = className;
}

function renderCinematicSmokeArtifacts(options = {}, commandIds = []) {
  const renderOutput = String(options.render_output || "").trim();
  const gltfOutput = String(options.gltf_output || "").trim();
  const safeCommandIds = (commandIds || [])
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  const parts = [];
  if (renderOutput) {
    const href = `file://${encodeURI(renderOutput)}`;
    parts.push(`Render: <a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(renderOutput)}</a>`);
  }
  if (gltfOutput) {
    const href = `file://${encodeURI(gltfOutput)}`;
    parts.push(`glTF: <a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(gltfOutput)}</a>`);
  }
  if (safeCommandIds.length) {
    const commandLinks = safeCommandIds.map((id, index) => {
      const href = `/nova4d/commands/${encodeURIComponent(id)}`;
      return `<a href="${href}" target="_blank" rel="noopener">cmd ${index + 1}</a>`;
    }).join(" ");
    parts.push(`Commands: ${commandLinks}`);
  }
  nodes.cinematicSmokeArtifacts.className = "hint artifact-links";
  nodes.cinematicSmokeArtifacts.innerHTML = parts.length
    ? parts.join(" | ")
    : "Artifacts appear here after run starts.";
}

function buildCinematicSmokeStages(queued, blocked) {
  const stageRows = [];
  (Array.isArray(queued) ? queued : []).forEach((command, index) => {
    stageRows.push({
      id: String(command.id || "").trim(),
      route: String(command.route || "").trim(),
      label: String(command.reason || command.action || command.route || `Stage ${index + 1}`).trim(),
      status: normalizeCommandStatus(command.status || "queued"),
      blocked_reason: "",
    });
  });
  (Array.isArray(blocked) ? blocked : []).forEach((command, index) => {
    stageRows.push({
      id: `blocked-${index + 1}`,
      route: String(command.route || "").trim(),
      label: String(command.reason || command.route || `Blocked ${index + 1}`).trim(),
      status: "blocked",
      blocked_reason: String(command.reason || "blocked").trim(),
    });
  });
  return stageRows;
}

function renderCinematicSmokeProgress(stages, snapshotById = new Map()) {
  const rows = Array.isArray(stages) ? stages : [];
  if (!rows.length) {
    nodes.cinematicSmokeProgress.innerHTML =
      "<li class='hint'>Run cinematic smoke to validate cube/cloner/material/animate/render/glTF import flow.</li>";
    return;
  }
  nodes.cinematicSmokeProgress.innerHTML = rows.map((stage, index) => {
    const snapshot = snapshotById.get(stage.id);
    const status = normalizeCommandStatus(snapshot?.status || stage.status || "queued");
    const statusClass = classForCommandStatus(status);
    const label = escapeHtml(stage.label || stage.route || `Stage ${index + 1}`);
    const route = escapeHtml(stage.route || "");
    const commandId = escapeHtml(snapshot?.id || stage.id || "");
    const reason = stage.blocked_reason
      ? ` | ${escapeHtml(stage.blocked_reason)}`
      : (snapshot?.error ? ` | ${escapeHtml(snapshot.error)}` : "");
    return `<li><div><strong>${index + 1}. ${label}</strong></div><div class="${statusClass}">${escapeHtml(status)}${route ? ` | ${route}` : ""}${commandId ? ` | ${commandId}` : ""}${reason}</div></li>`;
  }).join("");
}

function resetCinematicSmokeProgress() {
  nodes.cinematicSmokeProgress.innerHTML =
    "<li class='hint'>Run cinematic smoke to validate cube/cloner/material/animate/render/glTF import flow.</li>";
}

function sanitizeCinematicSmokeCommand(command) {
  if (!command || typeof command !== "object") {
    return null;
  }
  const id = String(command.id || "").trim();
  if (!id) {
    return null;
  }
  return {
    id,
    route: String(command.route || "").trim(),
    action: String(command.action || "").trim(),
    status: normalizeCommandStatus(command.status),
    error: String(command.error || "").trim(),
  };
}

function cinematicSmokeHistoryId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function normalizeCinematicSmokeHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const id = String(entry.id || "").trim() || cinematicSmokeHistoryId();
  const commands = (Array.isArray(entry.commands) ? entry.commands : [])
    .map((command) => sanitizeCinematicSmokeCommand(command))
    .filter(Boolean);
  const commandIds = Array.from(new Set(
    (Array.isArray(entry.command_ids) ? entry.command_ids : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  ));
  const blocked = (Array.isArray(entry.blocked_commands) ? entry.blocked_commands : [])
    .map((item) => ({
      route: String(item?.route || "").trim(),
      reason: String(item?.reason || "blocked").trim(),
    }));
  const summary = summarizeCommandStatuses(commands);
  return {
    id,
    workflow_id: String(entry.workflow_id || "cinematic_smoke").trim() || "cinematic_smoke",
    workflow_name: String(entry.workflow_name || "Cinematic Smoke").trim() || "Cinematic Smoke",
    status: String(entry.status || "unknown").trim() || "unknown",
    started_at: String(entry.started_at || new Date().toISOString()).trim() || new Date().toISOString(),
    ended_at: String(entry.ended_at || new Date().toISOString()).trim() || new Date().toISOString(),
    options: entry.options && typeof entry.options === "object" ? Object.assign({}, entry.options) : {},
    command_ids: commandIds.length ? commandIds : commands.map((command) => command.id),
    summary,
    commands,
    blocked_commands: blocked,
    retries: Number(entry.retries || 0),
    retry_errors: Number(entry.retry_errors || 0),
    last_retry_at: String(entry.last_retry_at || "").trim(),
    last_error: String(entry.last_error || "").trim(),
  };
}

function loadCinematicSmokeHistory() {
  try {
    const raw = window.localStorage.getItem(CINEMATIC_SMOKE_HISTORY_SETTINGS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) => normalizeCinematicSmokeHistoryEntry(entry))
      .filter(Boolean)
      .slice(0, CINEMATIC_SMOKE_HISTORY_MAX);
  } catch (_err) {
    return [];
  }
}

function saveCinematicSmokeHistory() {
  try {
    window.localStorage.setItem(CINEMATIC_SMOKE_HISTORY_SETTINGS_KEY, JSON.stringify(cinematicSmokeHistory));
  } catch (_err) {
    // Ignore local storage failures.
  }
}

function selectedCinematicSmokeHistoryEntry() {
  const selectedId = String(nodes.cinematicSmokeHistorySelect.value || "").trim();
  if (!selectedId || selectedId === CINEMATIC_SMOKE_HISTORY_NONE) {
    return null;
  }
  return cinematicSmokeHistory.find((entry) => entry.id === selectedId) || null;
}

function setCinematicSmokeHistoryStatus(text, className = "hint") {
  nodes.cinematicSmokeHistoryStatus.textContent = text;
  nodes.cinematicSmokeHistoryStatus.className = className;
}

function formatCinematicSmokeHistoryOption(entry) {
  const ended = Number.isFinite(Date.parse(entry.ended_at))
    ? new Date(entry.ended_at).toLocaleString()
    : entry.ended_at;
  const summary = entry.summary || {};
  return `${ended} | ${entry.status} | ok ${summary.succeeded || 0} fail ${summary.failed || 0} canceled ${summary.canceled || 0}`;
}

function renderCinematicSmokeHistory(preferredId = "") {
  const requested = String(preferredId || "").trim();
  const previous = String(nodes.cinematicSmokeHistorySelect.value || "").trim();
  const targetSelection = requested || previous;
  nodes.cinematicSmokeHistorySelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = CINEMATIC_SMOKE_HISTORY_NONE;
  placeholder.textContent = cinematicSmokeHistory.length ? "Select cinematic smoke session" : "No cinematic smoke history";
  nodes.cinematicSmokeHistorySelect.appendChild(placeholder);

  cinematicSmokeHistory.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = formatCinematicSmokeHistoryOption(entry);
    nodes.cinematicSmokeHistorySelect.appendChild(option);
  });

  if (targetSelection && cinematicSmokeHistory.some((entry) => entry.id === targetSelection)) {
    nodes.cinematicSmokeHistorySelect.value = targetSelection;
  } else {
    nodes.cinematicSmokeHistorySelect.value = CINEMATIC_SMOKE_HISTORY_NONE;
  }
  updateCinematicSmokeButtons();
}

function appendCinematicSmokeHistory(session) {
  const normalized = normalizeCinematicSmokeHistoryEntry(session);
  if (!normalized) {
    return;
  }
  cinematicSmokeHistory = [normalized]
    .concat(cinematicSmokeHistory.filter((entry) => entry.id !== normalized.id))
    .slice(0, CINEMATIC_SMOKE_HISTORY_MAX);
  saveCinematicSmokeHistory();
  renderCinematicSmokeHistory(normalized.id);
}

function latestCinematicSmokeHistoryEntry() {
  if (!cinematicSmokeHistory.length) {
    return null;
  }
  return cinematicSmokeHistory[0] || null;
}

function cinematicSmokeHistoryEntryByIndex(rawIndex) {
  const parsed = Number.parseInt(String(rawIndex || ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }
  const index = parsed - 1;
  if (index >= cinematicSmokeHistory.length) {
    return null;
  }
  return {
    index: parsed,
    entry: cinematicSmokeHistory[index],
  };
}

function clearCinematicSmokeHistory() {
  cinematicSmokeHistory = [];
  saveCinematicSmokeHistory();
  renderCinematicSmokeHistory();
  setCinematicSmokeHistoryStatus("Cinematic smoke history cleared.", "hint");
}

async function exportCinematicSmokeHistoryEntry(entry) {
  const selected = normalizeCinematicSmokeHistoryEntry(entry);
  if (!selected) {
    return false;
  }
  try {
    const payload = {
      exported_at: new Date().toISOString(),
      session: selected,
    };
    const serialized = JSON.stringify(payload, null, 2);
    const blob = new Blob([serialized], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = payload.exported_at.replace(/[:.]/g, "-");
    anchor.href = url;
    anchor.download = `nova4d-cinematic-smoke-history-${stamp}.json`;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
    setCinematicSmokeHistoryStatus("Cinematic smoke history session exported.", "status-ok");
    return true;
  } catch (_err) {
    setCinematicSmokeHistoryStatus("Failed to export cinematic smoke history session.", "status-error");
    return false;
  }
}

function loadCinematicSmokeHistoryEntry(entry) {
  const selected = normalizeCinematicSmokeHistoryEntry(entry);
  if (!selected) {
    setCinematicSmokeHistoryStatus("Select a cinematic smoke history session first.", "status-warn");
    return false;
  }
  setCinematicSmokeSession(selected);
  renderCinematicSmokeArtifacts(selected.options || {}, selected.command_ids || []);
  const stageRows = (selected.commands || []).map((command, index) => ({
    id: command.id,
    route: command.route,
    label: command.action || command.route || `Stage ${index + 1}`,
    status: command.status,
    blocked_reason: "",
  })).concat((selected.blocked_commands || []).map((command, index) => ({
    id: `blocked-history-${index + 1}`,
    route: command.route,
    label: command.reason || command.route || `Blocked ${index + 1}`,
    status: "blocked",
    blocked_reason: command.reason || "blocked",
  })));
  const snapshotById = new Map((selected.commands || []).map((command) => [command.id, command]));
  renderCinematicSmokeProgress(stageRows, snapshotById);
  const summary = selected.summary || summarizeCommandStatuses(selected.commands || []);
  setCinematicSmokeStatus(
    `${selected.workflow_name}: history loaded | ok ${summary.succeeded || 0} failed ${summary.failed || 0} canceled ${summary.canceled || 0}`,
    summary.failed > 0 ? "status-error" : "hint"
  );
  setCinematicSmokeHistoryStatus("Loaded selected cinematic smoke history session.", "status-ok");
  return true;
}

function updateCinematicSmokeButtons() {
  const isRunning = Boolean(nodes.runCinematicSmokeButton.disabled);
  const hasSession = Boolean(lastCinematicSmokeSession);
  const hasCommands = Boolean(lastCinematicSmokeSession?.command_ids?.length);
  const failedCount = Number(lastCinematicSmokeSession?.summary?.failed || 0);
  const hasHistorySelection = Boolean(selectedCinematicSmokeHistoryEntry());
  const hasHistory = cinematicSmokeHistory.length > 0;
  nodes.retryCinematicSmokeFailuresButton.disabled = isRunning || !hasCommands || failedCount <= 0;
  nodes.exportCinematicSmokeReportButton.disabled = isRunning || !hasSession;
  nodes.clearCinematicSmokeSessionButton.disabled = isRunning || !hasSession;
  nodes.loadCinematicSmokeHistoryButton.disabled = isRunning || !hasHistorySelection;
  nodes.exportCinematicSmokeHistoryButton.disabled = isRunning || !hasHistorySelection;
  nodes.clearCinematicSmokeHistoryButton.disabled = isRunning || !hasHistory;
}

function setCinematicSmokeSession(session) {
  if (!session || typeof session !== "object") {
    lastCinematicSmokeSession = null;
    updateCinematicSmokeButtons();
    return;
  }
  const commandIds = Array.from(new Set(
    (Array.isArray(session.command_ids) ? session.command_ids : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  ));
  const commands = (Array.isArray(session.commands) ? session.commands : [])
    .map((command) => sanitizeCinematicSmokeCommand(command))
    .filter(Boolean);
  const summary = summarizeCommandStatuses(commands);
  const blocked = (Array.isArray(session.blocked_commands) ? session.blocked_commands : []).map((item) => ({
    route: String(item?.route || "").trim(),
    reason: String(item?.reason || "blocked").trim(),
  }));
  lastCinematicSmokeSession = {
    workflow_id: String(session.workflow_id || "cinematic_smoke").trim() || "cinematic_smoke",
    workflow_name: String(session.workflow_name || "Cinematic Smoke").trim() || "Cinematic Smoke",
    status: String(session.status || "unknown").trim() || "unknown",
    started_at: String(session.started_at || new Date().toISOString()).trim() || new Date().toISOString(),
    ended_at: String(session.ended_at || new Date().toISOString()).trim() || new Date().toISOString(),
    options: session.options && typeof session.options === "object" ? Object.assign({}, session.options) : {},
    command_ids: commandIds.length ? commandIds : commands.map((command) => command.id),
    summary,
    commands,
    blocked_commands: blocked,
    retries: Number(session.retries || 0),
    retry_errors: Number(session.retry_errors || 0),
    last_retry_at: String(session.last_retry_at || "").trim(),
    last_error: String(session.last_error || "").trim(),
  };
  updateCinematicSmokeButtons();
}

function clearCinematicSmokeSession(setStatusMessage = true) {
  lastCinematicSmokeSession = null;
  updateCinematicSmokeButtons();
  resetCinematicSmokeProgress();
  renderCinematicSmokeArtifacts(workflowOptionsPayload(), []);
  if (setStatusMessage) {
    setCinematicSmokeStatus("Cinematic smoke session cleared.", "hint");
  }
}

async function exportCinematicSmokeReport() {
  if (!lastCinematicSmokeSession) {
    setCinematicSmokeStatus("No cinematic smoke session available to export.", "status-warn");
    return false;
  }
  try {
    const payload = {
      exported_at: new Date().toISOString(),
      session: lastCinematicSmokeSession,
      monitor_status_text: nodes.runMonitorStatus.textContent || "",
      smoke_status_text: nodes.cinematicSmokeStatus.textContent || "",
    };
    const serialized = JSON.stringify(payload, null, 2);
    const blob = new Blob([serialized], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = payload.exported_at.replace(/[:.]/g, "-");
    anchor.href = url;
    anchor.download = `nova4d-cinematic-smoke-${stamp}.json`;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
    setCinematicSmokeStatus("Cinematic smoke report exported.", "status-ok");
    return true;
  } catch (_err) {
    setCinematicSmokeStatus("Failed to export cinematic smoke report.", "status-error");
    return false;
  }
}

async function retryCinematicSmokeFailures() {
  const session = lastCinematicSmokeSession;
  if (!session || !session.command_ids.length) {
    setCinematicSmokeStatus("No cinematic smoke session available to retry.", "status-warn");
    return;
  }
  const snapshots = await fetchCommandSnapshots(session.command_ids);
  const retryable = snapshots.filter((command) => normalizeCommandStatus(command?.status) === "failed");
  if (!retryable.length) {
    setCinematicSmokeStatus("Cinematic smoke: no failed commands to retry.", "hint");
    const finalized = Object.assign({}, session, {
      ended_at: new Date().toISOString(),
      status: "completed",
      commands: snapshots,
    });
    setCinematicSmokeSession(finalized);
    appendCinematicSmokeHistory(finalized);
    setCinematicSmokeHistoryStatus("Saved cinematic smoke retry result to history.", "hint");
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

  if (!requeued) {
    setCinematicSmokeStatus(`Cinematic smoke retry failed (${retryErrors} errors).`, "status-error");
    return;
  }

  setCinematicSmokeStatus(
    `Cinematic smoke retry queued ${requeued}/${retryable.length} failed command${retryable.length === 1 ? "" : "s"}${retryErrors ? ` | retry errors ${retryErrors}` : ""}.`,
    retryErrors ? "status-warn" : "status-ok"
  );
  await loadRecent();
  await loadHealth();
  await loadSystemStatus();
  await maybeAutoMonitorQueued(queuedRows, "Cinematic Smoke retry");
  const refreshed = await fetchCommandSnapshots(session.command_ids);
  const finalized = Object.assign({}, session, {
    ended_at: new Date().toISOString(),
    status: "retry",
    commands: refreshed,
    retries: Number(session.retries || 0) + requeued,
    retry_errors: Number(session.retry_errors || 0) + retryErrors,
    last_retry_at: new Date().toISOString(),
  });
  setCinematicSmokeSession(finalized);
  appendCinematicSmokeHistory(finalized);
  setCinematicSmokeHistoryStatus("Saved cinematic smoke retry session to history.", retryErrors ? "status-warn" : "hint");
}
