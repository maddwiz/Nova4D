/* Run monitor module extracted from app.js */
function setRunMonitorStatus(text, className = "hint") {
  nodes.runMonitorStatus.textContent = text;
  nodes.runMonitorStatus.className = className;
}

function updateRunMonitorButtons() {
  nodes.stopRunMonitorButton.disabled = !runMonitorActive;
  const hasSession = lastRunMonitorCommandIds.length > 0;
  nodes.showMonitorFailuresButton.disabled = !hasSession;
  nodes.retryMonitorFailuresButton.disabled = !hasSession;
  nodes.exportRunMonitorButton.disabled = !hasSession;
  nodes.clearRunMonitorSessionButton.disabled = !hasSession;
}

function setRunMonitorSession(sourceLabel, commandIds, snapshots = []) {
  lastRunMonitorSource = String(sourceLabel || "").trim() || "Run";
  lastRunMonitorCommandIds = Array.from(new Set(
    (commandIds || [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  ));
  lastRunMonitorSnapshots = Array.isArray(snapshots) ? snapshots.slice() : [];
  updateRunMonitorButtons();
}

function stopRunMonitor(reason = "Run monitor stopped.") {
  runMonitorToken += 1;
  runMonitorActive = false;
  updateRunMonitorButtons();
  setRunMonitorStatus(reason, "hint");
}

function clearRunMonitorSession(setStatusMessage = true) {
  runMonitorToken += 1;
  lastRunMonitorSource = "";
  lastRunMonitorCommandIds = [];
  lastRunMonitorSnapshots = [];
  runMonitorActive = false;
  updateRunMonitorButtons();
  if (setStatusMessage) {
    if (nodes.autoMonitorRuns.checked) {
      setRunMonitorStatus("Run monitor session cleared.", "hint");
    } else {
      setRunMonitorStatus("Run monitor session cleared (monitor disabled).", "hint");
    }
  }
}

function runMonitorHistoryId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function sanitizeRunMonitorHistoryCommand(command) {
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

function normalizeRunMonitorHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const id = String(entry.id || "").trim() || runMonitorHistoryId();
  const source = String(entry.source || "Run").trim() || "Run";
  const startedAt = String(entry.started_at || "").trim();
  const endedAt = String(entry.ended_at || "").trim();
  const durationMs = Number.isFinite(Number(entry.duration_ms)) ? Number(entry.duration_ms) : 0;
  const status = String(entry.status || "completed").trim() || "completed";
  const commandIds = Array.from(new Set(
    (Array.isArray(entry.command_ids) ? entry.command_ids : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  ));
  const commands = (Array.isArray(entry.commands) ? entry.commands : [])
    .map((row) => sanitizeRunMonitorHistoryCommand(row))
    .filter(Boolean);
  const summary = summarizeCommandStatuses(commands);
  return {
    id,
    source,
    status,
    started_at: startedAt || new Date().toISOString(),
    ended_at: endedAt || new Date().toISOString(),
    duration_ms: Math.max(0, durationMs),
    command_ids: commandIds.length ? commandIds : commands.map((command) => command.id),
    summary,
    commands,
  };
}

function loadRunMonitorHistory() {
  try {
    const raw = window.localStorage.getItem(RUN_MONITOR_HISTORY_SETTINGS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) => normalizeRunMonitorHistoryEntry(entry))
      .filter(Boolean)
      .slice(0, RUN_MONITOR_HISTORY_MAX);
  } catch (_err) {
    return [];
  }
}

function saveRunMonitorHistory() {
  try {
    window.localStorage.setItem(RUN_MONITOR_HISTORY_SETTINGS_KEY, JSON.stringify(runMonitorHistory));
  } catch (_err) {
    // Ignore storage failures in restricted/private browser contexts.
  }
}

function selectedRunMonitorHistoryEntry() {
  const selectedId = String(nodes.runMonitorHistorySelect.value || "").trim();
  if (!selectedId || selectedId === RUN_MONITOR_HISTORY_NONE) {
    return null;
  }
  return runMonitorHistory.find((entry) => entry.id === selectedId) || null;
}

function setRunMonitorHistoryStatus(text, className = "hint") {
  nodes.runMonitorHistoryStatus.textContent = text;
  nodes.runMonitorHistoryStatus.className = className;
}

function updateRunMonitorHistoryButtons() {
  const hasSelected = Boolean(selectedRunMonitorHistoryEntry());
  nodes.loadRunMonitorHistoryButton.disabled = !hasSelected;
  nodes.exportRunMonitorHistoryButton.disabled = !hasSelected;
  nodes.clearRunMonitorHistoryButton.disabled = runMonitorHistory.length === 0;
}

function formatRunMonitorHistoryOption(entry) {
  const ended = Number.isFinite(Date.parse(entry.ended_at))
    ? new Date(entry.ended_at).toLocaleString()
    : entry.ended_at;
  const summary = entry.summary || {};
  const ok = summary.succeeded || 0;
  const failed = summary.failed || 0;
  const canceled = summary.canceled || 0;
  return `${ended} | ${entry.source} | ok ${ok} fail ${failed} canceled ${canceled}`;
}

function renderRunMonitorHistory(preferredId = "") {
  const requested = String(preferredId || "").trim();
  const previous = String(nodes.runMonitorHistorySelect.value || "").trim();
  const targetSelection = requested || previous;
  nodes.runMonitorHistorySelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = RUN_MONITOR_HISTORY_NONE;
  placeholder.textContent = runMonitorHistory.length ? "Select monitor history session" : "No run monitor history";
  nodes.runMonitorHistorySelect.appendChild(placeholder);

  runMonitorHistory.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = formatRunMonitorHistoryOption(entry);
    nodes.runMonitorHistorySelect.appendChild(option);
  });

  if (targetSelection && runMonitorHistory.some((entry) => entry.id === targetSelection)) {
    nodes.runMonitorHistorySelect.value = targetSelection;
  } else {
    nodes.runMonitorHistorySelect.value = RUN_MONITOR_HISTORY_NONE;
  }
  updateRunMonitorHistoryButtons();
}

function appendRunMonitorHistory(entry) {
  const normalized = normalizeRunMonitorHistoryEntry(entry);
  if (!normalized) {
    return;
  }
  runMonitorHistory = [normalized]
    .concat(runMonitorHistory.filter((existing) => existing.id !== normalized.id))
    .slice(0, RUN_MONITOR_HISTORY_MAX);
  saveRunMonitorHistory();
  renderRunMonitorHistory(normalized.id);
}

function captureRunMonitorHistorySession(
  sourceLabel,
  commandIds,
  snapshots,
  status = "completed",
  startedAtMs = Date.now(),
  endedAtMs = Date.now()
) {
  const started = Number.isFinite(Number(startedAtMs)) ? Number(startedAtMs) : Date.now();
  const ended = Number.isFinite(Number(endedAtMs)) ? Number(endedAtMs) : Date.now();
  const safeEnded = Math.max(started, ended);
  appendRunMonitorHistory({
    source: String(sourceLabel || "").trim() || "Run",
    status: String(status || "completed").trim() || "completed",
    started_at: new Date(started).toISOString(),
    ended_at: new Date(safeEnded).toISOString(),
    duration_ms: safeEnded - started,
    command_ids: commandIds,
    commands: Array.isArray(snapshots) ? snapshots : [],
  });
}

function clearRunMonitorHistory() {
  runMonitorHistory = [];
  saveRunMonitorHistory();
  renderRunMonitorHistory();
  setRunMonitorHistoryStatus("Run monitor history cleared.", "hint");
}

async function exportRunMonitorHistoryEntry(entry) {
  const selected = normalizeRunMonitorHistoryEntry(entry);
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
    anchor.download = `nova4d-run-monitor-history-${stamp}.json`;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
    setRunMonitorHistoryStatus("Exported selected run monitor history session.", "status-ok");
    return true;
  } catch (_err) {
    setRunMonitorHistoryStatus("Failed to export selected run monitor history session.", "status-error");
    return false;
  }
}

function loadRunMonitorHistoryEntry(entry) {
  const selected = normalizeRunMonitorHistoryEntry(entry);
  if (!selected) {
    nodes.runSummary.textContent = "Select a monitor history session first.";
    return false;
  }
  setRunMonitorSession(selected.source, selected.command_ids, selected.commands);
  runMonitorActive = false;
  updateRunMonitorButtons();
  lastRunMonitorSnapshots = selected.commands.slice();
  const summary = selected.summary || summarizeCommandStatuses(selected.commands);
  const duration = Number.isFinite(Number(selected.duration_ms))
    ? Math.floor(Number(selected.duration_ms) / 1000)
    : 0;
  setRunMonitorStatus(
    `${selected.source}: history loaded | ok ${summary.succeeded || 0} failed ${summary.failed || 0} canceled ${summary.canceled || 0} | ${duration}s`,
    summary.failed > 0 ? "status-error" : "hint"
  );
  const failures = selected.commands.filter((command) => {
    const status = normalizeCommandStatus(command?.status);
    return status === "failed" || status === "canceled";
  });
  if (failures.length) {
    renderMonitorFailureList(failures, `${selected.source} history`);
  } else {
    nodes.queuedCommands.innerHTML = "<li class='hint'>No failed commands in selected history session.</li>";
    nodes.runSummary.textContent = `${selected.source}: loaded history session with no failures.`;
  }
  setRunMonitorHistoryStatus("Loaded selected run monitor history session.", "status-ok");
  return true;
}

function latestRunMonitorHistoryEntry() {
  if (!runMonitorHistory.length) {
    return null;
  }
  return runMonitorHistory[0] || null;
}

function runMonitorHistoryEntryByIndex(rawIndex) {
  const parsed = Number.parseInt(String(rawIndex || ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }
  const index = parsed - 1;
  if (index >= runMonitorHistory.length) {
    return null;
  }
  return {
    index: parsed,
    entry: runMonitorHistory[index],
  };
}

function normalizeCommandStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) {
    return "unknown";
  }
  return normalized;
}

function summarizeCommandStatuses(commands) {
  const summary = {
    total: Array.isArray(commands) ? commands.length : 0,
    queued: 0,
    dispatched: 0,
    succeeded: 0,
    failed: 0,
    canceled: 0,
    unknown: 0,
    terminal: 0,
  };
  (commands || []).forEach((command) => {
    const status = normalizeCommandStatus(command?.status);
    if (status === "queued") {
      summary.queued += 1;
    } else if (status === "dispatched") {
      summary.dispatched += 1;
    } else if (status === "succeeded") {
      summary.succeeded += 1;
    } else if (status === "failed") {
      summary.failed += 1;
    } else if (status === "canceled") {
      summary.canceled += 1;
    } else {
      summary.unknown += 1;
    }
  });
  summary.terminal = summary.succeeded + summary.failed + summary.canceled;
  return summary;
}

async function fetchCommandSnapshots(commandIds) {
  const ids = Array.from(new Set(
    (commandIds || [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  ));
  if (!ids.length) {
    return [];
  }
  const snapshots = await Promise.all(ids.map(async (commandId) => {
    try {
      const response = await api(`/nova4d/commands/${encodeURIComponent(commandId)}`);
      return response.command || { id: commandId, status: "unknown" };
    } catch (_err) {
      return { id: commandId, status: "unknown" };
    }
  }));
  return snapshots;
}

async function ensureLatestRunMonitorSnapshots() {
  if (!lastRunMonitorCommandIds.length) {
    lastRunMonitorSnapshots = [];
    return [];
  }

  const knownIds = new Set(
    (lastRunMonitorSnapshots || [])
      .map((command) => String(command?.id || "").trim())
      .filter(Boolean)
  );
  const hasAll = lastRunMonitorCommandIds.every((commandId) => knownIds.has(commandId));
  if (!hasAll || lastRunMonitorSnapshots.length !== lastRunMonitorCommandIds.length) {
    lastRunMonitorSnapshots = await fetchCommandSnapshots(lastRunMonitorCommandIds);
  }
  return lastRunMonitorSnapshots;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    normalizeCommandStatus,
    summarizeCommandStatuses,
  };
}
