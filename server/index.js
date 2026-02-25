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
const { createSceneSnapshotService } = require("./scene_snapshot_service");
const { createPreflightService } = require("./preflight_checks");
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

const sceneSnapshotService = createSceneSnapshotService({
  store,
  commandRouteByPath,
  validateQueuedPayload,
  summarizeSceneContext,
  parseInteger,
  parseBoolean,
  exportDir: EXPORT_DIR,
});

const {
  isTerminalStatus,
  latestSceneSnapshot,
  snapshotTimestampMs,
  summarizeSnapshot,
  waitForCommandResult,
  waitForCommandsResult,
  visionScreenshotPath,
  resolveSceneSnapshot,
  filterObjectRows,
  filterMaterialRows,
} = sceneSnapshotService;

const preflightService = createPreflightService({
  fs,
  os,
  path,
  processEnv: process.env,
  processCwd: process.cwd(),
  store,
  commandRouteByPath,
  waitForCommandResult,
  isTerminalStatus,
  parseInteger,
  c4dPath: C4D_PATH,
  importDir: IMPORT_DIR,
  exportDir: EXPORT_DIR,
});

const {
  buildPreflightChecks,
  summarizePreflight,
  recentWorkerCommand,
} = preflightService;

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
