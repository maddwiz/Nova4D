/* Workflow engine module extracted from app.js */
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
    render_output: (nodes.workflowRenderOutput.value || "").trim() || CINEMATIC_SMOKE_DEFAULT_RENDER_OUTPUT,
    gltf_output: (nodes.workflowGltfOutput.value || "").trim() || CINEMATIC_SMOKE_DEFAULT_GLTF_OUTPUT,
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
  if (typeof renderVisionLoop === "function") {
    renderVisionLoop(runResponse);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseIntOrFallback,
    parseFloatOrFallback,
  };
}
