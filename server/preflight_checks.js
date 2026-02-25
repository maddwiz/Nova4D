"use strict";

function createPreflightService({
  fs,
  os,
  path,
  processEnv,
  processCwd,
  store,
  commandRouteByPath,
  waitForCommandResult,
  isTerminalStatus,
  parseInteger,
  c4dPath,
  importDir,
  exportDir,
}) {
  function summarizeChecks(checks) {
    const summary = { pass: 0, warn: 0, fail: 0 };
    (checks || []).forEach((check) => {
      if (check && check.status && summary[check.status] !== undefined) {
        summary[check.status] += 1;
      }
    });
    return summary;
  }

  function expandHomePath(input) {
    const raw = String(input || "").trim();
    if (!raw) {
      return raw;
    }
    if (!raw.startsWith("~")) {
      return raw;
    }
    if (raw === "~") {
      return os.homedir();
    }
    if (raw.startsWith("~/") || raw.startsWith(`~${path.sep}`)) {
      return path.join(os.homedir(), raw.slice(2));
    }
    return raw;
  }

  function isExecutableFile(filePath) {
    try {
      fs.accessSync(filePath, fs.constants.X_OK);
      return true;
    } catch (_err) {
      return false;
    }
  }

  function findExecutableOnPath(binaryName) {
    const name = String(binaryName || "").trim();
    if (!name) {
      return null;
    }
    const pathEntries = String(processEnv.PATH || "")
      .split(path.delimiter)
      .filter(Boolean);
    const suffixes = process.platform === "win32"
      ? (path.extname(name) ? [""] : String(processEnv.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";").filter(Boolean))
      : [""];
    for (const entry of pathEntries) {
      for (const suffix of suffixes) {
        const candidate = path.join(entry, `${name}${suffix}`);
        if (!fs.existsSync(candidate)) {
          continue;
        }
        if (isExecutableFile(candidate)) {
          return candidate;
        }
      }
    }
    return null;
  }

  function resolveC4DExecutable(commandValue) {
    const input = String(commandValue || "").trim();
    if (!input) {
      return {
        input,
        mode: "empty",
        resolved: null,
        exists: false,
        executable: false,
      };
    }
    const expanded = expandHomePath(input);
    const pathLike = path.isAbsolute(expanded) || expanded.includes(path.sep) || expanded.startsWith(".");
    if (pathLike) {
      const resolved = path.resolve(expanded);
      const exists = fs.existsSync(resolved);
      return {
        input,
        mode: "path",
        resolved,
        exists,
        executable: exists ? isExecutableFile(resolved) : false,
      };
    }

    const found = findExecutableOnPath(expanded);
    return {
      input,
      mode: "path-lookup",
      resolved: found,
      exists: Boolean(found),
      executable: Boolean(found),
    };
  }

  function checkDirectoryWritable(dirPath) {
    const target = path.resolve(String(dirPath || ""));
    try {
      fs.mkdirSync(target, { recursive: true });
      fs.accessSync(target, fs.constants.W_OK);
      return { ok: true, path: target, error: null };
    } catch (err) {
      return { ok: false, path: target, error: err.message };
    }
  }

  function recentWorkerCommand(maxAgeMs = 10 * 60 * 1000) {
    const now = Date.now();
    const recent = store.listRecent(400);
    return recent.find((command) => {
      if (!command || !command.delivered_to) {
        return false;
      }
      const stamp = Date.parse(command.updated_at || command.completed_at || command.created_at || "");
      if (!Number.isFinite(stamp)) {
        return false;
      }
      return now - stamp <= maxAgeMs;
    }) || null;
  }

  async function runWorkerProbe(timeoutMs = 8000) {
    const spec = commandRouteByPath.get("/nova4d/test/ping");
    if (!spec) {
      return {
        id: "worker_probe",
        name: "Worker probe command",
        status: "fail",
        required: false,
        message: "Missing /nova4d/test/ping route definition.",
        details: null,
      };
    }

    const probeCommand = store.enqueue({
      route: spec.path,
      category: spec.category,
      action: spec.action,
      payload: { message: "nova4d-preflight-probe" },
      priority: 0,
      metadata: {
        requested_by: "system:preflight-probe",
        client_hint: "cinema4d-live",
      },
    });

    const completed = await waitForCommandResult(probeCommand.id, timeoutMs, 250);
    if (completed && completed.status === "succeeded") {
      return {
        id: "worker_probe",
        name: "Worker probe command",
        status: "pass",
        required: false,
        message: "Worker processed probe command successfully.",
        details: {
          command_id: completed.id,
          delivered_to: completed.delivered_to || null,
          completed_at: completed.completed_at || completed.updated_at || null,
        },
      };
    }
    if (completed && completed.status === "failed") {
      return {
        id: "worker_probe",
        name: "Worker probe command",
        status: "fail",
        required: false,
        message: "Worker reported probe command failure.",
        details: {
          command_id: completed.id,
          delivered_to: completed.delivered_to || null,
          error: completed.error || "unknown error",
        },
      };
    }

    if (completed && !isTerminalStatus(completed.status)) {
      store.cancel(completed.id);
    }

    return {
      id: "worker_probe",
      name: "Worker probe command",
      status: "warn",
      required: false,
      message: "Probe timed out before a worker reported a result.",
      details: {
        command_id: probeCommand.id,
        timeout_ms: timeoutMs,
      },
    };
  }

  async function buildPreflightChecks(options = {}) {
    const probeWorker = options.probeWorker === true;
    const probeTimeoutMs = parseInteger(options.probeTimeoutMs, 8000, 1000, 30000);

    const checks = [];

    const writableImportDir = checkDirectoryWritable(importDir);
    checks.push({
      id: "import_dir_writable",
      name: "Import directory writable",
      status: writableImportDir.ok ? "pass" : "fail",
      required: true,
      message: writableImportDir.ok ? "Import directory is writable." : "Import directory is not writable.",
      details: { path: writableImportDir.path, error: writableImportDir.error },
    });

    const writableExportDir = checkDirectoryWritable(exportDir);
    checks.push({
      id: "export_dir_writable",
      name: "Export directory writable",
      status: writableExportDir.ok ? "pass" : "fail",
      required: true,
      message: writableExportDir.ok ? "Export directory is writable." : "Export directory is not writable.",
      details: { path: writableExportDir.path, error: writableExportDir.error },
    });

    const pluginPath = path.resolve(processCwd, "plugins", "Nova4D", "nova4d_plugin.pyp");
    const pluginExists = fs.existsSync(pluginPath);
    checks.push({
      id: "plugin_source_present",
      name: "Nova4D plugin source",
      status: pluginExists ? "pass" : "fail",
      required: true,
      message: pluginExists ? "Plugin source file found." : "Plugin source file not found.",
      details: { path: pluginPath },
    });

    const resolvedC4D = resolveC4DExecutable(c4dPath);
    const c4dOk = resolvedC4D.exists && resolvedC4D.executable;
    checks.push({
      id: "c4d_command_resolves",
      name: "C4D command path",
      status: c4dOk ? "pass" : "warn",
      required: false,
      message: c4dOk
        ? "C4D command resolves to an executable."
        : "C4D command did not resolve. Headless/batch features may fail.",
      details: resolvedC4D,
    });

    const recentWorker = recentWorkerCommand();
    checks.push({
      id: "worker_recent_activity",
      name: "Recent worker activity",
      status: recentWorker ? "pass" : "warn",
      required: false,
      message: recentWorker
        ? "Recent worker activity detected."
        : "No recent worker activity detected.",
      details: recentWorker
        ? {
          command_id: recentWorker.id,
          route: recentWorker.route,
          status: recentWorker.status,
          delivered_to: recentWorker.delivered_to,
          updated_at: recentWorker.updated_at,
        }
        : null,
    });

    if (probeWorker) {
      checks.push(await runWorkerProbe(probeTimeoutMs));
    }

    return checks;
  }

  function summarizePreflight(checks, probeWorker, probeTimeoutMs) {
    const summary = summarizeChecks(checks);
    const overallStatus = summary.fail > 0 ? "fail" : (summary.warn > 0 ? "warn" : "pass");
    const requiredFailures = checks.filter((check) => check.required && check.status === "fail").length;
    return {
      overall_status: overallStatus,
      ready_for_local_use: requiredFailures === 0,
      probe_worker: probeWorker,
      probe_timeout_ms: probeTimeoutMs,
      summary,
      checks,
    };
  }

  return {
    buildPreflightChecks,
    summarizePreflight,
    recentWorkerCommand,
  };
}

module.exports = {
  createPreflightService,
};
