"use strict";

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
