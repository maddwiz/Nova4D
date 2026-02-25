"use strict";

const nodes = {
  healthBadge: document.getElementById("healthBadge"),
  bridgeInfo: document.getElementById("bridgeInfo"),
  bridgeApiKey: document.getElementById("bridgeApiKey"),
  providerKind: document.getElementById("providerKind"),
  providerBaseUrl: document.getElementById("providerBaseUrl"),
  providerModel: document.getElementById("providerModel"),
  providerApiKey: document.getElementById("providerApiKey"),
  maxCommands: document.getElementById("maxCommands"),
  safetyMode: document.getElementById("safetyMode"),
  allowDangerous: document.getElementById("allowDangerous"),
  useSceneContext: document.getElementById("useSceneContext"),
  refreshSceneContext: document.getElementById("refreshSceneContext"),
  templateSelect: document.getElementById("templateSelect"),
  loadTemplateButton: document.getElementById("loadTemplateButton"),
  runTemplateButton: document.getElementById("runTemplateButton"),
  promptInput: document.getElementById("promptInput"),
  voiceStatus: document.getElementById("voiceStatus"),
  planSummary: document.getElementById("planSummary"),
  planCommands: document.getElementById("planCommands"),
  runSummary: document.getElementById("runSummary"),
  queuedCommands: document.getElementById("queuedCommands"),
  recentTableBody: document.getElementById("recentTableBody"),
  liveStreamEnabled: document.getElementById("liveStreamEnabled"),
  streamStatus: document.getElementById("streamStatus"),
  streamEvents: document.getElementById("streamEvents"),
  preflightButton: document.getElementById("preflightButton"),
  preflightProbeButton: document.getElementById("preflightProbeButton"),
  preflightSummary: document.getElementById("preflightSummary"),
  preflightChecks: document.getElementById("preflightChecks"),
  systemStatusButton: document.getElementById("systemStatusButton"),
  systemStatusSummary: document.getElementById("systemStatusSummary"),
  systemStatusList: document.getElementById("systemStatusList"),
  cancelPendingButton: document.getElementById("cancelPendingButton"),
  refreshButton: document.getElementById("refreshButton"),
  loadRecentButton: document.getElementById("loadRecentButton"),
  voiceStart: document.getElementById("voiceStart"),
  voiceStop: document.getElementById("voiceStop"),
  snapshotButton: document.getElementById("snapshotButton"),
  planButton: document.getElementById("planButton"),
  runButton: document.getElementById("runButton"),
  queuePlanButton: document.getElementById("queuePlanButton"),
  providerTestButton: document.getElementById("providerTestButton"),
  providerStatus: document.getElementById("providerStatus"),
};

const providerDefaults = {
  builtin: { base_url: "", model: "rules-v1" },
  openai: { base_url: "https://api.openai.com", model: "gpt-4o-mini" },
  openrouter: { base_url: "https://openrouter.ai/api", model: "openai/gpt-4o-mini" },
  anthropic: { base_url: "https://api.anthropic.com", model: "claude-3-5-sonnet-latest" },
  "openai-compatible": { base_url: "http://127.0.0.1:1234", model: "gpt-4o-mini" },
};

const WORKFLOW_TEMPLATES = [
  {
    id: "none",
    label: "Custom Prompt",
    prompt: "",
  },
  {
    id: "spawn_cube",
    label: "Spawn Cube",
    prompt: "Create a cube named TemplateCube at position x 0 y 120 z 0.",
  },
  {
    id: "mograph_cloner",
    label: "MoGraph Cloner Setup",
    prompt: "Create a cloner named TemplateCloner and prepare it for cube duplication.",
  },
  {
    id: "redshift_material",
    label: "Redshift Material",
    prompt: "Create a Redshift material named TemplateRedshiftMat and assign it to the main cube object.",
  },
  {
    id: "animate_render",
    label: "Animate + Render",
    prompt: "Animate the main cube position.x from frame 0 value 0 to frame 30 value 180, then render frame 0 to /tmp/nova4d-template-frame.png.",
  },
  {
    id: "full_smoke",
    label: "Full Workflow Smoke",
    prompt: "Create a cube, create a MoGraph cloner, create and assign a Redshift material, animate position from frame 0 to 30, then render frame 0.",
  },
];

let recognition = null;
let lastPlan = null;
const STUDIO_SETTINGS_KEY = "nova4d.studio.settings.v1";
let liveStreamSource = null;
let liveStreamReconnectTimer = null;
let liveStreamRefreshTimer = null;
const LIVE_STREAM_RECONNECT_MS = 2000;
const LIVE_STREAM_MAX_EVENTS = 40;
let recentCommandMap = new Map();

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function authHeaders() {
  const headers = {};
  const key = (nodes.bridgeApiKey.value || "").trim();
  if (key) {
    headers["X-API-Key"] = key;
  }
  return headers;
}

function loadStoredSettings() {
  try {
    const raw = window.localStorage.getItem(STUDIO_SETTINGS_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch (_err) {
    return {};
  }
}

function saveStudioSettings() {
  const settings = {
    provider_kind: nodes.providerKind.value || "builtin",
    provider_base_url: (nodes.providerBaseUrl.value || "").trim(),
    provider_model: (nodes.providerModel.value || "").trim(),
    max_commands: Number(nodes.maxCommands.value || 10),
    safety_mode: nodes.safetyMode.value || "balanced",
    allow_dangerous: Boolean(nodes.allowDangerous.checked),
    use_scene_context: Boolean(nodes.useSceneContext.checked),
    refresh_scene_context: Boolean(nodes.refreshSceneContext.checked),
    live_stream_enabled: Boolean(nodes.liveStreamEnabled.checked),
    selected_template: nodes.templateSelect.value || "none",
  };
  try {
    window.localStorage.setItem(STUDIO_SETTINGS_KEY, JSON.stringify(settings));
  } catch (_err) {
    // Ignore storage failures (private browsing mode, quota limits, etc.).
  }
}

function applyStoredSettings(settings) {
  if (!settings || typeof settings !== "object") {
    return;
  }
  if (typeof settings.provider_kind === "string" && settings.provider_kind) {
    nodes.providerKind.value = settings.provider_kind;
  }
  if (typeof settings.provider_base_url === "string") {
    nodes.providerBaseUrl.value = settings.provider_base_url;
  }
  if (typeof settings.provider_model === "string") {
    nodes.providerModel.value = settings.provider_model;
  }
  if (Number.isFinite(Number(settings.max_commands))) {
    const value = Number(settings.max_commands);
    nodes.maxCommands.value = String(Math.max(1, Math.min(30, value)));
  }
  if (typeof settings.safety_mode === "string" && settings.safety_mode) {
    nodes.safetyMode.value = settings.safety_mode;
  }
  if (typeof settings.allow_dangerous === "boolean") {
    nodes.allowDangerous.checked = settings.allow_dangerous;
  }
  if (typeof settings.use_scene_context === "boolean") {
    nodes.useSceneContext.checked = settings.use_scene_context;
  }
  if (typeof settings.refresh_scene_context === "boolean") {
    nodes.refreshSceneContext.checked = settings.refresh_scene_context;
  }
  if (typeof settings.live_stream_enabled === "boolean") {
    nodes.liveStreamEnabled.checked = settings.live_stream_enabled;
  }
  if (typeof settings.selected_template === "string" && settings.selected_template) {
    nodes.templateSelect.value = settings.selected_template;
  }
}

async function api(path, options = {}) {
  const headers = Object.assign({}, authHeaders(), options.headers || {});
  const response = await fetch(path, Object.assign({}, options, { headers }));
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch (_err) {
    body = { status: "error", error: text || "invalid response" };
  }

  if (!response.ok) {
    throw new Error(body.error || `request failed (${response.status})`);
  }

  return body;
}

function setHealthBadge(ok, text) {
  nodes.healthBadge.textContent = text;
  nodes.healthBadge.className = `health ${ok ? "status-ok" : "status-error"}`;
}

function setStreamStatus(text, className = "hint") {
  nodes.streamStatus.textContent = text;
  nodes.streamStatus.className = className;
}

function classForStatus(status) {
  if (status === "pass") {
    return "status-ok";
  }
  if (status === "warn") {
    return "status-warn";
  }
  if (status === "fail") {
    return "status-error";
  }
  return "hint";
}

function formatAgeMs(inputMs) {
  const ms = Number(inputMs);
  if (!Number.isFinite(ms) || ms < 0) {
    return "unknown";
  }
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ${minutes % 60}m`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function renderSystemStatus(response) {
  const preflight = response.preflight || {};
  const preflightStatus = String(preflight.overall_status || "warn").toLowerCase();
  const preflightClass = classForStatus(preflightStatus);
  const ready = preflight.ready_for_local_use ? "ready" : "not ready";
  const summary = preflight.summary || {};
  nodes.systemStatusSummary.className = preflightClass;
  nodes.systemStatusSummary.textContent =
    `System ${preflightStatus.toUpperCase()} | ${ready} | pass ${summary.pass || 0} warn ${summary.warn || 0} fail ${summary.fail || 0}`;

  const queue = response.queue || {};
  const latestSnapshot = response.latest_snapshot || {};
  const worker = response.recent_worker_activity || {};
  const streamClients = response.stream_clients || {};
  const clients = Array.isArray(streamClients.clients) ? streamClients.clients : [];
  const clientPreview = clients.slice(0, 5).map((item) => String(item.client_id || "unknown"));
  const clientText = clientPreview.length ? clientPreview.join(", ") : "none";

  const snapshotText = latestSnapshot.available
    ? `yes | age ${formatAgeMs(latestSnapshot.age_ms)} | objects ${latestSnapshot.summary?.objects_total ?? 0} | materials ${latestSnapshot.summary?.materials_total ?? 0}`
    : "no";
  const workerText = worker.available
    ? `${worker.route || "unknown"} | ${worker.status || "unknown"} | age ${formatAgeMs(worker.age_ms)}`
    : "no recent worker activity";

  const rows = [
    { label: "Queue", value: `pending ${queue.pending_count || 0} | total ${queue.total_commands || 0}` },
    { label: "Stream Clients", value: `${streamClients.count || 0} | ${clientText}` },
    { label: "Latest Snapshot", value: snapshotText },
    { label: "Recent Worker", value: workerText },
  ];

  nodes.systemStatusList.innerHTML = rows.map((row) => (
    `<li><div>${escapeHtml(row.label)}: <span class="mono small">${escapeHtml(row.value)}</span></div></li>`
  )).join("");
}

async function loadSystemStatus() {
  try {
    const response = await api("/nova4d/system/status");
    renderSystemStatus(response);
  } catch (err) {
    nodes.systemStatusSummary.className = "status-error";
    nodes.systemStatusSummary.textContent = `System status failed: ${err.message}`;
    nodes.systemStatusList.innerHTML = "";
  }
}

function renderPreflight(response) {
  const checks = Array.isArray(response.checks) ? response.checks : [];
  const summary = response.summary || {};
  const overall = String(response.overall_status || "unknown").toLowerCase();
  const ready = response.ready_for_local_use ? "ready" : "not ready";
  const overallClass = classForStatus(overall);
  nodes.preflightSummary.className = overallClass;
  nodes.preflightSummary.textContent =
    `Preflight ${overall.toUpperCase()} | ${ready} | pass ${summary.pass || 0} warn ${summary.warn || 0} fail ${summary.fail || 0}`;

  if (!checks.length) {
    nodes.preflightChecks.innerHTML = "<li class='hint'>No checks returned.</li>";
    return;
  }

  nodes.preflightChecks.innerHTML = checks.map((check) => {
    const status = String(check.status || "unknown").toLowerCase();
    const statusClass = classForStatus(status);
    const statusLabel = escapeHtml(status.toUpperCase());
    const name = escapeHtml(check.name || check.id || "check");
    const message = escapeHtml(check.message || "");
    const required = check.required === false ? "optional" : "required";
    const details = check.details ? escapeHtml(JSON.stringify(check.details)) : "";
    return `<li>
      <div><span class="${statusClass}">[${statusLabel}]</span> ${name} <span class="hint">(${required})</span></div>
      <div class="hint">${message}</div>
      ${details ? `<div class="mono small">${details}</div>` : ""}
    </li>`;
  }).join("");
}

async function runPreflight(probeWorker = false) {
  nodes.preflightSummary.className = "status-warn";
  nodes.preflightSummary.textContent = probeWorker
    ? "Running preflight with worker probe..."
    : "Running preflight...";
  try {
    const query = probeWorker ? "?probe_worker=true" : "";
    const response = await api(`/nova4d/system/preflight${query}`);
    renderPreflight(response);
    await loadSystemStatus();
  } catch (err) {
    nodes.preflightSummary.className = "status-error";
    nodes.preflightSummary.textContent = `Preflight failed: ${err.message}`;
    nodes.preflightChecks.innerHTML = "";
  }
}

function parseEventData(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (_err) {
    return { raw: String(raw || "") };
  }
}

function eventSummary(eventName, payload) {
  if (eventName === "dispatched") {
    const count = Number(payload.count || 0);
    const client = payload.client_id ? ` to ${payload.client_id}` : "";
    return `count=${count}${client}`;
  }
  if (payload.id) {
    return `${payload.id}`;
  }
  return "";
}

function pushStreamEvent(eventName, payload) {
  if (nodes.streamEvents.firstElementChild && nodes.streamEvents.firstElementChild.classList.contains("hint")) {
    nodes.streamEvents.innerHTML = "";
  }
  const ts = payload.ts || new Date().toISOString();
  const time = Number.isFinite(Date.parse(ts))
    ? new Date(ts).toLocaleTimeString()
    : new Date().toLocaleTimeString();
  const summary = eventSummary(eventName, payload);
  const li = document.createElement("li");
  li.textContent = summary ? `${time} | ${eventName} | ${summary}` : `${time} | ${eventName}`;
  nodes.streamEvents.prepend(li);
  while (nodes.streamEvents.children.length > LIVE_STREAM_MAX_EVENTS) {
    nodes.streamEvents.removeChild(nodes.streamEvents.lastElementChild);
  }
}

async function refreshFromStream() {
  if (liveStreamRefreshTimer) {
    return;
  }
  liveStreamRefreshTimer = setTimeout(async () => {
    liveStreamRefreshTimer = null;
    await loadHealth();
    await loadRecent();
    await loadSystemStatus();
  }, 250);
}

function streamUrl() {
  const url = new URL("/nova4d/stream", window.location.origin);
  url.searchParams.set("client_id", "nova4d-studio");
  const key = (nodes.bridgeApiKey.value || "").trim();
  if (key) {
    url.searchParams.set("api_key", key);
  }
  return url.toString();
}

function clearLiveStreamReconnectTimer() {
  if (!liveStreamReconnectTimer) {
    return;
  }
  clearTimeout(liveStreamReconnectTimer);
  liveStreamReconnectTimer = null;
}

function disconnectLiveStream(reason = "Live stream offline.") {
  clearLiveStreamReconnectTimer();
  if (liveStreamSource) {
    liveStreamSource.close();
    liveStreamSource = null;
  }
  setStreamStatus(reason, "hint");
}

function connectLiveStream() {
  disconnectLiveStream("Connecting live stream...");
  if (!nodes.liveStreamEnabled.checked) {
    setStreamStatus("Live stream disabled.", "hint");
    return;
  }

  const source = new EventSource(streamUrl());
  liveStreamSource = source;
  setStreamStatus("Connecting live stream...", "status-warn");

  source.onopen = () => {
    if (liveStreamSource !== source) {
      return;
    }
    setStreamStatus("Live stream connected.", "status-ok");
  };

  source.addEventListener("connected", (event) => {
    if (liveStreamSource !== source) {
      return;
    }
    pushStreamEvent("connected", parseEventData(event.data));
  });

  const queueEvents = ["queued", "dispatched", "succeeded", "failed", "canceled", "requeued"];
  queueEvents.forEach((eventName) => {
    source.addEventListener(eventName, async (event) => {
      if (liveStreamSource !== source) {
        return;
      }
      const payload = parseEventData(event.data);
      pushStreamEvent(eventName, payload);
      await refreshFromStream();
    });
  });

  source.addEventListener("heartbeat", (event) => {
    if (liveStreamSource !== source) {
      return;
    }
    const payload = parseEventData(event.data);
    const stamp = payload.ts || new Date().toISOString();
    const time = Number.isFinite(Date.parse(stamp))
      ? new Date(stamp).toLocaleTimeString()
      : new Date().toLocaleTimeString();
    setStreamStatus(`Live stream connected | heartbeat ${time}`, "status-ok");
  });

  source.onerror = () => {
    if (liveStreamSource !== source) {
      return;
    }
    liveStreamSource.close();
    liveStreamSource = null;
    setStreamStatus("Live stream disconnected. Reconnecting...", "status-warn");
    clearLiveStreamReconnectTimer();
    if (!nodes.liveStreamEnabled.checked) {
      return;
    }
    liveStreamReconnectTimer = setTimeout(() => {
      liveStreamReconnectTimer = null;
      connectLiveStream();
    }, LIVE_STREAM_RECONNECT_MS);
  };
}

async function loadHealth() {
  try {
    const health = await api("/nova4d/health");
    const pending = health.queue?.pending_count ?? 0;
    const succeeded = health.queue?.by_status?.succeeded ?? 0;
    setHealthBadge(true, `Bridge online | pending ${pending} | succeeded ${succeeded}`);
    nodes.bridgeInfo.textContent = JSON.stringify(health, null, 2);
  } catch (err) {
    setHealthBadge(false, `Bridge unavailable: ${err.message}`);
    nodes.bridgeInfo.textContent = err.message;
  }
}

async function loadRecent() {
  try {
    const recent = await api("/nova4d/commands/recent?limit=20");
    const commands = Array.isArray(recent.commands) ? recent.commands : [];
    recentCommandMap = new Map(commands.map((command) => [String(command.id || ""), command]));
    nodes.recentTableBody.innerHTML = commands.map((command) => {
      const shortId = escapeHtml(String(command.id || "").slice(0, 8));
      const route = escapeHtml(command.route || "-");
      const action = escapeHtml(command.action || "-");
      const status = escapeHtml(command.status || "-");
      const delivered = escapeHtml(command.delivered_to || "-");
      const commandId = escapeHtml(command.id || "");
      const statusClass = status === "succeeded"
        ? "status-ok"
        : (status === "failed" ? "status-error" : "status-warn");

      const canCancel = status === "queued" || status === "dispatched";
      const canRequeue = status === "failed" || status === "canceled" || status === "succeeded";
      const controls = [
        `<button class="secondary tiny" data-cmd-action="view" data-cmd-id="${commandId}">View</button>`,
      ];
      if (canRequeue) {
        controls.push(`<button class="secondary tiny" data-cmd-action="requeue" data-cmd-id="${commandId}">Requeue</button>`);
      }
      if (canCancel) {
        controls.push(`<button class="secondary tiny" data-cmd-action="cancel" data-cmd-id="${commandId}">Cancel</button>`);
      }

      return `
        <tr>
          <td><span class="code-inline">${shortId}</span></td>
          <td><span class="mono small">${route}</span></td>
          <td>${action}</td>
          <td class="${statusClass}">${status}</td>
          <td>${delivered}</td>
          <td><div class="table-actions">${controls.join("")}</div></td>
        </tr>
      `;
    }).join("");
    if (!commands.length) {
      nodes.recentTableBody.innerHTML = "<tr><td colspan=\"6\" class=\"hint\">No recent commands yet.</td></tr>";
    }
  } catch (err) {
    nodes.recentTableBody.innerHTML = `<tr><td colspan="6" class="status-error">${escapeHtml(err.message)}</td></tr>`;
  }
}

function showCommandDetails(command) {
  if (!command) {
    nodes.runSummary.textContent = "Command not found.";
    return;
  }
  const summary = `${command.route || command.action || "command"} | ${command.status || "unknown"} | ${command.id || ""}`;
  nodes.runSummary.textContent = summary;
  nodes.queuedCommands.innerHTML = `<li><div class="mono small">${escapeHtml(JSON.stringify(command, null, 2))}</div></li>`;
}

async function viewCommand(commandId) {
  const response = await api(`/nova4d/commands/${encodeURIComponent(commandId)}`);
  showCommandDetails(response.command || null);
}

async function requeueCommand(commandId) {
  await api(`/nova4d/commands/${encodeURIComponent(commandId)}/requeue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  nodes.runSummary.textContent = `Requeued command ${commandId}.`;
}

async function cancelCommand(commandId) {
  const known = recentCommandMap.get(commandId);
  const route = known?.route || commandId;
  const confirmed = window.confirm(`Cancel command ${route}?`);
  if (!confirmed) {
    return;
  }
  await api(`/nova4d/commands/${encodeURIComponent(commandId)}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  nodes.runSummary.textContent = `Canceled command ${commandId}.`;
}

async function cancelPendingCommands() {
  const confirmed = window.confirm("Cancel all queued/dispatched commands?");
  if (!confirmed) {
    return;
  }
  const response = await api("/nova4d/commands/cancel-pending", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const count = Number(response.canceled_count || 0);
  nodes.runSummary.textContent = count > 0
    ? `Canceled ${count} pending command${count === 1 ? "" : "s"}.`
    : "No pending commands to cancel.";
}

async function handleRecentTableAction(event) {
  const button = event.target.closest("button[data-cmd-action]");
  if (!button) {
    return;
  }
  const action = String(button.getAttribute("data-cmd-action") || "");
  const commandId = String(button.getAttribute("data-cmd-id") || "");
  if (!action || !commandId) {
    return;
  }
  try {
    button.disabled = true;
    if (action === "view") {
      await viewCommand(commandId);
    } else if (action === "requeue") {
      await requeueCommand(commandId);
    } else if (action === "cancel") {
      await cancelCommand(commandId);
    }
    await loadRecent();
    await loadHealth();
    await loadSystemStatus();
  } catch (err) {
    nodes.runSummary.textContent = `Command action failed: ${err.message}`;
  } finally {
    button.disabled = false;
  }
}

function providerPayload() {
  return {
    kind: nodes.providerKind.value,
    base_url: (nodes.providerBaseUrl.value || "").trim(),
    model: (nodes.providerModel.value || "").trim(),
    api_key: (nodes.providerApiKey.value || "").trim(),
    temperature: 0.2,
  };
}

function safetyPayload() {
  return {
    mode: nodes.safetyMode.value || "balanced",
    allow_dangerous: Boolean(nodes.allowDangerous.checked),
  };
}

function contextPayload() {
  return {
    use_scene_context: Boolean(nodes.useSceneContext.checked),
    refresh_scene_context: Boolean(nodes.refreshSceneContext.checked),
  };
}

function applyProviderDefaults() {
  const kind = nodes.providerKind.value;
  const defaults = providerDefaults[kind] || providerDefaults.builtin;
  if (!nodes.providerBaseUrl.value.trim()) {
    nodes.providerBaseUrl.value = defaults.base_url;
  }
  if (!nodes.providerModel.value.trim()) {
    nodes.providerModel.value = defaults.model;
  }
}

function setProviderStatus(text, className = "hint") {
  nodes.providerStatus.className = className;
  nodes.providerStatus.textContent = text;
}

function findTemplate(templateId) {
  return WORKFLOW_TEMPLATES.find((item) => item.id === templateId) || WORKFLOW_TEMPLATES[0];
}

function populateTemplateSelect() {
  nodes.templateSelect.innerHTML = WORKFLOW_TEMPLATES.map((item) => (
    `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`
  )).join("");
  if (!nodes.templateSelect.value) {
    nodes.templateSelect.value = "none";
  }
}

function loadTemplatePrompt() {
  const selected = findTemplate(nodes.templateSelect.value);
  if (!selected || !selected.prompt) {
    return;
  }
  nodes.promptInput.value = selected.prompt;
}

function renderPlan(planResponse) {
  lastPlan = planResponse;
  const commands = Array.isArray(planResponse.plan?.commands) ? planResponse.plan.commands : [];
  const blocked = Array.isArray(planResponse.blocked_commands) ? planResponse.blocked_commands : [];
  const contextSource = planResponse.scene_context?.enabled ? ` | ctx ${planResponse.scene_context?.source || "none"}` : "";
  nodes.planSummary.textContent = `${planResponse.plan?.summary || "No summary."} (${commands.length} command${commands.length === 1 ? "" : "s"})${blocked.length ? ` | blocked ${blocked.length}` : ""}${contextSource}`;

  const commandRows = commands.map((command) => {
    const route = escapeHtml(command.route || "");
    const reason = escapeHtml(command.reason || "");
    const payload = escapeHtml(JSON.stringify(command.payload || {}));
    return `<li><div><span class="code-inline">${route}</span></div><div class="hint">${reason}</div><div class="mono small">${payload}</div></li>`;
  });
  const blockedRows = blocked.map((command) => {
    const route = escapeHtml(command.route || "");
    const reason = escapeHtml(command.reason || "blocked");
    return `<li><div><span class="code-inline">${route}</span></div><div class="status-warn">${reason}</div></li>`;
  });
  const rows = commandRows.concat(blockedRows);
  nodes.planCommands.innerHTML = rows.join("");
  if (!rows.length) {
    nodes.planCommands.innerHTML = "<li class='hint'>No commands generated.</li>";
  }
}

function renderRun(runResponse) {
  const queued = Array.isArray(runResponse.queued) ? runResponse.queued : [];
  const blocked = Array.isArray(runResponse.blocked_commands) ? runResponse.blocked_commands : [];
  const contextSource = runResponse.scene_context?.enabled ? ` | ctx ${runResponse.scene_context?.source || "none"}` : "";
  nodes.runSummary.textContent = `${runResponse.plan?.summary || "Run complete."} | queued ${queued.length}${blocked.length ? ` | blocked ${blocked.length}` : ""}${contextSource}`;
  const queuedRows = queued.map((command) => {
    const route = escapeHtml(command.route || "");
    const id = escapeHtml(command.id || "");
    const action = escapeHtml(command.action || "");
    return `<li><div><span class="code-inline">${route}</span></div><div class="mono small">${action} | ${id}</div></li>`;
  });
  const blockedRows = blocked.map((command) => {
    const route = escapeHtml(command.route || "");
    const reason = escapeHtml(command.reason || "blocked");
    return `<li><div><span class="code-inline">${route}</span></div><div class="status-warn">${reason}</div></li>`;
  });
  const rows = queuedRows.concat(blockedRows);
  nodes.queuedCommands.innerHTML = rows.join("");
  if (!rows.length) {
    nodes.queuedCommands.innerHTML = "<li class='hint'>No commands queued.</li>";
  }
}

async function testProviderConnection() {
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
  } catch (err) {
    setProviderStatus(`Provider test failed: ${err.message}`, "status-error");
  }
}

async function planOnly() {
  const input = (nodes.promptInput.value || "").trim();
  if (!input) {
    nodes.planSummary.textContent = "Enter a prompt first.";
    return;
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
        ...contextPayload(),
        max_commands: Number(nodes.maxCommands.value || 10),
      }),
    });
    renderPlan(response);
  } catch (err) {
    nodes.planSummary.textContent = `Plan failed: ${err.message}`;
  }
}

async function runPlan() {
  const input = (nodes.promptInput.value || "").trim();
  if (!input) {
    nodes.runSummary.textContent = "Enter a prompt first.";
    return;
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
  } catch (err) {
    nodes.runSummary.textContent = `Run failed: ${err.message}`;
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
  } catch (err) {
    nodes.runSummary.textContent = `Queue failed: ${err.message}`;
  }
}

async function runTemplateWorkflow() {
  const selected = findTemplate(nodes.templateSelect.value);
  if (!selected || selected.id === "none") {
    nodes.runSummary.textContent = "Select a quick workflow template first.";
    return;
  }
  if (selected.prompt) {
    nodes.promptInput.value = selected.prompt;
  }
  await runPlan();
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

function initVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    nodes.voiceStatus.textContent = "Voice input unavailable in this browser. Use Chrome or Edge for Web Speech API.";
    nodes.voiceStart.disabled = true;
    nodes.voiceStop.disabled = true;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = () => {
    nodes.voiceStatus.textContent = "Listening...";
  };

  recognition.onresult = (event) => {
    let fullTranscript = "";
    for (let i = 0; i < event.results.length; i += 1) {
      fullTranscript += `${event.results[i][0].transcript} `;
    }
    nodes.promptInput.value = fullTranscript.trim();
  };

  recognition.onerror = (event) => {
    nodes.voiceStatus.textContent = `Voice error: ${event.error}`;
  };

  recognition.onend = () => {
    nodes.voiceStatus.textContent = "Voice input stopped.";
  };

  nodes.voiceStart.addEventListener("click", () => {
    try {
      recognition.start();
    } catch (_err) {
      nodes.voiceStatus.textContent = "Voice input is already active.";
    }
  });

  nodes.voiceStop.addEventListener("click", () => {
    recognition.stop();
  });
}

nodes.providerKind.addEventListener("change", () => {
  const kind = nodes.providerKind.value;
  const defaults = providerDefaults[kind] || providerDefaults.builtin;
  nodes.providerBaseUrl.value = defaults.base_url;
  nodes.providerModel.value = defaults.model;
  setProviderStatus("Provider changed. Test before running.", "hint");
  saveStudioSettings();
});

nodes.useSceneContext.addEventListener("change", () => {
  nodes.refreshSceneContext.disabled = !nodes.useSceneContext.checked;
  saveStudioSettings();
});

nodes.templateSelect.addEventListener("change", saveStudioSettings);

nodes.liveStreamEnabled.addEventListener("change", () => {
  saveStudioSettings();
  if (nodes.liveStreamEnabled.checked) {
    connectLiveStream();
  } else {
    disconnectLiveStream("Live stream disabled.");
  }
});

nodes.bridgeApiKey.addEventListener("change", () => {
  if (nodes.liveStreamEnabled.checked) {
    connectLiveStream();
  }
  loadSystemStatus().catch(() => {});
});

nodes.refreshButton.addEventListener("click", loadHealth);
nodes.loadRecentButton.addEventListener("click", loadRecent);
nodes.systemStatusButton.addEventListener("click", loadSystemStatus);
nodes.cancelPendingButton.addEventListener("click", async () => {
  try {
    await cancelPendingCommands();
    await loadRecent();
    await loadHealth();
    await loadSystemStatus();
  } catch (err) {
    nodes.runSummary.textContent = `Cancel pending failed: ${err.message}`;
  }
});
nodes.preflightButton.addEventListener("click", async () => runPreflight(false));
nodes.preflightProbeButton.addEventListener("click", async () => runPreflight(true));
nodes.snapshotButton.addEventListener("click", captureSnapshot);
nodes.planButton.addEventListener("click", planOnly);
nodes.runButton.addEventListener("click", runPlan);
nodes.loadTemplateButton.addEventListener("click", loadTemplatePrompt);
nodes.runTemplateButton.addEventListener("click", runTemplateWorkflow);
nodes.queuePlanButton.addEventListener("click", queueLastPlan);
nodes.providerTestButton.addEventListener("click", testProviderConnection);
nodes.recentTableBody.addEventListener("click", handleRecentTableAction);

[
  nodes.providerBaseUrl,
  nodes.providerModel,
  nodes.maxCommands,
  nodes.safetyMode,
  nodes.allowDangerous,
  nodes.useSceneContext,
  nodes.refreshSceneContext,
  nodes.liveStreamEnabled,
  nodes.templateSelect,
].forEach((node) => {
  node.addEventListener("change", saveStudioSettings);
});

[nodes.providerBaseUrl, nodes.providerModel].forEach((node) => {
  node.addEventListener("input", saveStudioSettings);
});

window.addEventListener("beforeunload", () => {
  disconnectLiveStream("Live stream offline.");
});

(async function init() {
  nodes.providerKind.value = "builtin";
  nodes.safetyMode.value = "balanced";
  nodes.allowDangerous.checked = false;
  nodes.useSceneContext.checked = true;
  nodes.refreshSceneContext.checked = true;
  nodes.liveStreamEnabled.checked = true;
  populateTemplateSelect();
  nodes.templateSelect.value = "none";
  nodes.refreshSceneContext.disabled = false;
  nodes.streamEvents.innerHTML = "<li class='hint'>Waiting for live events...</li>";
  nodes.preflightChecks.innerHTML = "<li class='hint'>Run preflight to validate local setup.</li>";
  nodes.systemStatusList.innerHTML = "<li class='hint'>Refresh system status to load readiness details.</li>";
  applyStoredSettings(loadStoredSettings());
  applyProviderDefaults();
  setProviderStatus("Provider not tested in this session.", "hint");
  setStreamStatus("Live stream offline.", "hint");
  nodes.systemStatusSummary.className = "hint";
  nodes.systemStatusSummary.textContent = "System status not loaded.";
  saveStudioSettings();
  initVoice();
  await loadHealth();
  await loadRecent();
  await loadSystemStatus();
  if (nodes.liveStreamEnabled.checked) {
    connectLiveStream();
  }
})();
