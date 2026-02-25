/* Command browser module extracted from app.js */
function buildRecentQueryParams(limit = 20) {
  const params = new URLSearchParams();
  const parsedLimit = Number.parseInt(String(limit), 10);
  const safeLimit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(500, parsedLimit))
    : 20;
  params.set("limit", String(safeLimit));

  const statusFilter = (nodes.recentStatusFilter.value || "").trim();
  const routeFilter = (nodes.recentRouteFilter.value || "").trim();
  const actionFilter = (nodes.recentActionFilter.value || "").trim();
  const clientFilter = (nodes.recentClientFilter.value || "").trim();
  if (statusFilter) {
    params.set("status", statusFilter);
  }
  if (routeFilter) {
    params.set("route", routeFilter);
  }
  if (actionFilter) {
    params.set("action", actionFilter);
  }
  if (clientFilter) {
    params.set("client", clientFilter);
  }
  return params;
}

async function loadRecent() {
  try {
    const params = buildRecentQueryParams(20);
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

async function applyRecentFilters() {
  saveStudioSettings();
  await loadRecent();
}

async function clearRecentFilters() {
  nodes.recentStatusFilter.value = "";
  nodes.recentRouteFilter.value = "";
  nodes.recentActionFilter.value = "";
  nodes.recentClientFilter.value = "";
  saveStudioSettings();
  await loadRecent();
}

async function exportRecentCommands() {
  nodes.runSummary.textContent = "Exporting filtered recent commands...";
  try {
    const params = buildRecentQueryParams(500);
    const response = await api(`/nova4d/commands/recent?${params.toString()}`);
    const commands = Array.isArray(response.commands) ? response.commands : [];
    const exportedAt = new Date().toISOString();
    const payload = {
      exported_at: exportedAt,
      filters: {
        status: (nodes.recentStatusFilter.value || "").trim(),
        route: (nodes.recentRouteFilter.value || "").trim(),
        action: (nodes.recentActionFilter.value || "").trim(),
        client: (nodes.recentClientFilter.value || "").trim(),
      },
      count: commands.length,
      commands,
    };
    const serialized = JSON.stringify(payload, null, 2);
    const blob = new Blob([serialized], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = exportedAt.replace(/[:.]/g, "-");
    anchor.href = url;
    anchor.download = `nova4d-recent-${stamp}.json`;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
    nodes.runSummary.textContent = `Exported ${commands.length} command${commands.length === 1 ? "" : "s"} to JSON.`;
  } catch (err) {
    nodes.runSummary.textContent = `Export failed: ${err.message}`;
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
