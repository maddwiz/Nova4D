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
  promptInput: document.getElementById("promptInput"),
  voiceStatus: document.getElementById("voiceStatus"),
  planSummary: document.getElementById("planSummary"),
  planCommands: document.getElementById("planCommands"),
  runSummary: document.getElementById("runSummary"),
  queuedCommands: document.getElementById("queuedCommands"),
  recentTableBody: document.getElementById("recentTableBody"),
  refreshButton: document.getElementById("refreshButton"),
  loadRecentButton: document.getElementById("loadRecentButton"),
  voiceStart: document.getElementById("voiceStart"),
  voiceStop: document.getElementById("voiceStop"),
  snapshotButton: document.getElementById("snapshotButton"),
  planButton: document.getElementById("planButton"),
  runButton: document.getElementById("runButton"),
};

const providerDefaults = {
  builtin: { base_url: "", model: "rules-v1" },
  openai: { base_url: "https://api.openai.com", model: "gpt-4o-mini" },
  openrouter: { base_url: "https://openrouter.ai/api", model: "openai/gpt-4o-mini" },
  anthropic: { base_url: "https://api.anthropic.com", model: "claude-3-5-sonnet-latest" },
  "openai-compatible": { base_url: "http://127.0.0.1:1234", model: "gpt-4o-mini" },
};

let recognition = null;
let lastPlan = null;

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
    nodes.recentTableBody.innerHTML = commands.map((command) => {
      const shortId = escapeHtml(String(command.id || "").slice(0, 8));
      const action = escapeHtml(command.action || "-");
      const status = escapeHtml(command.status || "-");
      const delivered = escapeHtml(command.delivered_to || "-");
      const statusClass = status === "succeeded"
        ? "status-ok"
        : (status === "failed" ? "status-error" : "status-warn");
      return `
        <tr>
          <td><span class="code-inline">${shortId}</span></td>
          <td>${action}</td>
          <td class="${statusClass}">${status}</td>
          <td>${delivered}</td>
        </tr>
      `;
    }).join("");
    if (!commands.length) {
      nodes.recentTableBody.innerHTML = "<tr><td colspan=\"4\" class=\"hint\">No recent commands yet.</td></tr>";
    }
  } catch (err) {
    nodes.recentTableBody.innerHTML = `<tr><td colspan="4" class="status-error">${escapeHtml(err.message)}</td></tr>`;
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
});

nodes.useSceneContext.addEventListener("change", () => {
  nodes.refreshSceneContext.disabled = !nodes.useSceneContext.checked;
});

nodes.refreshButton.addEventListener("click", loadHealth);
nodes.loadRecentButton.addEventListener("click", loadRecent);
nodes.snapshotButton.addEventListener("click", captureSnapshot);
nodes.planButton.addEventListener("click", planOnly);
nodes.runButton.addEventListener("click", runPlan);

(async function init() {
  nodes.providerKind.value = "builtin";
  nodes.safetyMode.value = "balanced";
  nodes.allowDangerous.checked = false;
  nodes.useSceneContext.checked = true;
  nodes.refreshSceneContext.checked = true;
  nodes.refreshSceneContext.disabled = false;
  applyProviderDefaults();
  initVoice();
  await loadHealth();
  await loadRecent();
})();
