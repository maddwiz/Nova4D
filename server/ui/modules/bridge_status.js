/* Bridge status and streaming module extracted from app.js */
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
