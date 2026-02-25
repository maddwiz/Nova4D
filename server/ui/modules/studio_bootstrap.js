/* Studio bootstrap module extracted from app.js */
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
