"use strict";

const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const multer = require("multer");

const { CommandStore } = require("./command_store");
const { createRateLimitMiddleware } = require("./rate_limiter");
const { commandRoutes } = require("./command_routes");
const { createWorkflowPlanner } = require("./workflow_planner");
const { registerCommandQueueRoutes } = require("./routes/command_queue_routes");
const { registerSystemRoutes } = require("./routes/system_routes");
const { registerIntrospectionSceneRoutes } = require("./routes/introspection_scene_routes");
const { registerAssistantRoutes } = require("./routes/assistant_routes");
const { registerUploadAndBatchRoutes } = require("./routes/upload_batch_routes");
const {
  minimalCapabilities,
  normalizeProvider,
  summarizeSceneContext,
  planCommands,
  visionFeedbackPlan,
  testProviderConnection,
  queuePlannedCommands,
} = require("./assistant_engine");
const {
  getRisk,
  validatePayload,
  buildCatalog,
  filterCommandsBySafety,
  normalizeSafetyPolicy,
} = require("./command_catalog");

const VERSION = "1.0.1";
const PRODUCT = "Nova4D";
const SERVICE = "Cinema4DBridge";
const UI_DIR = path.join(__dirname, "ui");

const HOST = process.env.NOVA4D_HOST || "0.0.0.0";
const PORT = parseInt(process.env.NOVA4D_PORT || "30010", 10);
const API_KEY = process.env.NOVA4D_API_KEY || "";
const COMMAND_LEASE_MS = parseInt(process.env.NOVA4D_COMMAND_LEASE_MS || "120000", 10);
const MAX_RETENTION = parseInt(process.env.NOVA4D_MAX_RETENTION || "10000", 10);
const IMPORT_DIR = process.env.NOVA4D_IMPORT_DIR || path.join(os.tmpdir(), "nova4d-imports");
const EXPORT_DIR = process.env.NOVA4D_EXPORT_DIR || path.join(os.tmpdir(), "nova4d-exports");
const MAX_UPLOAD_MB = parseInt(process.env.NOVA4D_MAX_UPLOAD_MB || "500", 10);
const BLENDER_TO_C4D_SCALE = Number.parseFloat(process.env.NOVA4D_BLENDER_SCALE || "1.0");
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.NOVA4D_RATE_LIMIT_WINDOW_MS || "60000", 10);
const RATE_LIMIT_MAX = parseInt(process.env.NOVA4D_RATE_LIMIT_MAX || "240", 10);
const C4D_PATH = process.env.NOVA4D_C4D_PATH || "c4dpy";
const HEADLESS_TIMEOUT_SEC = parseInt(process.env.NOVA4D_HEADLESS_TIMEOUT_SEC || "1800", 10);
const STORE_DRIVER = String(process.env.NOVA4D_STORE_DRIVER || "json").trim().toLowerCase() === "sqlite"
  ? "sqlite"
  : "json";
const STORE_PATH = process.env.NOVA4D_STORE_PATH || path.join(os.homedir(), ".nova4d", "command-store.json");
const STORE_SQLITE_PATH = process.env.NOVA4D_STORE_SQLITE_PATH || path.join(os.homedir(), ".nova4d", "command-store.sqlite");
const EFFECTIVE_STORE_PATH = STORE_DRIVER === "sqlite" ? STORE_SQLITE_PATH : STORE_PATH;

fs.mkdirSync(IMPORT_DIR, { recursive: true });
fs.mkdirSync(EXPORT_DIR, { recursive: true });

const store = new CommandStore({
  leaseMs: Number.isFinite(COMMAND_LEASE_MS) ? COMMAND_LEASE_MS : 120000,
  maxRetention: Number.isFinite(MAX_RETENTION) ? MAX_RETENTION : 10000,
  persistDriver: STORE_DRIVER,
  persistPath: STORE_PATH,
  sqlitePath: STORE_SQLITE_PATH,
});

const upload = multer({
  dest: IMPORT_DIR,
  limits: {
    fileSize: Math.max(1, MAX_UPLOAD_MB) * 1024 * 1024,
  },
});

const app = express();
app.use(express.json({ limit: "16mb" }));

app.use((req, res, next) => {
  res.setHeader("X-Nova4D-Version", VERSION);
  next();
});

app.use("/nova4d/studio/assets", express.static(UI_DIR, {
  index: false,
  etag: true,
  maxAge: "1h",
}));

app.get("/nova4d/studio", (_req, res) => {
  res.sendFile(path.join(UI_DIR, "index.html"));
});

function parseInteger(value, fallback, min, max) {
  const parsed = parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function parseFloatSafe(value, fallback) {
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function inferClientId(req) {
  return req.query.client_id || req.get("X-Client-Id") || "cinema4d-live";
}

const requireRateLimit = createRateLimitMiddleware({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  skipPaths: ["/nova4d/health"],
});

function requireApiKey(req, res, next) {
  if (!API_KEY) {
    return next();
  }
  const supplied = req.get("X-API-Key") || req.query.api_key;
  if (!supplied || supplied !== API_KEY) {
    return res.status(401).json({ status: "error", error: "invalid API key" });
  }
  return next();
}

app.use(requireRateLimit);

function queueCommand(req, res, spec, extraPayload = {}) {
  if (!spec) {
    return res.status(404).json({ status: "error", error: "route spec not found" });
  }
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
  const priority = parseInteger(body.priority, 0, -100, 100);
  const metadata = Object.assign({}, body.metadata || {}, {
    requested_by: req.get("X-Request-By") || "api",
    client_hint: body.client_hint || null,
  });

  const payload = Object.assign({}, body, extraPayload);
  const validation = validateQueuedPayload(spec.path, payload);
  if (!validation.ok) {
    return res.status(400).json({
      status: "error",
      error: "payload validation failed",
      route: spec.path,
      details: validation.errors,
    });
  }
  const command = store.enqueue({
    route: spec.path,
    category: spec.category,
    action: spec.action,
    payload,
    priority,
    metadata,
  });

  return res.json({
    status: "queued",
    command_id: command.id,
    category: command.category,
    action: command.action,
    route: command.route,
    queued_at: command.created_at,
  });
}

const commandRouteByPath = new Map(commandRoutes.map((spec) => [spec.path, spec]));
const routeCatalog = buildCatalog(commandRoutes);

function validateQueuedPayload(routePath, payload) {
  return validatePayload(routePath, payload || {});
}

const headlessJobs = new Map();

function createJobRecord(command, args, logPath) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  const now = new Date().toISOString();
  return {
    id,
    status: "running",
    command,
    args,
    log_path: logPath,
    created_at: now,
    updated_at: now,
    started_at: now,
    completed_at: null,
    exit_code: null,
    signal: null,
    pid: null,
    timeout_sec: null,
  };
}

function finalizeJob(job, status, exitCode, signal) {
  const now = new Date().toISOString();
  job.status = status;
  job.exit_code = exitCode;
  job.signal = signal || null;
  job.completed_at = now;
  job.updated_at = now;
}

function toPublicProvider(provider) {
  return {
    kind: provider.kind,
    base_url: provider.base_url,
    model: provider.model,
    temperature: provider.temperature,
    max_tokens: provider.max_tokens,
    api_key_configured: Boolean(provider.api_key),
  };
}

function applyCommandGuards(commands, safetyInput) {
  const rejectedByValidation = [];
  const valid = [];

  commands.forEach((command) => {
    const validation = validateQueuedPayload(command.route, command.payload);
    if (!validation.ok) {
      rejectedByValidation.push({
        route: command.route,
        reason: "payload validation failed",
        details: validation.errors,
        payload: command.payload || {},
      });
      return;
    }
    valid.push(command);
  });

  const safetyResult = filterCommandsBySafety(valid, getRisk, safetyInput);

  return {
    policy: safetyResult.policy || normalizeSafetyPolicy(safetyInput || {}),
    allowed: safetyResult.allowed || [],
    blocked: (safetyResult.blocked || []).concat(rejectedByValidation),
  };
}

const workflowPlanner = createWorkflowPlanner({ applyCommandGuards });
const { WORKFLOW_SPECS, workflowDefaults, buildWorkflowPlan } = workflowPlanner;

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

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
  const pathEntries = String(process.env.PATH || "")
    .split(path.delimiter)
    .filter(Boolean);
  const suffixes = process.platform === "win32"
    ? (path.extname(name) ? [""] : String(process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";").filter(Boolean))
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

  const importDir = checkDirectoryWritable(IMPORT_DIR);
  checks.push({
    id: "import_dir_writable",
    name: "Import directory writable",
    status: importDir.ok ? "pass" : "fail",
    required: true,
    message: importDir.ok ? "Import directory is writable." : "Import directory is not writable.",
    details: { path: importDir.path, error: importDir.error },
  });

  const exportDir = checkDirectoryWritable(EXPORT_DIR);
  checks.push({
    id: "export_dir_writable",
    name: "Export directory writable",
    status: exportDir.ok ? "pass" : "fail",
    required: true,
    message: exportDir.ok ? "Export directory is writable." : "Export directory is not writable.",
    details: { path: exportDir.path, error: exportDir.error },
  });

  const pluginPath = path.resolve(process.cwd(), "plugins", "Nova4D", "nova4d_plugin.pyp");
  const pluginExists = fs.existsSync(pluginPath);
  checks.push({
    id: "plugin_source_present",
    name: "Nova4D plugin source",
    status: pluginExists ? "pass" : "fail",
    required: true,
    message: pluginExists ? "Plugin source file found." : "Plugin source file not found.",
    details: { path: pluginPath },
  });

  const resolvedC4D = resolveC4DExecutable(C4D_PATH);
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

function isTerminalStatus(status) {
  return ["succeeded", "failed", "canceled"].includes(String(status || ""));
}

function isSceneSnapshotCommand(command) {
  return Boolean(
    command &&
    command.action === "introspect-scene" &&
    command.status === "succeeded" &&
    command.result &&
    typeof command.result === "object"
  );
}

function latestSceneSnapshot(limit = 1000) {
  const recent = store.listRecent(limit);
  return recent.find((command) => isSceneSnapshotCommand(command)) || null;
}

function snapshotTimestampMs(snapshotCommand) {
  const stamp = snapshotCommand?.completed_at || snapshotCommand?.updated_at || snapshotCommand?.created_at;
  const ms = Date.parse(stamp || "");
  return Number.isFinite(ms) ? ms : 0;
}

function summarizeSnapshot(snapshotResult) {
  const summary = summarizeSceneContext(snapshotResult);
  if (!summary) {
    return null;
  }
  return {
    document_name: summary.document_name || "unknown",
    active_object: summary.active_object || null,
    fps: Number.isFinite(summary.fps) ? summary.fps : null,
    objects_total: summary.counts?.objects_total ?? summary.raw?.objects?.length ?? 0,
    materials_total: summary.counts?.materials_total ?? summary.raw?.materials?.length ?? 0,
  };
}

function queueSceneSnapshotCommand(payload = {}, requestedBy = "api:introspection") {
  const spec = commandRouteByPath.get("/nova4d/introspection/scene");
  if (!spec) {
    throw new Error("introspection route missing");
  }
  const normalizedPayload = Object.assign({}, payload || {});
  const validation = validateQueuedPayload(spec.path, normalizedPayload);
  if (!validation.ok) {
    const details = validation.errors.join("; ");
    throw new Error(`invalid introspection payload: ${details}`);
  }
  const command = store.enqueue({
    route: spec.path,
    category: spec.category,
    action: spec.action,
    payload: normalizedPayload,
    priority: 0,
    metadata: {
      requested_by: requestedBy,
      client_hint: "cinema4d-live",
    },
  });
  return command;
}

async function waitForCommandResult(commandId, timeoutMs = 8000, pollMs = 250) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const command = store.get(commandId);
    if (command && isTerminalStatus(command.status)) {
      return command;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return store.get(commandId) || null;
}

async function waitForCommandsResult(commandIds, timeoutMs = 30000, pollMs = 500) {
  const ids = Array.isArray(commandIds)
    ? commandIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const commands = ids.map((id) => store.get(id)).filter(Boolean);
    if (commands.length === ids.length && commands.every((command) => isTerminalStatus(command.status))) {
      return commands;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return ids.map((id) => store.get(id)).filter(Boolean);
}

function visionScreenshotPath(template, iteration) {
  const fallback = path.join(EXPORT_DIR, `nova4d-vision-iter-${iteration}-${Date.now()}.png`);
  const raw = String(template || "").trim();
  if (!raw) {
    return fallback;
  }
  const replaced = raw.includes("{{iteration}}")
    ? raw.replace(/\{\{iteration\}\}/g, String(iteration))
    : raw;
  return path.resolve(replaced);
}

async function resolveSceneSnapshot(options = {}) {
  const maxAgeMs = parseInteger(options.maxAgeMs, 30000, 1000, 3600000);
  const refresh = options.refresh === true;
  const requestedBy = options.requestedBy || "assistant:context";
  const timeoutMs = parseInteger(options.timeoutMs, 8000, 500, 30000);
  const payload = options.payload || {
    max_objects: 600,
    max_materials: 300,
    include_paths: true,
  };

  const cached = latestSceneSnapshot();
  const ageMs = cached ? Date.now() - snapshotTimestampMs(cached) : Number.POSITIVE_INFINITY;
  const freshEnough = Boolean(cached) && ageMs <= maxAgeMs;
  if (cached && freshEnough && !refresh) {
    return {
      source: "cache",
      command: cached,
      snapshot: cached.result,
      age_ms: ageMs,
      warning: null,
    };
  }

  if (!refresh && cached) {
    return {
      source: "stale-cache",
      command: cached,
      snapshot: cached.result,
      age_ms: ageMs,
      warning: "scene snapshot is stale",
    };
  }

  let queued;
  try {
    queued = queueSceneSnapshotCommand(payload, requestedBy);
  } catch (err) {
    return {
      source: cached ? "cache" : "none",
      command: cached,
      snapshot: cached ? cached.result : null,
      age_ms: cached ? ageMs : null,
      warning: err.message,
    };
  }

  const completed = await waitForCommandResult(queued.id, timeoutMs, 250);
  if (completed && completed.status === "succeeded" && completed.result) {
    return {
      source: "fresh",
      command: completed,
      snapshot: completed.result,
      age_ms: 0,
      warning: null,
    };
  }

  const fallback = latestSceneSnapshot();
  if (fallback) {
    return {
      source: "cache-after-timeout",
      command: fallback,
      snapshot: fallback.result,
      age_ms: Date.now() - snapshotTimestampMs(fallback),
      warning: completed
        ? `refresh command finished with status ${completed.status}`
        : "refresh command timed out",
    };
  }

  return {
    source: "none",
    command: completed || queued || null,
    snapshot: null,
    age_ms: null,
    warning: completed
      ? `refresh command finished with status ${completed.status}`
      : "refresh command timed out",
  };
}

function filterObjectRows(rows, req) {
  const q = String(req.query.q || "").trim().toLowerCase();
  const selectedFilter = req.query.selected;
  const typeIdFilter = req.query.type_id !== undefined ? parseInteger(req.query.type_id, 0, -2147483648, 2147483647) : null;
  const limit = parseInteger(req.query.limit, 200, 1, 5000);
  const offset = parseInteger(req.query.offset, 0, 0, 500000);

  let filtered = Array.isArray(rows) ? rows.slice() : [];
  if (q) {
    filtered = filtered.filter((row) => {
      const name = String(row.name || "").toLowerCase();
      const pathValue = String(row.path || "").toLowerCase();
      return name.includes(q) || pathValue.includes(q);
    });
  }
  if (selectedFilter !== undefined) {
    const wantSelected = parseBoolean(selectedFilter, true);
    filtered = filtered.filter((row) => Boolean(row.selected) === wantSelected);
  }
  if (typeIdFilter !== null) {
    filtered = filtered.filter((row) => Number(row.type_id) === Number(typeIdFilter));
  }
  const total = filtered.length;
  const items = filtered.slice(offset, offset + limit);
  return { total, items, limit, offset };
}

function filterMaterialRows(rows, req) {
  const q = String(req.query.q || "").trim().toLowerCase();
  const limit = parseInteger(req.query.limit, 200, 1, 5000);
  const offset = parseInteger(req.query.offset, 0, 0, 500000);
  let filtered = Array.isArray(rows) ? rows.slice() : [];
  if (q) {
    filtered = filtered.filter((row) => String(row.name || "").toLowerCase().includes(q));
  }
  const total = filtered.length;
  const items = filtered.slice(offset, offset + limit);
  return { total, items, limit, offset };
}

registerSystemRoutes({
  app,
  requireApiKey,
  parseInteger,
  parseBoolean,
  buildPreflightChecks,
  summarizePreflight,
  latestSceneSnapshot,
  snapshotTimestampMs,
  recentWorkerCommand,
  summarizeSnapshot,
  minimalCapabilities,
  normalizeSafetyPolicy,
  queuePlannedCommands,
  commandRoutes,
  commandRouteByPath,
  routeCatalog,
  workflowSpecs: WORKFLOW_SPECS,
  workflowDefaults,
  buildWorkflowPlan,
  store,
  product: PRODUCT,
  service: SERVICE,
  version: VERSION,
  importDir: IMPORT_DIR,
  exportDir: EXPORT_DIR,
  storeDriver: STORE_DRIVER,
  effectiveStorePath: EFFECTIVE_STORE_PATH,
  apiKey: API_KEY,
  c4dPath: C4D_PATH,
});

registerIntrospectionSceneRoutes({
  app,
  requireApiKey,
  parseInteger,
  parseBoolean,
  resolveSceneSnapshot,
  latestSceneSnapshot,
  summarizeSnapshot,
  queueCommand,
  commandRouteByPath,
  filterObjectRows,
  filterMaterialRows,
});

registerAssistantRoutes({
  app,
  requireApiKey,
  parseInteger,
  parseBoolean,
  path,
  exportDir: EXPORT_DIR,
  store,
  commandRoutes,
  commandRouteByPath,
  normalizeProvider,
  normalizeSafetyPolicy,
  queuePlannedCommands,
  planCommands,
  visionFeedbackPlan,
  testProviderConnection,
  toPublicProvider,
  applyCommandGuards,
  resolveSceneSnapshot,
  summarizeSnapshot,
  waitForCommandResult,
  waitForCommandsResult,
  visionScreenshotPath,
});

registerCommandQueueRoutes({
  app,
  requireApiKey,
  parseInteger,
  parseBoolean,
  inferClientId,
  store,
  commandRouteByPath,
  commandRoutes,
  queueCommand,
  validateQueuedPayload,
  rateLimitWindowMs: RATE_LIMIT_WINDOW_MS,
  rateLimitMax: RATE_LIMIT_MAX,
});

registerUploadAndBatchRoutes({
  app,
  requireApiKey,
  upload,
  queueCommand,
  parseInteger,
  parseFloatSafe,
  importDir: IMPORT_DIR,
  exportDir: EXPORT_DIR,
  blenderToC4DScale: BLENDER_TO_C4D_SCALE,
  c4dPath: C4D_PATH,
  headlessTimeoutSec: HEADLESS_TIMEOUT_SEC,
  fs,
  path,
  spawn,
  headlessJobs,
  createJobRecord,
  finalizeJob,
});

app.use((err, _req, res, _next) => {
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ status: "error", error: "upload too large" });
  }
  return res.status(500).json({ status: "error", error: err ? err.message : "unknown error" });
});

const heartbeatInterval = setInterval(() => {
  store.broadcastHeartbeat();
  requireRateLimit.prune(Math.max(5 * 60 * 1000, RATE_LIMIT_WINDOW_MS * 2));

  if (headlessJobs.size > 1000) {
    const sorted = Array.from(headlessJobs.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const keep = new Set(sorted.slice(0, 500).map((job) => job.id));
    for (const id of headlessJobs.keys()) {
      if (!keep.has(id)) {
        headlessJobs.delete(id);
      }
    }
  }
}, 30000);

function shutdown() {
  clearInterval(heartbeatInterval);
  store.flush();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[Nova4D] ${SERVICE} listening on http://${HOST}:${PORT}`);
});
