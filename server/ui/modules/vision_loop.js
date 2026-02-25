"use strict";

function parseVisionInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function visionLoopPayload() {
  const enabled = Boolean(nodes.visionLoopEnabled.checked);
  return {
    enabled,
    max_iterations: parseVisionInt(nodes.visionLoopMaxIterations.value, 2, 1, 5),
    frame: parseVisionInt(nodes.visionLoopFrame.value, 0, -100000, 100000),
    screenshot_path: (nodes.visionLoopScreenshotPath.value || "").trim() || "/tmp/nova4d-vision-iter-{{iteration}}.png",
  };
}

function setVisionLoopStatus(text, className = "hint") {
  nodes.visionLoopStatus.textContent = text;
  nodes.visionLoopStatus.className = className;
}

function renderVisionLoop(runResponse) {
  const payload = runResponse?.vision_loop;
  if (!payload || payload.enabled !== true) {
    if (nodes.visionLoopEnabled.checked) {
      setVisionLoopStatus("Scene Vision enabled. Run a prompt to capture comparisons.", "hint");
    } else {
      setVisionLoopStatus("Scene Vision disabled.", "hint");
    }
    nodes.visionLoopComparisons.innerHTML =
      "<li class='hint'>Enable Scene Vision to get iterative screenshot feedback and correction passes.</li>";
    return;
  }

  const iterations = Array.isArray(payload.iterations) ? payload.iterations : [];
  const warnings = Array.isArray(payload.warnings) ? payload.warnings : [];

  if (!iterations.length) {
    setVisionLoopStatus(
      warnings.length
        ? `Scene Vision skipped: ${warnings.join(" | ")}`
        : "Scene Vision had no iterations for this run.",
      warnings.length ? "status-warn" : "hint"
    );
    nodes.visionLoopComparisons.innerHTML = "<li class='hint'>No Scene Vision comparisons generated.</li>";
    return;
  }

  const rows = iterations.map((item) => {
    const iteration = Number(item.iteration || 0);
    const match = item.match_score === null || item.match_score === undefined
      ? "n/a"
      : `${item.match_score}%`;
    const queued = Number(item.queued_corrections || 0);
    const blocked = Number(item.blocked_corrections || 0);
    const summary = escapeHtml(item.summary || "");
    const analysis = escapeHtml(item.analysis || "");
    const screenshotPath = escapeHtml(item.screenshot_path || "");
    const statusLabel = item.needs_correction ? "needs correction" : "matched";
    const detail = `iter ${iteration} | ${statusLabel} | match ${match} | queued ${queued} | blocked ${blocked}`;
    const link = screenshotPath
      ? `<div class="mono small"><a href="file://${screenshotPath}" target="_blank" rel="noopener noreferrer">${screenshotPath}</a></div>`
      : "";
    return `<li><div>${detail}</div><div class="hint">${summary}</div><div class="mono small">${analysis}</div>${link}</li>`;
  });

  nodes.visionLoopComparisons.innerHTML = rows.join("");
  setVisionLoopStatus(
    `Scene Vision completed ${iterations.length} iteration${iterations.length === 1 ? "" : "s"}${warnings.length ? ` | warnings ${warnings.length}` : ""}.`,
    warnings.length ? "status-warn" : "status-ok"
  );
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseVisionInt,
  };
}
