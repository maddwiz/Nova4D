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
  workflowGltfOutput: document.getElementById("workflowGltfOutput"),
  loadTemplateButton: document.getElementById("loadTemplateButton"),
  previewTemplateButton: document.getElementById("previewTemplateButton"),
  runTemplateButton: document.getElementById("runTemplateButton"),
  runCinematicSmokeButton: document.getElementById("runCinematicSmokeButton"),
  cinematicSmokeStatus: document.getElementById("cinematicSmokeStatus"),
  cinematicSmokeProgress: document.getElementById("cinematicSmokeProgress"),
  retryCinematicSmokeFailuresButton: document.getElementById("retryCinematicSmokeFailuresButton"),
  exportCinematicSmokeReportButton: document.getElementById("exportCinematicSmokeReportButton"),
  clearCinematicSmokeSessionButton: document.getElementById("clearCinematicSmokeSessionButton"),
  cinematicSmokeHistorySelect: document.getElementById("cinematicSmokeHistorySelect"),
  loadCinematicSmokeHistoryButton: document.getElementById("loadCinematicSmokeHistoryButton"),
  exportCinematicSmokeHistoryButton: document.getElementById("exportCinematicSmokeHistoryButton"),
  clearCinematicSmokeHistoryButton: document.getElementById("clearCinematicSmokeHistoryButton"),
  cinematicSmokeHistoryStatus: document.getElementById("cinematicSmokeHistoryStatus"),
  cinematicSmokeArtifacts: document.getElementById("cinematicSmokeArtifacts"),
  promptInput: document.getElementById("promptInput"),
  promptPresetSelect: document.getElementById("promptPresetSelect"),
  promptPresetName: document.getElementById("promptPresetName"),
  promptPresetLoadButton: document.getElementById("promptPresetLoadButton"),
  promptPresetSaveButton: document.getElementById("promptPresetSaveButton"),
  promptPresetDeleteButton: document.getElementById("promptPresetDeleteButton"),
  promptPresetStatus: document.getElementById("promptPresetStatus"),
  voiceStatus: document.getElementById("voiceStatus"),
  planSummary: document.getElementById("planSummary"),
  planCommands: document.getElementById("planCommands"),
  runSummary: document.getElementById("runSummary"),
  queuedCommands: document.getElementById("queuedCommands"),
  recentTableBody: document.getElementById("recentTableBody"),
  recentStatusFilter: document.getElementById("recentStatusFilter"),
  recentRouteFilter: document.getElementById("recentRouteFilter"),
  recentActionFilter: document.getElementById("recentActionFilter"),
  recentClientFilter: document.getElementById("recentClientFilter"),
  applyRecentFiltersButton: document.getElementById("applyRecentFiltersButton"),
  clearRecentFiltersButton: document.getElementById("clearRecentFiltersButton"),
  exportRecentButton: document.getElementById("exportRecentButton"),
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
  smartRunButton: document.getElementById("smartRunButton"),
  autoMonitorRuns: document.getElementById("autoMonitorRuns"),
  runMonitorStatus: document.getElementById("runMonitorStatus"),
  stopRunMonitorButton: document.getElementById("stopRunMonitorButton"),
  showMonitorFailuresButton: document.getElementById("showMonitorFailuresButton"),
  retryMonitorFailuresButton: document.getElementById("retryMonitorFailuresButton"),
  exportRunMonitorButton: document.getElementById("exportRunMonitorButton"),
  clearRunMonitorSessionButton: document.getElementById("clearRunMonitorSessionButton"),
  runMonitorHistorySelect: document.getElementById("runMonitorHistorySelect"),
  loadRunMonitorHistoryButton: document.getElementById("loadRunMonitorHistoryButton"),
  exportRunMonitorHistoryButton: document.getElementById("exportRunMonitorHistoryButton"),
  clearRunMonitorHistoryButton: document.getElementById("clearRunMonitorHistoryButton"),
  runMonitorHistoryStatus: document.getElementById("runMonitorHistoryStatus"),
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
  {
    id: "cinematic_smoke",
    label: "Cinematic Smoke",
    prompt: "Run a deterministic cinematic smoke pass with cube, cloner, Redshift material, animation, render, and Blender glTF import validation.",
  },
];

let recognition = null;
let lastPlan = null;
const STUDIO_SETTINGS_KEY = "nova4d.studio.settings.v1";
const PROVIDER_PROFILE_SETTINGS_KEY = "nova4d.studio.provider_profiles.v1";
const PROVIDER_PROFILE_NONE = "__none__";
const PROVIDER_PROFILE_NAME_LIMIT = 80;
const PROMPT_PRESET_SETTINGS_KEY = "nova4d.studio.prompt_presets.v1";
const PROMPT_PRESET_NONE = "__none__";
const PROMPT_PRESET_NAME_LIMIT = 80;
const PROMPT_PRESET_TEXT_LIMIT = 12000;
const RUN_MONITOR_HISTORY_SETTINGS_KEY = "nova4d.studio.run_monitor_history.v1";
const RUN_MONITOR_HISTORY_NONE = "__none__";
const RUN_MONITOR_HISTORY_MAX = 30;
const CINEMATIC_SMOKE_HISTORY_SETTINGS_KEY = "nova4d.studio.cinematic_smoke_history.v1";
const CINEMATIC_SMOKE_HISTORY_NONE = "__none__";
const CINEMATIC_SMOKE_HISTORY_MAX = 30;
const VOICE_COMMAND_PREFIX = "nova command";
const VOICE_COMMAND_FALLBACK_PREFIX = "nova";
const VOICE_COMMAND_DEDUP_MS = 2500;
const RUN_MONITOR_POLL_MS = 900;
const RUN_MONITOR_TIMEOUT_MS = 3 * 60 * 1000;
const CINEMATIC_SMOKE_TIMEOUT_MS = 4 * 60 * 1000;
const CINEMATIC_SMOKE_DEFAULT_RENDER_OUTPUT = "/tmp/nova4d-workflow-frame.png";
const CINEMATIC_SMOKE_DEFAULT_GLTF_OUTPUT = "/tmp/nova4d-workflow-smoke.gltf";
let liveStreamSource = null;
let liveStreamReconnectTimer = null;
let liveStreamRefreshTimer = null;
const LIVE_STREAM_RECONNECT_MS = 2000;
const LIVE_STREAM_MAX_EVENTS = 40;
let recentCommandMap = new Map();
let providerProfiles = [];
let promptPresets = [];
let runMonitorHistory = [];
let cinematicSmokeHistory = [];
let providerTestState = {
  tested: false,
  ok: false,
  fingerprint: "",
  mode: "",
  latency_ms: null,
  error: "",
  at: null,
};
let lastVoiceShortcut = { key: "", at: 0 };
let smartRunInProgress = false;
let runMonitorToken = 0;
let runMonitorActive = false;
let cinematicSmokeToken = 0;
let lastCinematicSmokeSession = null;
let lastRunMonitorSource = "";
let lastRunMonitorCommandIds = [];
let lastRunMonitorSnapshots = [];

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
    deterministic_workflow: Boolean(nodes.deterministicWorkflow.checked),
    auto_monitor_runs: Boolean(nodes.autoMonitorRuns.checked),
    selected_prompt_preset: nodes.promptPresetSelect.value || PROMPT_PRESET_NONE,
    prompt_preset_name: (nodes.promptPresetName.value || "").trim(),
    recent_status_filter: nodes.recentStatusFilter.value || "",
    recent_route_filter: (nodes.recentRouteFilter.value || "").trim(),
    recent_action_filter: (nodes.recentActionFilter.value || "").trim(),
    recent_client_filter: (nodes.recentClientFilter.value || "").trim(),
    workflow_object_name: (nodes.workflowObjectName.value || "").trim(),
    workflow_cloner_name: (nodes.workflowClonerName.value || "").trim(),
    workflow_material_name: (nodes.workflowMaterialName.value || "").trim(),
    workflow_frame_start: String(nodes.workflowFrameStart.value || "0"),
    workflow_frame_end: String(nodes.workflowFrameEnd.value || "30"),
    workflow_start_value: String(nodes.workflowStartValue.value || "0"),
    workflow_end_value: String(nodes.workflowEndValue.value || "180"),
    workflow_render_frame: String(nodes.workflowRenderFrame.value || "0"),
    workflow_render_output: (nodes.workflowRenderOutput.value || "").trim(),
    workflow_gltf_output: (nodes.workflowGltfOutput.value || "").trim(),
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
  if (typeof settings.auto_monitor_runs === "boolean") {
    nodes.autoMonitorRuns.checked = settings.auto_monitor_runs;
  }
  if (typeof settings.selected_prompt_preset === "string") {
    nodes.promptPresetSelect.value = settings.selected_prompt_preset;
  }
  if (typeof settings.prompt_preset_name === "string") {
    nodes.promptPresetName.value = settings.prompt_preset_name;
  }
  if (typeof settings.recent_status_filter === "string") {
    nodes.recentStatusFilter.value = settings.recent_status_filter;
  }
  if (typeof settings.recent_route_filter === "string") {
    nodes.recentRouteFilter.value = settings.recent_route_filter;
  }
  if (typeof settings.recent_action_filter === "string") {
    nodes.recentActionFilter.value = settings.recent_action_filter;
  }
  if (typeof settings.recent_client_filter === "string") {
    nodes.recentClientFilter.value = settings.recent_client_filter;
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
  if (typeof settings.workflow_gltf_output === "string" && settings.workflow_gltf_output) {
    nodes.workflowGltfOutput.value = settings.workflow_gltf_output;
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
  const blocked = (Array.isArray(entry.blocked_commands) ? entry.blocked_commands : []).map((item) => ({
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
nodes.promptPresetSelect.addEventListener("change", () => {
  const preset = selectedPromptPreset();
  if (preset) {
    nodes.promptPresetName.value = preset.name;
    setPromptPresetStatus(`Selected preset "${preset.name}".`, "hint");
  } else if (promptPresets.length === 0) {
    setPromptPresetStatus("No prompt presets saved yet.", "hint");
  } else {
    setPromptPresetStatus("Select a preset to load or delete.", "hint");
  }
  updatePromptPresetButtons();
  saveStudioSettings();
});
nodes.promptPresetLoadButton.addEventListener("click", loadSelectedPromptPreset);
nodes.promptPresetSaveButton.addEventListener("click", saveCurrentPromptPreset);
nodes.promptPresetDeleteButton.addEventListener("click", deleteSelectedPromptPreset);
nodes.recentStatusFilter.addEventListener("change", async () => {
  await applyRecentFilters();
});
nodes.autoMonitorRuns.addEventListener("change", () => {
  saveStudioSettings();
  if (nodes.autoMonitorRuns.checked) {
    setRunMonitorStatus("Run monitor enabled.", "hint");
    return;
  }
  stopRunMonitor("Run monitor disabled.");
});
nodes.stopRunMonitorButton.addEventListener("click", () => {
  if (!runMonitorActive) {
    setRunMonitorStatus("Run monitor is not active.", "hint");
    return;
  }
  stopRunMonitor("Run monitor stopped by user.");
});
nodes.showMonitorFailuresButton.addEventListener("click", async () => {
  await showLastRunFailures();
});
nodes.retryMonitorFailuresButton.addEventListener("click", async () => {
  await retryLastRunFailures();
});
nodes.exportRunMonitorButton.addEventListener("click", async () => {
  await exportLastRunMonitorReport();
});
nodes.clearRunMonitorSessionButton.addEventListener("click", () => {
  clearRunMonitorSession(true);
});
nodes.runMonitorHistorySelect.addEventListener("change", () => {
  const selected = selectedRunMonitorHistoryEntry();
  if (!selected) {
    if (runMonitorHistory.length) {
      setRunMonitorHistoryStatus("Select a run monitor history session.", "hint");
    } else {
      setRunMonitorHistoryStatus("No run monitor history yet.", "hint");
    }
  } else {
    setRunMonitorHistoryStatus(
      `Selected ${selected.source} session (${selected.summary.total || selected.commands.length} command${(selected.summary.total || selected.commands.length) === 1 ? "" : "s"}).`,
      "hint"
    );
  }
  updateRunMonitorHistoryButtons();
});
nodes.loadRunMonitorHistoryButton.addEventListener("click", () => {
  const selected = selectedRunMonitorHistoryEntry();
  if (!selected) {
    setRunMonitorHistoryStatus("Select a run monitor history session first.", "status-warn");
    return;
  }
  loadRunMonitorHistoryEntry(selected);
});
nodes.exportRunMonitorHistoryButton.addEventListener("click", async () => {
  const selected = selectedRunMonitorHistoryEntry();
  if (!selected) {
    setRunMonitorHistoryStatus("Select a run monitor history session first.", "status-warn");
    return;
  }
  await exportRunMonitorHistoryEntry(selected);
});
nodes.clearRunMonitorHistoryButton.addEventListener("click", () => {
  clearRunMonitorHistory();
});
nodes.applyRecentFiltersButton.addEventListener("click", async () => {
  await applyRecentFilters();
});
nodes.clearRecentFiltersButton.addEventListener("click", async () => {
  await clearRecentFilters();
});
nodes.exportRecentButton.addEventListener("click", async () => {
  await exportRecentCommands();
});
[nodes.recentRouteFilter, nodes.recentActionFilter, nodes.recentClientFilter].forEach((node) => {
  node.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    await applyRecentFilters();
  });
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
nodes.smartRunButton.addEventListener("click", smartRun);
nodes.runButton.addEventListener("click", runPlan);
nodes.loadTemplateButton.addEventListener("click", loadTemplatePrompt);
nodes.previewTemplateButton.addEventListener("click", previewTemplateWorkflow);
nodes.runTemplateButton.addEventListener("click", runTemplateWorkflow);
nodes.runCinematicSmokeButton.addEventListener("click", runCinematicSmoke);
nodes.retryCinematicSmokeFailuresButton.addEventListener("click", async () => {
  await retryCinematicSmokeFailures();
});
nodes.exportCinematicSmokeReportButton.addEventListener("click", async () => {
  await exportCinematicSmokeReport();
});
nodes.clearCinematicSmokeSessionButton.addEventListener("click", () => {
  clearCinematicSmokeSession(true);
});
nodes.cinematicSmokeHistorySelect.addEventListener("change", () => {
  const selected = selectedCinematicSmokeHistoryEntry();
  if (!selected) {
    if (cinematicSmokeHistory.length) {
      setCinematicSmokeHistoryStatus("Select a cinematic smoke history session.", "hint");
    } else {
      setCinematicSmokeHistoryStatus("No cinematic smoke history yet.", "hint");
    }
  } else {
    setCinematicSmokeHistoryStatus(
      `Selected cinematic smoke session (${selected.summary.total || selected.commands.length} command${(selected.summary.total || selected.commands.length) === 1 ? "" : "s"}).`,
      "hint"
    );
  }
  updateCinematicSmokeButtons();
});
nodes.loadCinematicSmokeHistoryButton.addEventListener("click", () => {
  const selected = selectedCinematicSmokeHistoryEntry();
  if (!selected) {
    setCinematicSmokeHistoryStatus("Select a cinematic smoke history session first.", "status-warn");
    return;
  }
  loadCinematicSmokeHistoryEntry(selected);
});
nodes.exportCinematicSmokeHistoryButton.addEventListener("click", async () => {
  const selected = selectedCinematicSmokeHistoryEntry();
  if (!selected) {
    setCinematicSmokeHistoryStatus("Select a cinematic smoke history session first.", "status-warn");
    return;
  }
  await exportCinematicSmokeHistoryEntry(selected);
});
nodes.clearCinematicSmokeHistoryButton.addEventListener("click", () => {
  clearCinematicSmokeHistory();
});
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
nodes.promptInput.addEventListener("keydown", (event) => {
  void handlePromptKeyboardShortcuts(event);
});
nodes.promptInput.addEventListener("input", () => {
  saveStudioSettings();
});
nodes.promptPresetName.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  saveCurrentPromptPreset();
});
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
  nodes.autoMonitorRuns,
  nodes.templateSelect,
  nodes.deterministicWorkflow,
  nodes.promptPresetSelect,
  nodes.promptPresetName,
  nodes.workflowObjectName,
  nodes.workflowClonerName,
  nodes.workflowMaterialName,
  nodes.workflowFrameStart,
  nodes.workflowFrameEnd,
  nodes.workflowStartValue,
  nodes.workflowEndValue,
  nodes.workflowRenderFrame,
  nodes.workflowRenderOutput,
  nodes.workflowGltfOutput,
  nodes.recentStatusFilter,
  nodes.recentRouteFilter,
  nodes.recentActionFilter,
  nodes.recentClientFilter,
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
  clearRunMonitorSession(false);
  disconnectLiveStream("Live stream offline.");
});

(async function init() {
  nodes.providerKind.value = "builtin";
  nodes.safetyMode.value = "balanced";
  nodes.allowDangerous.checked = false;
  nodes.useSceneContext.checked = true;
  nodes.refreshSceneContext.checked = true;
  nodes.liveStreamEnabled.checked = true;
  nodes.autoMonitorRuns.checked = true;
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
  nodes.workflowRenderOutput.value = CINEMATIC_SMOKE_DEFAULT_RENDER_OUTPUT;
  nodes.workflowGltfOutput.value = CINEMATIC_SMOKE_DEFAULT_GLTF_OUTPUT;
  nodes.promptPresetSelect.value = PROMPT_PRESET_NONE;
  nodes.promptPresetName.value = "";
  nodes.recentStatusFilter.value = "";
  nodes.recentRouteFilter.value = "";
  nodes.recentActionFilter.value = "";
  nodes.recentClientFilter.value = "";
  nodes.refreshSceneContext.disabled = false;
  nodes.providerProfileName.value = "";
  nodes.providerProfileRememberKey.checked = false;
  nodes.streamEvents.innerHTML = "<li class='hint'>Waiting for live events...</li>";
  clearRunMonitorSession(false);
  setRunMonitorStatus("Run monitor idle.", "hint");
  nodes.guidedCheckSummary.className = "hint";
  nodes.guidedCheckSummary.textContent = "Checklist not run in this session.";
  nodes.guidedCheckList.innerHTML = "<li class='hint'>Run guided check to populate readiness results.</li>";
  nodes.preflightChecks.innerHTML = "<li class='hint'>Run preflight to validate local setup.</li>";
  nodes.systemStatusList.innerHTML = "<li class='hint'>Refresh system status to load readiness details.</li>";
  providerProfiles = loadProviderProfiles();
  promptPresets = loadPromptPresets();
  runMonitorHistory = loadRunMonitorHistory();
  cinematicSmokeHistory = loadCinematicSmokeHistory();
  renderProviderProfiles();
  renderPromptPresets();
  renderRunMonitorHistory();
  renderCinematicSmokeHistory();
  applyStoredSettings(loadStoredSettings());
  if (nodes.autoMonitorRuns.checked) {
    setRunMonitorStatus("Run monitor idle.", "hint");
  } else {
    setRunMonitorStatus("Run monitor disabled.", "hint");
  }
  renderPromptPresets(nodes.promptPresetSelect.value);
  applyProviderDefaults();
  invalidateProviderTestState();
  setProviderStatus("Provider not tested in this session.", "hint");
  if (providerProfiles.length > 0) {
    setProviderProfileStatus("Saved provider profiles loaded.", "hint");
  } else {
    setProviderProfileStatus("No provider profiles saved yet.", "hint");
  }
  if (promptPresets.length > 0) {
    setPromptPresetStatus("Saved prompt presets loaded.", "hint");
  } else {
    setPromptPresetStatus("No prompt presets saved yet.", "hint");
  }
  if (runMonitorHistory.length > 0) {
    setRunMonitorHistoryStatus(
      `Loaded ${runMonitorHistory.length} run monitor history session${runMonitorHistory.length === 1 ? "" : "s"}.`,
      "hint"
    );
  } else {
    setRunMonitorHistoryStatus("No run monitor history yet.", "hint");
  }
  if (cinematicSmokeHistory.length > 0) {
    setCinematicSmokeHistoryStatus(
      `Loaded ${cinematicSmokeHistory.length} cinematic smoke history session${cinematicSmokeHistory.length === 1 ? "" : "s"}.`,
      "hint"
    );
  } else {
    setCinematicSmokeHistoryStatus("No cinematic smoke history yet.", "hint");
  }
  setCinematicSmokeStatus("Cinematic smoke test idle.", "hint");
  resetCinematicSmokeProgress();
  renderCinematicSmokeArtifacts(workflowOptionsPayload(), []);
  setCinematicSmokeSession(null);
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
