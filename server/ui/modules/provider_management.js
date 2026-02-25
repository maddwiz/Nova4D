/* Provider management module extracted from app.js */
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

function sanitizePromptPresetName(value) {
  return String(value || "").trim().slice(0, PROMPT_PRESET_NAME_LIMIT);
}

function sanitizePromptPresetText(value) {
  return String(value || "").trim().slice(0, PROMPT_PRESET_TEXT_LIMIT);
}

function defaultPromptPresetName() {
  const prompt = sanitizePromptPresetText(nodes.promptInput.value || "");
  if (!prompt) {
    return "prompt-preset";
  }
  const words = prompt.split(/\s+/).filter(Boolean).slice(0, 4);
  return sanitizePromptPresetName(words.join(" ")) || "prompt-preset";
}

function normalizePromptPreset(row) {
  if (!row || typeof row !== "object") {
    return null;
  }
  const name = sanitizePromptPresetName(row.name);
  const prompt = sanitizePromptPresetText(row.prompt);
  if (!name || !prompt) {
    return null;
  }
  return {
    name,
    prompt,
    updated_at: String(row.updated_at || new Date().toISOString()),
  };
}

function loadPromptPresets() {
  try {
    const raw = window.localStorage.getItem(PROMPT_PRESET_SETTINGS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const byName = new Map();
    parsed.forEach((row) => {
      const preset = normalizePromptPreset(row);
      if (!preset) {
        return;
      }
      byName.set(preset.name.toLowerCase(), preset);
    });
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch (_err) {
    return [];
  }
}

function savePromptPresets() {
  try {
    window.localStorage.setItem(PROMPT_PRESET_SETTINGS_KEY, JSON.stringify(promptPresets));
  } catch (_err) {
    // Ignore storage failures in restricted/private browser contexts.
  }
}

function selectedPromptPreset() {
  const selectedName = sanitizePromptPresetName(nodes.promptPresetSelect.value);
  if (!selectedName || selectedName === PROMPT_PRESET_NONE) {
    return null;
  }
  return promptPresets.find((preset) => preset.name === selectedName) || null;
}

function setPromptPresetStatus(text, className = "hint") {
  nodes.promptPresetStatus.textContent = text;
  nodes.promptPresetStatus.className = className;
}

function updatePromptPresetButtons() {
  const hasSelection = Boolean(selectedPromptPreset());
  nodes.promptPresetLoadButton.disabled = !hasSelection;
  nodes.promptPresetDeleteButton.disabled = !hasSelection;
}

function renderPromptPresets(preferredSelection = "") {
  const requested = sanitizePromptPresetName(preferredSelection);
  const previous = sanitizePromptPresetName(nodes.promptPresetSelect.value);
  const targetSelection = requested || previous;
  nodes.promptPresetSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = PROMPT_PRESET_NONE;
  placeholder.textContent = promptPresets.length ? "Select saved preset" : "No saved presets";
  nodes.promptPresetSelect.appendChild(placeholder);

  promptPresets.forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset.name;
    option.textContent = preset.name;
    nodes.promptPresetSelect.appendChild(option);
  });

  if (targetSelection && promptPresets.some((preset) => preset.name === targetSelection)) {
    nodes.promptPresetSelect.value = targetSelection;
  } else {
    nodes.promptPresetSelect.value = PROMPT_PRESET_NONE;
  }
  updatePromptPresetButtons();
}

function saveCurrentPromptPreset() {
  const prompt = sanitizePromptPresetText(nodes.promptInput.value || "");
  if (!prompt) {
    setPromptPresetStatus("Enter a prompt before saving a preset.", "status-warn");
    return;
  }
  const presetName = sanitizePromptPresetName(nodes.promptPresetName.value) || defaultPromptPresetName();
  const preset = normalizePromptPreset({
    name: presetName,
    prompt,
    updated_at: new Date().toISOString(),
  });
  if (!preset) {
    setPromptPresetStatus("Enter a valid preset name before saving.", "status-warn");
    return;
  }

  const existingIndex = promptPresets.findIndex((item) => item.name.toLowerCase() === preset.name.toLowerCase());
  if (existingIndex >= 0) {
    promptPresets.splice(existingIndex, 1, preset);
  } else {
    promptPresets.push(preset);
  }
  promptPresets.sort((a, b) => a.name.localeCompare(b.name));
  savePromptPresets();
  renderPromptPresets(preset.name);
  nodes.promptPresetName.value = preset.name;
  setPromptPresetStatus(`Saved preset "${preset.name}".`, "status-ok");
  saveStudioSettings();
}

function loadSelectedPromptPreset() {
  const preset = selectedPromptPreset();
  if (!preset) {
    setPromptPresetStatus("Select a saved preset first.", "status-warn");
    return;
  }
  nodes.promptInput.value = preset.prompt;
  nodes.promptPresetName.value = preset.name;
  setPromptPresetStatus(`Loaded preset "${preset.name}".`, "status-ok");
  saveStudioSettings();
}

function deleteSelectedPromptPreset() {
  const preset = selectedPromptPreset();
  if (!preset) {
    setPromptPresetStatus("Select a saved preset to delete.", "status-warn");
    return;
  }
  const confirmed = window.confirm(`Delete prompt preset "${preset.name}"?`);
  if (!confirmed) {
    return;
  }
  promptPresets = promptPresets.filter((item) => item.name !== preset.name);
  savePromptPresets();
  renderPromptPresets();
  nodes.promptPresetName.value = "";
  setPromptPresetStatus(`Deleted preset "${preset.name}".`, "hint");
  saveStudioSettings();
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

async function ensureProviderReady() {
  const kind = normalizeProviderKind(nodes.providerKind.value);
  if (kind === "builtin") {
    return { ok: true, reason: "builtin provider selected" };
  }

  const initial = providerReadinessStep();
  if (initial.status === "pass") {
    return { ok: true, reason: "provider already validated", readiness: initial };
  }

  nodes.runSummary.textContent = "Smart Run: validating provider settings...";
  await testProviderConnection();
  const afterTest = providerReadinessStep();
  if (afterTest.status === "pass") {
    return { ok: true, reason: "provider validation succeeded", readiness: afterTest };
  }

  nodes.runSummary.textContent = `Smart Run blocked: ${afterTest.message}`;
  return { ok: false, reason: "provider validation failed", readiness: afterTest };
}
