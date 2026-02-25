/* Voice control module extracted from app.js */
function normalizeVoiceText(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function trimVoicePrompt(input) {
  return String(input || "")
    .replace(/^[:;,\-.!? ]+/, "")
    .trim();
}

function stripVoiceCommandPrefix(normalizedText) {
  if (normalizedText.startsWith(`${VOICE_COMMAND_PREFIX} `)) {
    return normalizedText.slice(VOICE_COMMAND_PREFIX.length).trim();
  }
  if (normalizedText === VOICE_COMMAND_PREFIX) {
    return "";
  }
  if (normalizedText.startsWith(`${VOICE_COMMAND_FALLBACK_PREFIX} `)) {
    return normalizedText.slice(VOICE_COMMAND_FALLBACK_PREFIX.length).trim();
  }
  if (normalizedText === VOICE_COMMAND_FALLBACK_PREFIX) {
    return "";
  }
  return null;
}

function parseVoiceShortcut(rawTranscript) {
  const normalized = normalizeVoiceText(rawTranscript);
  const body = stripVoiceCommandPrefix(normalized);
  if (body === null) {
    return null;
  }
  const command = trimVoicePrompt(body);
  if (!command) {
    return {
      action: "help",
      label: "Show voice command help",
      key: "help",
      prompt: "",
    };
  }

  const smartRunMatch = command.match(/^(smart|safe)\s+run\b(.*)$/);
  if (smartRunMatch) {
    const prompt = trimVoicePrompt(smartRunMatch[2] || "");
    return {
      action: "smart-run",
      label: "Smart run request",
      key: `smart-run|${prompt}`,
      prompt,
    };
  }

  if (/^queue(?:\s+last)?\s+plan$/.test(command)) {
    return { action: "queue-plan", label: "Queue last reviewed plan", key: "queue-plan", prompt: "" };
  }
  if (/^run\s+template$/.test(command)) {
    return { action: "run-template", label: "Run selected template", key: "run-template", prompt: "" };
  }
  if (/^(run\s+)?cinematic\s+smoke(?:\s+test)?$/.test(command)) {
    return { action: "cinematic-smoke", label: "Run cinematic smoke workflow", key: "cinematic-smoke", prompt: "" };
  }
  if (/^retry\s+(?:cinematic\s+smoke|cinematic|smoke)\s+failures$/.test(command)) {
    return {
      action: "retry-cinematic-smoke-failures",
      label: "Retry cinematic smoke failures",
      key: "retry-cinematic-smoke-failures",
      prompt: "",
    };
  }
  if (/^export\s+(?:cinematic\s+smoke|smoke)\s+report$/.test(command)) {
    return {
      action: "export-cinematic-smoke-report",
      label: "Export cinematic smoke report",
      key: "export-cinematic-smoke-report",
      prompt: "",
    };
  }
  if (/^clear\s+(?:cinematic\s+smoke|smoke)\s+session$/.test(command)) {
    return {
      action: "clear-cinematic-smoke-session",
      label: "Clear cinematic smoke session",
      key: "clear-cinematic-smoke-session",
      prompt: "",
    };
  }
  const loadSmokeHistoryIndexMatch = command.match(/^load\s+smoke\s+history(?:\s+session)?\s+#?(\d+)$/);
  if (loadSmokeHistoryIndexMatch) {
    const index = Number.parseInt(loadSmokeHistoryIndexMatch[1], 10);
    return {
      action: "load-smoke-history-index",
      label: `Load cinematic smoke history #${index}`,
      key: `load-smoke-history-index-${index}`,
      prompt: "",
      index,
    };
  }
  const exportSmokeHistoryIndexMatch = command.match(/^export\s+smoke\s+history(?:\s+session)?\s+#?(\d+)$/);
  if (exportSmokeHistoryIndexMatch) {
    const index = Number.parseInt(exportSmokeHistoryIndexMatch[1], 10);
    return {
      action: "export-smoke-history-index",
      label: `Export cinematic smoke history #${index}`,
      key: `export-smoke-history-index-${index}`,
      prompt: "",
      index,
    };
  }
  if (/^load(?:\s+last)?\s+smoke\s+history(?:\s+session)?$/.test(command)) {
    return {
      action: "load-smoke-history",
      label: "Load latest cinematic smoke history",
      key: "load-smoke-history",
      prompt: "",
    };
  }
  if (/^export(?:\s+last)?\s+smoke\s+history(?:\s+session)?$/.test(command)) {
    return {
      action: "export-smoke-history",
      label: "Export latest cinematic smoke history",
      key: "export-smoke-history",
      prompt: "",
    };
  }
  if (/^clear\s+smoke\s+history$/.test(command)) {
    return {
      action: "clear-smoke-history",
      label: "Clear cinematic smoke history",
      key: "clear-smoke-history",
      prompt: "",
    };
  }
  if (/^preview\s+template$/.test(command)) {
    return { action: "preview-template", label: "Preview selected template", key: "preview-template", prompt: "" };
  }
  if (/^(guided|setup)\s+check(?:list)?$/.test(command)) {
    return { action: "guided-check", label: "Run guided checklist", key: "guided-check", prompt: "" };
  }
  if (/^(scene\s+)?snapshot$/.test(command)) {
    return { action: "snapshot", label: "Capture scene snapshot", key: "snapshot", prompt: "" };
  }
  if (/^(test\s+provider|provider\s+test)$/.test(command)) {
    return { action: "provider-test", label: "Test provider connection", key: "provider-test", prompt: "" };
  }
  if (/^show(?:\s+last)?\s+failures$/.test(command)) {
    return { action: "show-failures", label: "Show last monitor failures", key: "show-failures", prompt: "" };
  }
  if (/^retry(?:\s+last)?\s+failures$/.test(command)) {
    return { action: "retry-failures", label: "Retry last monitor failures", key: "retry-failures", prompt: "" };
  }
  if (/^stop\s+monitor$/.test(command)) {
    return { action: "stop-monitor", label: "Stop run monitor", key: "stop-monitor", prompt: "" };
  }
  if (/^export(?:\s+last)?\s+monitor(?:\s+report)?$/.test(command)) {
    return { action: "export-monitor", label: "Export run monitor report", key: "export-monitor", prompt: "" };
  }
  if (/^clear(?:\s+monitor(?:\s+session)?)$/.test(command)) {
    return { action: "clear-monitor-session", label: "Clear run monitor session", key: "clear-monitor-session", prompt: "" };
  }
  const loadHistoryIndexMatch = command.match(/^load(?:\s+monitor)?\s+history(?:\s+session)?\s+#?(\d+)$/);
  if (loadHistoryIndexMatch) {
    const index = Number.parseInt(loadHistoryIndexMatch[1], 10);
    return {
      action: "load-history-session-index",
      label: `Load monitor history session #${index}`,
      key: `load-history-session-index-${index}`,
      prompt: "",
      index,
    };
  }
  const exportHistoryIndexMatch = command.match(/^export(?:\s+monitor)?\s+history(?:\s+session)?\s+#?(\d+)$/);
  if (exportHistoryIndexMatch) {
    const index = Number.parseInt(exportHistoryIndexMatch[1], 10);
    return {
      action: "export-history-session-index",
      label: `Export monitor history session #${index}`,
      key: `export-history-session-index-${index}`,
      prompt: "",
      index,
    };
  }
  if (/^load(?:\s+last)?\s+history(?:\s+session)?$/.test(command)) {
    return { action: "load-history-session", label: "Load latest monitor history session", key: "load-history-session", prompt: "" };
  }
  if (/^export(?:\s+last)?\s+history(?:\s+session)?$/.test(command)) {
    return { action: "export-history-session", label: "Export latest monitor history session", key: "export-history-session", prompt: "" };
  }
  if (/^clear(?:\s+monitor)?\s+history$/.test(command)) {
    return { action: "clear-monitor-history", label: "Clear run monitor history", key: "clear-monitor-history", prompt: "" };
  }
  if (/^(stop|stop\s+listening|end\s+voice)$/.test(command)) {
    return { action: "stop-listening", label: "Stop voice input", key: "stop-listening", prompt: "" };
  }
  if (/^(help|commands)$/.test(command)) {
    return { action: "help", label: "Show voice command help", key: "help", prompt: "" };
  }

  const planRunMatch = command.match(/^(plan|run)\b(.*)$/);
  if (planRunMatch) {
    const action = planRunMatch[1] === "plan" ? "plan" : "run";
    const prompt = trimVoicePrompt(planRunMatch[2] || "");
    return {
      action,
      label: action === "plan" ? "Plan request" : "Run request",
      key: `${action}|${prompt}`,
      prompt,
    };
  }

  return null;
}

function shouldSkipVoiceShortcut(shortcut) {
  const now = Date.now();
  const key = String(shortcut?.key || "");
  if (!key) {
    return false;
  }
  if (lastVoiceShortcut.key === key && now - lastVoiceShortcut.at < VOICE_COMMAND_DEDUP_MS) {
    return true;
  }
  lastVoiceShortcut = { key, at: now };
  return false;
}

async function executeVoiceShortcut(shortcut, previousPrompt = "") {
  if (!shortcut) {
    return false;
  }
  if (shouldSkipVoiceShortcut(shortcut)) {
    return true;
  }
  try {
    if (shortcut.prompt) {
      nodes.promptInput.value = shortcut.prompt;
    } else if (!nodes.promptInput.value.trim() && previousPrompt) {
      nodes.promptInput.value = previousPrompt;
    }

    if (shortcut.action === "help") {
      nodes.voiceStatus.textContent =
        "Voice commands: \"nova command smart run ...\", \"nova command plan ...\", \"nova command run ...\", \"nova command run cinematic smoke\", \"nova command retry smoke failures\", \"nova command export smoke report\", \"nova command load smoke history 2\", \"nova command export smoke history 1\", \"nova command clear smoke history\", \"nova command show failures\", \"nova command retry failures\", \"nova command stop monitor\", \"nova command load last history\", \"nova command load history 2\", \"nova command export history 3\", \"nova command clear history\".";
      return true;
    }

    nodes.voiceStatus.textContent = `Voice command: ${shortcut.label}...`;
    if (shortcut.action === "smart-run") {
      if (!nodes.promptInput.value.trim()) {
        nodes.voiceStatus.textContent = "Voice command requires a prompt. Say: nova command smart run create a cube.";
        return true;
      }
      const ok = await smartRun();
      nodes.voiceStatus.textContent = ok
        ? "Voice command complete: smart run submitted."
        : "Voice command finished with warnings. Check execution summary.";
      return true;
    }
    if (shortcut.action === "plan") {
      if (!nodes.promptInput.value.trim()) {
        nodes.voiceStatus.textContent = "Voice command requires a prompt. Say: nova command plan create a cube.";
        return true;
      }
      const ok = await planOnly();
      nodes.voiceStatus.textContent = ok
        ? "Voice command complete: plan generated."
        : "Voice command finished with warnings. Check plan summary.";
      return true;
    }
    if (shortcut.action === "run") {
      if (!nodes.promptInput.value.trim()) {
        nodes.voiceStatus.textContent = "Voice command requires a prompt. Say: nova command run create a cube.";
        return true;
      }
      const ok = await runPlan();
      nodes.voiceStatus.textContent = ok
        ? "Voice command complete: run submitted."
        : "Voice command finished with warnings. Check execution summary.";
      return true;
    }
    if (shortcut.action === "queue-plan") {
      await queueLastPlan();
      nodes.voiceStatus.textContent = "Voice command complete: queued reviewed plan.";
      return true;
    }
    if (shortcut.action === "run-template") {
      await runTemplateWorkflow();
      nodes.voiceStatus.textContent = "Voice command complete: template run requested.";
      return true;
    }
    if (shortcut.action === "cinematic-smoke") {
      await runCinematicSmoke();
      nodes.voiceStatus.textContent = "Voice command complete: cinematic smoke run requested.";
      return true;
    }
    if (shortcut.action === "retry-cinematic-smoke-failures") {
      await retryCinematicSmokeFailures();
      nodes.voiceStatus.textContent = "Voice command complete: cinematic smoke retry processed.";
      return true;
    }
    if (shortcut.action === "export-cinematic-smoke-report") {
      await exportCinematicSmokeReport();
      nodes.voiceStatus.textContent = "Voice command complete: cinematic smoke export processed.";
      return true;
    }
    if (shortcut.action === "clear-cinematic-smoke-session") {
      clearCinematicSmokeSession(true);
      nodes.voiceStatus.textContent = "Voice command complete: cinematic smoke session cleared.";
      return true;
    }
    if (shortcut.action === "load-smoke-history") {
      const selected = latestCinematicSmokeHistoryEntry();
      if (!selected) {
        setCinematicSmokeHistoryStatus("No cinematic smoke history session available to load.", "status-warn");
        nodes.voiceStatus.textContent = "Voice command finished: no cinematic smoke history session available.";
        return true;
      }
      renderCinematicSmokeHistory(selected.id);
      loadCinematicSmokeHistoryEntry(selected);
      nodes.voiceStatus.textContent = "Voice command complete: latest cinematic smoke history loaded.";
      return true;
    }
    if (shortcut.action === "load-smoke-history-index") {
      const selected = cinematicSmokeHistoryEntryByIndex(shortcut.index);
      if (!selected || !selected.entry) {
        setCinematicSmokeHistoryStatus(`Cinematic smoke history #${shortcut.index} is not available.`, "status-warn");
        nodes.voiceStatus.textContent = `Voice command finished: cinematic smoke history #${shortcut.index} not found.`;
        return true;
      }
      renderCinematicSmokeHistory(selected.entry.id);
      loadCinematicSmokeHistoryEntry(selected.entry);
      nodes.voiceStatus.textContent = `Voice command complete: cinematic smoke history #${selected.index} loaded.`;
      return true;
    }
    if (shortcut.action === "export-smoke-history") {
      const selected = latestCinematicSmokeHistoryEntry();
      if (!selected) {
        setCinematicSmokeHistoryStatus("No cinematic smoke history session available to export.", "status-warn");
        nodes.voiceStatus.textContent = "Voice command finished: no cinematic smoke history session available.";
        return true;
      }
      renderCinematicSmokeHistory(selected.id);
      await exportCinematicSmokeHistoryEntry(selected);
      nodes.voiceStatus.textContent = "Voice command complete: latest cinematic smoke history exported.";
      return true;
    }
    if (shortcut.action === "export-smoke-history-index") {
      const selected = cinematicSmokeHistoryEntryByIndex(shortcut.index);
      if (!selected || !selected.entry) {
        setCinematicSmokeHistoryStatus(`Cinematic smoke history #${shortcut.index} is not available.`, "status-warn");
        nodes.voiceStatus.textContent = `Voice command finished: cinematic smoke history #${shortcut.index} not found.`;
        return true;
      }
      renderCinematicSmokeHistory(selected.entry.id);
      await exportCinematicSmokeHistoryEntry(selected.entry);
      nodes.voiceStatus.textContent = `Voice command complete: cinematic smoke history #${selected.index} exported.`;
      return true;
    }
    if (shortcut.action === "clear-smoke-history") {
      clearCinematicSmokeHistory();
      nodes.voiceStatus.textContent = "Voice command complete: cinematic smoke history cleared.";
      return true;
    }
    if (shortcut.action === "preview-template") {
      await previewTemplateWorkflow();
      nodes.voiceStatus.textContent = "Voice command complete: template preview generated.";
      return true;
    }
    if (shortcut.action === "guided-check") {
      await runGuidedCheck();
      nodes.voiceStatus.textContent = "Voice command complete: guided check finished.";
      return true;
    }
    if (shortcut.action === "snapshot") {
      await captureSnapshot();
      nodes.voiceStatus.textContent = "Voice command complete: scene snapshot captured.";
      return true;
    }
    if (shortcut.action === "provider-test") {
      await testProviderConnection();
      nodes.voiceStatus.textContent = "Voice command complete: provider test finished.";
      return true;
    }
    if (shortcut.action === "show-failures") {
      await showLastRunFailures();
      nodes.voiceStatus.textContent = "Voice command complete: failure list updated.";
      return true;
    }
    if (shortcut.action === "retry-failures") {
      await retryLastRunFailures();
      nodes.voiceStatus.textContent = "Voice command complete: failure retry attempted.";
      return true;
    }
    if (shortcut.action === "stop-monitor") {
      if (runMonitorActive) {
        stopRunMonitor("Run monitor stopped by voice command.");
      } else {
        setRunMonitorStatus("Run monitor is not active.", "hint");
      }
      nodes.voiceStatus.textContent = "Voice command complete: monitor stop processed.";
      return true;
    }
    if (shortcut.action === "export-monitor") {
      await exportLastRunMonitorReport();
      nodes.voiceStatus.textContent = "Voice command complete: monitor export processed.";
      return true;
    }
    if (shortcut.action === "clear-monitor-session") {
      clearRunMonitorSession(true);
      nodes.voiceStatus.textContent = "Voice command complete: monitor session cleared.";
      return true;
    }
    if (shortcut.action === "load-history-session") {
      const selected = latestRunMonitorHistoryEntry();
      if (!selected) {
        setRunMonitorHistoryStatus("No run monitor history session available to load.", "status-warn");
        nodes.voiceStatus.textContent = "Voice command finished: no history session available.";
        return true;
      }
      renderRunMonitorHistory(selected.id);
      loadRunMonitorHistoryEntry(selected);
      nodes.voiceStatus.textContent = "Voice command complete: latest history session loaded.";
      return true;
    }
    if (shortcut.action === "load-history-session-index") {
      const selected = runMonitorHistoryEntryByIndex(shortcut.index);
      if (!selected || !selected.entry) {
        setRunMonitorHistoryStatus(`Run monitor history #${shortcut.index} is not available.`, "status-warn");
        nodes.voiceStatus.textContent = `Voice command finished: history #${shortcut.index} not found.`;
        return true;
      }
      renderRunMonitorHistory(selected.entry.id);
      loadRunMonitorHistoryEntry(selected.entry);
      nodes.voiceStatus.textContent = `Voice command complete: history session #${selected.index} loaded.`;
      return true;
    }
    if (shortcut.action === "export-history-session") {
      const selected = latestRunMonitorHistoryEntry();
      if (!selected) {
        setRunMonitorHistoryStatus("No run monitor history session available to export.", "status-warn");
        nodes.voiceStatus.textContent = "Voice command finished: no history session available.";
        return true;
      }
      renderRunMonitorHistory(selected.id);
      await exportRunMonitorHistoryEntry(selected);
      nodes.voiceStatus.textContent = "Voice command complete: latest history session export processed.";
      return true;
    }
    if (shortcut.action === "export-history-session-index") {
      const selected = runMonitorHistoryEntryByIndex(shortcut.index);
      if (!selected || !selected.entry) {
        setRunMonitorHistoryStatus(`Run monitor history #${shortcut.index} is not available.`, "status-warn");
        nodes.voiceStatus.textContent = `Voice command finished: history #${shortcut.index} not found.`;
        return true;
      }
      renderRunMonitorHistory(selected.entry.id);
      await exportRunMonitorHistoryEntry(selected.entry);
      nodes.voiceStatus.textContent = `Voice command complete: history session #${selected.index} export processed.`;
      return true;
    }
    if (shortcut.action === "clear-monitor-history") {
      clearRunMonitorHistory();
      nodes.voiceStatus.textContent = "Voice command complete: monitor history cleared.";
      return true;
    }
    if (shortcut.action === "stop-listening") {
      if (recognition) {
        recognition.stop();
      }
      nodes.voiceStatus.textContent = "Voice input stopped.";
      return true;
    }
  } catch (err) {
    nodes.voiceStatus.textContent = `Voice command failed: ${err.message}`;
    return true;
  }
  return false;
}

async function handlePromptKeyboardShortcuts(event) {
  if (event.key !== "Enter") {
    return;
  }
  const hasSmartModifier = event.metaKey || event.ctrlKey || event.altKey;
  if (!hasSmartModifier) {
    return;
  }

  event.preventDefault();
  if (event.altKey && !event.metaKey && !event.ctrlKey) {
    nodes.voiceStatus.textContent = "Keyboard shortcut: running selected template...";
    await runTemplateWorkflow();
    nodes.voiceStatus.textContent = "Keyboard shortcut complete: template run requested.";
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.shiftKey) {
    nodes.voiceStatus.textContent = "Keyboard shortcut: planning...";
    const ok = await planOnly();
    nodes.voiceStatus.textContent = ok
      ? "Keyboard shortcut complete: plan generated."
      : "Keyboard shortcut finished with warnings. Check plan summary.";
    return;
  }

  if (event.metaKey || event.ctrlKey) {
    nodes.voiceStatus.textContent = "Keyboard shortcut: smart run...";
    const ok = await smartRun();
    nodes.voiceStatus.textContent = ok
      ? "Keyboard shortcut complete: smart run requested."
      : "Keyboard shortcut finished with warnings. Check execution summary.";
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
    const previousPrompt = (nodes.promptInput.value || "").trim();
    const transcriptParts = [];
    const shortcuts = [];

    for (let i = 0; i < event.results.length; i += 1) {
      const result = event.results[i];
      const transcript = String(result?.[0]?.transcript || "").trim();
      if (!transcript) {
        continue;
      }
      if (result.isFinal) {
        const shortcut = parseVoiceShortcut(transcript);
        if (shortcut) {
          shortcuts.push(shortcut);
          continue;
        }
      }
      transcriptParts.push(transcript);
    }

    nodes.promptInput.value = transcriptParts.join(" ").trim();
    shortcuts.forEach((shortcut) => {
      void executeVoiceShortcut(shortcut, previousPrompt);
    });
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
