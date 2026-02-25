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


