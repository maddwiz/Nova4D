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
  deterministicWorkflow: document.getElementById("deterministicWorkflow"),
  workflowObjectName: document.getElementById("workflowObjectName"),
  workflowClonerName: document.getElementById("workflowClonerName"),
  workflowMaterialName: document.getElementById("workflowMaterialName"),
  workflowFrameStart: document.getElementById("workflowFrameStart"),
  workflowFrameEnd: document.getElementById("workflowFrameEnd"),
  workflowStartValue: document.getElementById("workflowStartValue"),
  workflowEndValue: document.getElementById("workflowEndValue"),
  workflowRenderFrame: document.getElementById("workflowRenderFrame"),
  workflowRenderOutput: document.getElementById("workflowRenderOutput"),
  loadTemplateButton: document.getElementById("loadTemplateButton"),
  previewTemplateButton: document.getElementById("previewTemplateButton"),
  runTemplateButton: document.getElementById("runTemplateButton"),
  promptInput: document.getElementById("promptInput"),
  voiceStatus: document.getElementById("voiceStatus"),
  planSummary: document.getElementById("planSummary"),
  planCommands: document.getElementById("planCommands"),
  runSummary: document.getElementById("runSummary"),
  queuedCommands: document.getElementById("queuedCommands"),
  recentTableBody: document.getElementById("recentTableBody"),
  recentStatusFilter: document.getElementById("recentStatusFilter"),
  retryFailedButton: document.getElementById("retryFailedButton"),
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
  providerProfileSelect: document.getElementById("providerProfileSelect"),
  providerProfileName: document.getElementById("providerProfileName"),
  providerProfileRememberKey: document.getElementById("providerProfileRememberKey"),
  providerProfileApplyButton: document.getElementById("providerProfileApplyButton"),
  providerProfileSaveButton: document.getElementById("providerProfileSaveButton"),
  providerProfileDeleteButton: document.getElementById("providerProfileDeleteButton"),
  providerProfileStatus: document.getElementById("providerProfileStatus"),
  guidedCheckButton: document.getElementById("guidedCheckButton"),
  guidedCheckSummary: document.getElementById("guidedCheckSummary"),
  guidedCheckList: document.getElementById("guidedCheckList"),
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
    prompt: "Create a cube named WorkflowCube, create a Redshift material named WorkflowRedshiftMat, and assign it to WorkflowCube.",
  },
  {
    id: "animate_render",
    label: "Animate + Render",
    prompt: "Create a cube named WorkflowCube, animate WorkflowCube position.x from frame 0 value 0 to frame 30 value 180, then render frame 0 to /tmp/nova4d-template-frame.png.",
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
const PROVIDER_PROFILE_SETTINGS_KEY = "nova4d.studio.provider_profiles.v1";
const PROVIDER_PROFILE_NONE = "__none__";
const PROVIDER_PROFILE_NAME_LIMIT = 80;
let liveStreamSource = null;
let liveStreamReconnectTimer = null;
let liveStreamRefreshTimer = null;
const LIVE_STREAM_RECONNECT_MS = 2000;
const LIVE_STREAM_MAX_EVENTS = 40;
let recentCommandMap = new Map();
let providerProfiles = [];
let providerTestState = {
  tested: false,
  ok: false,
  fingerprint: "",
  mode: "",
  latency_ms: null,
  error: "",
  at: null,
};

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

function normalizeProviderKind(kind) {
  const normalized = String(kind || "").trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(providerDefaults, normalized)) {
    return normalized;
  }
  return "builtin";
}

function sanitizeProviderProfileName(value) {
  return String(value || "").trim().slice(0, PROVIDER_PROFILE_NAME_LIMIT);
}

function defaultProviderProfileName() {
  const kind = normalizeProviderKind(nodes.providerKind.value);
  const model = String(nodes.providerModel.value || "").trim();
  return sanitizeProviderProfileName(model ? `${kind}:${model}` : kind) || "provider-profile";
}

function normalizeProviderProfile(row) {
  if (!row || typeof row !== "object") {
    return null;
  }
  const name = sanitizeProviderProfileName(row.name);
  if (!name) {
    return null;
  }
  return {
    name,
    provider_kind: normalizeProviderKind(row.provider_kind || row.kind),
    provider_base_url: String(row.provider_base_url || row.base_url || "").trim(),
    provider_model: String(row.provider_model || row.model || "").trim(),
    provider_api_key: String(row.provider_api_key || row.api_key || "").trim(),
    updated_at: String(row.updated_at || new Date().toISOString()),
  };
}

function loadProviderProfiles() {
  try {
    const raw = window.localStorage.getItem(PROVIDER_PROFILE_SETTINGS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const byName = new Map();
    parsed.forEach((row) => {
      const profile = normalizeProviderProfile(row);
      if (!profile) {
        return;
      }
      byName.set(profile.name.toLowerCase(), profile);
    });
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch (_err) {
    return [];
  }
}

function saveProviderProfiles() {
  try {
    window.localStorage.setItem(PROVIDER_PROFILE_SETTINGS_KEY, JSON.stringify(providerProfiles));
  } catch (_err) {
    // Ignore storage failures in restricted/private browser contexts.
  }
}

function selectedProviderProfile() {
  const selectedName = sanitizeProviderProfileName(nodes.providerProfileSelect.value);
  if (!selectedName || selectedName === PROVIDER_PROFILE_NONE) {
    return null;
  }
  return providerProfiles.find((profile) => profile.name === selectedName) || null;
}

function updateProviderProfileButtons() {
  const hasSelection = Boolean(selectedProviderProfile());
  nodes.providerProfileApplyButton.disabled = !hasSelection;
  nodes.providerProfileDeleteButton.disabled = !hasSelection;
}

function setProviderProfileStatus(text, className = "hint") {
  nodes.providerProfileStatus.textContent = text;
  nodes.providerProfileStatus.className = className;
}

function renderProviderProfiles(preferredSelection = "") {
  const requested = sanitizeProviderProfileName(preferredSelection);
  const previous = sanitizeProviderProfileName(nodes.providerProfileSelect.value);
  const targetSelection = requested || previous;
  nodes.providerProfileSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = PROVIDER_PROFILE_NONE;
  placeholder.textContent = providerProfiles.length ? "Select saved profile" : "No saved profiles";
  nodes.providerProfileSelect.appendChild(placeholder);

  providerProfiles.forEach((profile) => {
    const option = document.createElement("option");
    option.value = profile.name;
    const modelText = profile.provider_model ? ` | ${profile.provider_model}` : "";
    option.textContent = `${profile.name} (${profile.provider_kind}${modelText})`;
    nodes.providerProfileSelect.appendChild(option);
  });

  if (targetSelection && providerProfiles.some((profile) => profile.name === targetSelection)) {
    nodes.providerProfileSelect.value = targetSelection;
  } else {
    nodes.providerProfileSelect.value = PROVIDER_PROFILE_NONE;
  }
  updateProviderProfileButtons();
}

function saveCurrentProviderProfile() {
  const profileName = sanitizeProviderProfileName(nodes.providerProfileName.value) || defaultProviderProfileName();
  const includeApiKey = Boolean(nodes.providerProfileRememberKey.checked);
  const profile = normalizeProviderProfile({
    name: profileName,
    provider_kind: nodes.providerKind.value || "builtin",
    provider_base_url: (nodes.providerBaseUrl.value || "").trim(),
    provider_model: (nodes.providerModel.value || "").trim(),
    provider_api_key: includeApiKey ? (nodes.providerApiKey.value || "").trim() : "",
    updated_at: new Date().toISOString(),
  });
  if (!profile) {
    setProviderProfileStatus("Enter a valid profile name before saving.", "status-warn");
    return;
  }

  const existingIndex = providerProfiles.findIndex((item) => item.name.toLowerCase() === profile.name.toLowerCase());
  if (existingIndex >= 0) {
    providerProfiles.splice(existingIndex, 1, profile);
  } else {
    providerProfiles.push(profile);
  }
  providerProfiles.sort((a, b) => a.name.localeCompare(b.name));
  saveProviderProfiles();
  renderProviderProfiles(profile.name);
  nodes.providerProfileName.value = profile.name;
  const keyMessage = includeApiKey ? " API key stored." : " API key not stored.";
  setProviderProfileStatus(`Saved profile "${profile.name}".${keyMessage}`, "status-ok");
}

function applySelectedProviderProfile() {
  const profile = selectedProviderProfile();
  if (!profile) {
    setProviderProfileStatus("Choose a saved profile first.", "status-warn");
    return;
  }
  nodes.providerKind.value = profile.provider_kind;
  nodes.providerBaseUrl.value = profile.provider_base_url;
  nodes.providerModel.value = profile.provider_model;
  if (profile.provider_api_key) {
    nodes.providerApiKey.value = profile.provider_api_key;
  } else {
    nodes.providerApiKey.value = "";
  }
  nodes.providerProfileName.value = profile.name;
  applyProviderDefaults();
  invalidateProviderTestState();
  setProviderStatus(`Loaded provider profile "${profile.name}". Test before running.`, "hint");
  setProviderProfileStatus(
    profile.provider_api_key
      ? `Applied profile "${profile.name}" with stored API key.`
      : `Applied profile "${profile.name}" without stored API key.`,
    "status-ok"
  );
  saveStudioSettings();
}

function deleteSelectedProviderProfile() {
  const profile = selectedProviderProfile();
  if (!profile) {
    setProviderProfileStatus("Choose a saved profile to delete.", "status-warn");
    return;
  }
  const confirmed = window.confirm(`Delete provider profile "${profile.name}"?`);
  if (!confirmed) {
    return;
  }
  providerProfiles = providerProfiles.filter((item) => item.name !== profile.name);
  saveProviderProfiles();
  renderProviderProfiles();
  nodes.providerProfileName.value = "";
  setProviderProfileStatus(`Deleted profile "${profile.name}".`, "hint");
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
    deterministic_workflow: Boolean(nodes.deterministicWorkflow.checked),
    recent_status_filter: nodes.recentStatusFilter.value || "",
    workflow_object_name: (nodes.workflowObjectName.value || "").trim(),
    workflow_cloner_name: (nodes.workflowClonerName.value || "").trim(),
    workflow_material_name: (nodes.workflowMaterialName.value || "").trim(),
    workflow_frame_start: String(nodes.workflowFrameStart.value || "0"),
    workflow_frame_end: String(nodes.workflowFrameEnd.value || "30"),
    workflow_start_value: String(nodes.workflowStartValue.value || "0"),
    workflow_end_value: String(nodes.workflowEndValue.value || "180"),
    workflow_render_frame: String(nodes.workflowRenderFrame.value || "0"),
    workflow_render_output: (nodes.workflowRenderOutput.value || "").trim(),
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
  if (typeof settings.deterministic_workflow === "boolean") {
    nodes.deterministicWorkflow.checked = settings.deterministic_workflow;
  }
  if (typeof settings.recent_status_filter === "string") {
    nodes.recentStatusFilter.value = settings.recent_status_filter;
  }
  if (typeof settings.workflow_object_name === "string" && settings.workflow_object_name) {
    nodes.workflowObjectName.value = settings.workflow_object_name;
  }
  if (typeof settings.workflow_cloner_name === "string" && settings.workflow_cloner_name) {
    nodes.workflowClonerName.value = settings.workflow_cloner_name;
  }
  if (typeof settings.workflow_material_name === "string" && settings.workflow_material_name) {
    nodes.workflowMaterialName.value = settings.workflow_material_name;
  }
  if (typeof settings.workflow_frame_start === "string" && settings.workflow_frame_start) {
    nodes.workflowFrameStart.value = settings.workflow_frame_start;
  }
  if (typeof settings.workflow_frame_end === "string" && settings.workflow_frame_end) {
    nodes.workflowFrameEnd.value = settings.workflow_frame_end;
  }
  if (typeof settings.workflow_start_value === "string" && settings.workflow_start_value) {
    nodes.workflowStartValue.value = settings.workflow_start_value;
  }
  if (typeof settings.workflow_end_value === "string" && settings.workflow_end_value) {
    nodes.workflowEndValue.value = settings.workflow_end_value;
  }
  if (typeof settings.workflow_render_frame === "string" && settings.workflow_render_frame) {
    nodes.workflowRenderFrame.value = settings.workflow_render_frame;
  }
  if (typeof settings.workflow_render_output === "string" && settings.workflow_render_output) {
    nodes.workflowRenderOutput.value = settings.workflow_render_output;
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

async function runGuidedCheck() {
  nodes.guidedCheckSummary.className = "status-warn";
  nodes.guidedCheckSummary.textContent = "Running guided checklist...";
  nodes.guidedCheckList.innerHTML = "<li class='hint'>Checking bridge, setup, worker, and provider...</li>";

  const steps = [];
  let preflightResponse = null;

  try {
    const health = await api("/nova4d/health");
    steps.push({
      status: "pass",
      label: "Bridge connection",
      message: "Nova4D bridge is reachable.",
      details: `pending=${health.queue?.pending_count ?? 0} succeeded=${health.queue?.by_status?.succeeded ?? 0}`,
    });
  } catch (err) {
    steps.push({
      status: "fail",
      label: "Bridge connection",
      message: "Nova4D bridge health request failed.",
      details: err.message,
    });
  }

  try {
    preflightResponse = await api("/nova4d/system/preflight?probe_worker=true");
    const overall = normalizeChecklistStatus(preflightResponse.overall_status || "warn");
    const ready = preflightResponse.ready_for_local_use === true;
    const summary = preflightResponse.summary || {};
    steps.push({
      status: ready ? "pass" : overall,
      label: "Local readiness",
      message: ready
        ? "Required local checks passed."
        : "Some local checks need attention.",
      details: `pass=${summary.pass || 0} warn=${summary.warn || 0} fail=${summary.fail || 0}`,
    });

    const checks = Array.isArray(preflightResponse.checks) ? preflightResponse.checks : [];
    const workerProbe = checks.find((row) => String(row.id || "") === "worker_probe");
    if (workerProbe) {
      steps.push({
        status: normalizeChecklistStatus(workerProbe.status),
        label: "Worker probe",
        message: String(workerProbe.message || "Worker probe completed."),
        details: workerProbe.details ? JSON.stringify(workerProbe.details) : "",
      });
    } else {
      steps.push({
        status: "warn",
        label: "Worker probe",
        message: "Worker probe result not returned.",
        details: "Run preflight + worker probe again.",
      });
    }
  } catch (err) {
    steps.push({
      status: "fail",
      label: "Local readiness",
      message: "Could not run preflight checks.",
      details: err.message,
    });
    steps.push({
      status: "warn",
      label: "Worker probe",
      message: "Worker probe skipped because preflight failed.",
      details: "",
    });
  }

  steps.push(providerReadinessStep());
  renderGuidedChecklist(steps);

  if (preflightResponse) {
    renderPreflight(preflightResponse);
  }
  await loadHealth();
  await loadSystemStatus();
  await loadRecent();
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
    const params = new URLSearchParams();
    params.set("limit", "20");
    const statusFilter = (nodes.recentStatusFilter.value || "").trim();
    if (statusFilter) {
      params.set("status", statusFilter);
    }
    const recent = await api(`/nova4d/commands/recent?${params.toString()}`);
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

async function retryFailedCommands() {
  const includeCanceled = (nodes.recentStatusFilter.value || "").trim() === "canceled";
  const response = await api("/nova4d/commands/retry-failed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      limit: 50,
      include_canceled: includeCanceled,
    }),
  });
  const count = Number(response.requeued_count || 0);
  nodes.runSummary.textContent = count > 0
    ? `Requeued ${count} failed command${count === 1 ? "" : "s"}.`
    : "No failed commands were requeued.";
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

function parseIntOrFallback(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function parseFloatOrFallback(value, fallback) {
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function workflowOptionsPayload() {
  return {
    object_name: (nodes.workflowObjectName.value || "").trim() || "WorkflowCube",
    cloner_name: (nodes.workflowClonerName.value || "").trim() || "WorkflowCloner",
    material_name: (nodes.workflowMaterialName.value || "").trim() || "WorkflowRedshiftMat",
    frame_start: parseIntOrFallback(nodes.workflowFrameStart.value, 0),
    frame_end: parseIntOrFallback(nodes.workflowFrameEnd.value, 30),
    start_value: parseFloatOrFallback(nodes.workflowStartValue.value, 0),
    end_value: parseFloatOrFallback(nodes.workflowEndValue.value, 180),
    render_frame: parseIntOrFallback(nodes.workflowRenderFrame.value, 0),
    render_output: (nodes.workflowRenderOutput.value || "").trim() || "/tmp/nova4d-workflow-frame.png",
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

function invalidateProviderTestState() {
  providerTestState = {
    tested: false,
    ok: false,
    fingerprint: providerConfigFingerprint(),
    mode: String(nodes.providerKind.value || "unknown"),
    latency_ms: null,
    error: "",
    at: null,
  };
}

function providerConfigFingerprint() {
  const kind = normalizeProviderKind(nodes.providerKind.value);
  const baseUrl = (nodes.providerBaseUrl.value || "").trim();
  const model = (nodes.providerModel.value || "").trim();
  const hasApiKey = (nodes.providerApiKey.value || "").trim() ? "key" : "no-key";
  return [kind, baseUrl, model, hasApiKey].join("|");
}

function normalizeChecklistStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "pass" || normalized === "warn" || normalized === "fail") {
    return normalized;
  }
  return "warn";
}

function renderGuidedChecklist(steps) {
  const rows = Array.isArray(steps) ? steps : [];
  if (!rows.length) {
    nodes.guidedCheckList.innerHTML = "<li class='hint'>No guided checks were run.</li>";
    nodes.guidedCheckSummary.className = "hint";
    nodes.guidedCheckSummary.textContent = "Checklist not run in this session.";
    return;
  }

  const counts = { pass: 0, warn: 0, fail: 0 };
  rows.forEach((item) => {
    const status = normalizeChecklistStatus(item.status);
    counts[status] += 1;
  });
  const overall = counts.fail > 0 ? "fail" : (counts.warn > 0 ? "warn" : "pass");
  nodes.guidedCheckSummary.className = classForStatus(overall);
  nodes.guidedCheckSummary.textContent =
    `Guided check ${overall.toUpperCase()} | pass ${counts.pass} warn ${counts.warn} fail ${counts.fail}`;

  nodes.guidedCheckList.innerHTML = rows.map((item) => {
    const status = normalizeChecklistStatus(item.status);
    const statusClass = classForStatus(status);
    const statusLabel = escapeHtml(status.toUpperCase());
    const label = escapeHtml(item.label || "check");
    const message = escapeHtml(item.message || "");
    const details = item.details ? escapeHtml(String(item.details)) : "";
    return `<li>
      <div><span class="${statusClass}">[${statusLabel}]</span> ${label}</div>
      <div class="hint">${message}</div>
      ${details ? `<div class="mono small">${details}</div>` : ""}
    </li>`;
  }).join("");
}

function providerReadinessStep() {
  const kind = normalizeProviderKind(nodes.providerKind.value);
  if (kind === "builtin") {
    return {
      status: "pass",
      label: "Provider readiness",
      message: "Builtin planner is selected and ready.",
      details: "kind=builtin",
    };
  }

  const fingerprint = providerConfigFingerprint();
  if (!providerTestState.tested) {
    return {
      status: "warn",
      label: "Provider readiness",
      message: "Provider has not been tested in this session.",
      details: "Run \"Test Provider\" once before planning/running.",
    };
  }

  if (providerTestState.fingerprint !== fingerprint) {
    return {
      status: "warn",
      label: "Provider readiness",
      message: "Provider fields changed after the last test.",
      details: "Retest the provider to validate current settings.",
    };
  }

  if (!providerTestState.ok) {
    return {
      status: "fail",
      label: "Provider readiness",
      message: "Last provider test failed.",
      details: providerTestState.error || "Unknown provider error.",
    };
  }

  const latency = Number.isFinite(Number(providerTestState.latency_ms))
    ? `${providerTestState.latency_ms}ms`
    : "unknown";
  return {
    status: "pass",
    label: "Provider readiness",
    message: "Last provider test passed for current settings.",
    details: `mode=${providerTestState.mode || kind} latency=${latency}`,
  };
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
  invalidateProviderTestState();
  setProviderStatus("Provider changed. Test before running.", "hint");
  saveStudioSettings();
});

nodes.useSceneContext.addEventListener("change", () => {
  nodes.refreshSceneContext.disabled = !nodes.useSceneContext.checked;
  saveStudioSettings();
});

nodes.templateSelect.addEventListener("change", saveStudioSettings);
nodes.deterministicWorkflow.addEventListener("change", saveStudioSettings);
nodes.recentStatusFilter.addEventListener("change", async () => {
  saveStudioSettings();
  await loadRecent();
});

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
nodes.retryFailedButton.addEventListener("click", async () => {
  try {
    await retryFailedCommands();
    await loadRecent();
    await loadHealth();
    await loadSystemStatus();
  } catch (err) {
    nodes.runSummary.textContent = `Retry failed error: ${err.message}`;
  }
});
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
nodes.previewTemplateButton.addEventListener("click", previewTemplateWorkflow);
nodes.runTemplateButton.addEventListener("click", runTemplateWorkflow);
nodes.queuePlanButton.addEventListener("click", queueLastPlan);
nodes.providerTestButton.addEventListener("click", testProviderConnection);
nodes.guidedCheckButton.addEventListener("click", runGuidedCheck);
nodes.recentTableBody.addEventListener("click", handleRecentTableAction);
nodes.providerProfileSelect.addEventListener("change", () => {
  const profile = selectedProviderProfile();
  if (profile) {
    nodes.providerProfileName.value = profile.name;
    setProviderProfileStatus(`Selected profile "${profile.name}".`, "hint");
  } else if (providerProfiles.length === 0) {
    setProviderProfileStatus("No provider profiles saved yet.", "hint");
  } else {
    setProviderProfileStatus("Select a saved profile to apply or delete.", "hint");
  }
  updateProviderProfileButtons();
});
nodes.providerProfileApplyButton.addEventListener("click", applySelectedProviderProfile);
nodes.providerProfileSaveButton.addEventListener("click", saveCurrentProviderProfile);
nodes.providerProfileDeleteButton.addEventListener("click", deleteSelectedProviderProfile);
nodes.providerProfileName.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  saveCurrentProviderProfile();
});
nodes.providerProfileRememberKey.addEventListener("change", () => {
  if (nodes.providerProfileRememberKey.checked) {
    setProviderProfileStatus("Profile saves will include provider API key.", "status-warn");
  } else {
    setProviderProfileStatus("Profile saves will exclude provider API key.", "hint");
  }
});

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
  nodes.deterministicWorkflow,
  nodes.workflowObjectName,
  nodes.workflowClonerName,
  nodes.workflowMaterialName,
  nodes.workflowFrameStart,
  nodes.workflowFrameEnd,
  nodes.workflowStartValue,
  nodes.workflowEndValue,
  nodes.workflowRenderFrame,
  nodes.workflowRenderOutput,
  nodes.recentStatusFilter,
].forEach((node) => {
  node.addEventListener("change", saveStudioSettings);
});

[nodes.providerBaseUrl, nodes.providerModel].forEach((node) => {
  node.addEventListener("input", saveStudioSettings);
});

[nodes.providerBaseUrl, nodes.providerModel, nodes.providerApiKey].forEach((node) => {
  node.addEventListener("input", () => {
    invalidateProviderTestState();
    setProviderStatus("Provider changed. Test before running.", "hint");
  });
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
  nodes.deterministicWorkflow.checked = true;
  nodes.workflowObjectName.value = "WorkflowCube";
  nodes.workflowClonerName.value = "WorkflowCloner";
  nodes.workflowMaterialName.value = "WorkflowRedshiftMat";
  nodes.workflowFrameStart.value = "0";
  nodes.workflowFrameEnd.value = "30";
  nodes.workflowStartValue.value = "0";
  nodes.workflowEndValue.value = "180";
  nodes.workflowRenderFrame.value = "0";
  nodes.workflowRenderOutput.value = "/tmp/nova4d-workflow-frame.png";
  nodes.recentStatusFilter.value = "";
  nodes.refreshSceneContext.disabled = false;
  nodes.providerProfileName.value = "";
  nodes.providerProfileRememberKey.checked = false;
  nodes.streamEvents.innerHTML = "<li class='hint'>Waiting for live events...</li>";
  nodes.guidedCheckSummary.className = "hint";
  nodes.guidedCheckSummary.textContent = "Checklist not run in this session.";
  nodes.guidedCheckList.innerHTML = "<li class='hint'>Run guided check to populate readiness results.</li>";
  nodes.preflightChecks.innerHTML = "<li class='hint'>Run preflight to validate local setup.</li>";
  nodes.systemStatusList.innerHTML = "<li class='hint'>Refresh system status to load readiness details.</li>";
  providerProfiles = loadProviderProfiles();
  renderProviderProfiles();
  applyStoredSettings(loadStoredSettings());
  applyProviderDefaults();
  invalidateProviderTestState();
  setProviderStatus("Provider not tested in this session.", "hint");
  if (providerProfiles.length > 0) {
    setProviderProfileStatus("Saved provider profiles loaded.", "hint");
  } else {
    setProviderProfileStatus("No provider profiles saved yet.", "hint");
  }
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
