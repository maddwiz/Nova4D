"use strict";

const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const multer = require("multer");

const { CommandStore } = require("./command_store");
const {
  minimalCapabilities,
  normalizeProvider,
  planCommands,
  queuePlannedCommands,
} = require("./assistant_engine");

const VERSION = "1.0.0";
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

fs.mkdirSync(IMPORT_DIR, { recursive: true });
fs.mkdirSync(EXPORT_DIR, { recursive: true });

const store = new CommandStore({
  leaseMs: Number.isFinite(COMMAND_LEASE_MS) ? COMMAND_LEASE_MS : 120000,
  maxRetention: Number.isFinite(MAX_RETENTION) ? MAX_RETENTION : 10000,
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

const rateState = new Map();

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

function requestIdentity(req) {
  const apiToken = req.get("X-API-Key") || req.query.api_key || "no-key";
  const forwarded = req.get("X-Forwarded-For");
  const ip = (forwarded ? forwarded.split(",")[0] : req.ip) || "unknown";
  return `${ip}|${apiToken}`;
}

function requireRateLimit(req, res, next) {
  if (req.path === "/nova4d/health") {
    return next();
  }
  const key = requestIdentity(req);
  const now = Date.now();
  const windowMs = Math.max(5000, RATE_LIMIT_WINDOW_MS);
  const allowed = Math.max(30, RATE_LIMIT_MAX);

  const existing = rateState.get(key);
  if (!existing || existing.resetAt <= now) {
    rateState.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }

  if (existing.count >= allowed) {
    res.setHeader("Retry-After", String(Math.ceil((existing.resetAt - now) / 1000)));
    return res.status(429).json({ status: "error", error: "rate limit exceeded" });
  }

  existing.count += 1;
  return next();
}

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
  const priority = parseInteger(req.body.priority, 0, -100, 100);
  const metadata = Object.assign({}, req.body.metadata || {}, {
    requested_by: req.get("X-Request-By") || "api",
    client_hint: req.body.client_hint || null,
  });

  const payload = Object.assign({}, req.body, extraPayload);
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

const commandRoutes = [
  { path: "/nova4d/scene/spawn-object", category: "scene", action: "spawn-object" },
  { path: "/nova4d/scene/set-transform", category: "scene", action: "set-transform" },
  { path: "/nova4d/scene/set-property", category: "scene", action: "set-property" },
  { path: "/nova4d/scene/set-visibility", category: "scene", action: "set-visibility" },
  { path: "/nova4d/scene/set-color", category: "scene", action: "set-color" },
  { path: "/nova4d/scene/delete-object", category: "scene", action: "delete-object" },
  { path: "/nova4d/scene/duplicate-object", category: "scene", action: "duplicate-object" },
  { path: "/nova4d/scene/group-objects", category: "scene", action: "group-objects" },
  { path: "/nova4d/scene/parent-object", category: "scene", action: "parent-object" },
  { path: "/nova4d/scene/rename-object", category: "scene", action: "rename-object" },
  { path: "/nova4d/scene/select-object", category: "scene", action: "select-object" },
  { path: "/nova4d/scene/clear-selection", category: "scene", action: "clear-selection" },

  { path: "/nova4d/material/create-standard", category: "material", action: "create-standard-material" },
  { path: "/nova4d/material/create-redshift", category: "material", action: "create-redshift-material" },
  { path: "/nova4d/material/create-arnold", category: "material", action: "create-arnold-material" },
  { path: "/nova4d/material/assign", category: "material", action: "assign-material" },
  { path: "/nova4d/material/set-parameter", category: "material", action: "set-material-parameter" },
  { path: "/nova4d/material/set-texture", category: "material", action: "set-material-texture" },

  { path: "/nova4d/mograph/cloner/create", category: "mograph", action: "create-cloner" },
  { path: "/nova4d/mograph/matrix/create", category: "mograph", action: "create-matrix" },
  { path: "/nova4d/mograph/effector/random", category: "mograph", action: "create-random-effector" },
  { path: "/nova4d/mograph/effector/plain", category: "mograph", action: "create-plain-effector" },
  { path: "/nova4d/mograph/effector/step", category: "mograph", action: "create-step-effector" },
  { path: "/nova4d/mograph/assign-effector", category: "mograph", action: "assign-effector" },
  { path: "/nova4d/mograph/set-count", category: "mograph", action: "set-cloner-count" },
  { path: "/nova4d/mograph/set-mode", category: "mograph", action: "set-cloner-mode" },

  { path: "/nova4d/xpresso/create-tag", category: "xpresso", action: "create-xpresso-tag" },
  { path: "/nova4d/xpresso/add-node", category: "xpresso", action: "add-xpresso-node" },
  { path: "/nova4d/xpresso/connect", category: "xpresso", action: "connect-xpresso-ports" },
  { path: "/nova4d/xpresso/set-parameter", category: "xpresso", action: "set-xpresso-parameter" },

  { path: "/nova4d/animation/set-key", category: "animation", action: "set-key" },
  { path: "/nova4d/animation/delete-key", category: "animation", action: "delete-key" },
  { path: "/nova4d/animation/set-range", category: "animation", action: "set-range" },
  { path: "/nova4d/animation/play", category: "animation", action: "play" },
  { path: "/nova4d/animation/stop", category: "animation", action: "stop" },
  { path: "/nova4d/animation/set-fps", category: "animation", action: "set-fps" },

  { path: "/nova4d/render/set-engine", category: "render", action: "set-render-engine" },
  { path: "/nova4d/render/frame", category: "render", action: "render-frame" },
  { path: "/nova4d/render/sequence", category: "render", action: "render-sequence" },
  { path: "/nova4d/render/queue/redshift", category: "render", action: "queue-redshift-render" },
  { path: "/nova4d/render/queue/arnold", category: "render", action: "queue-arnold-render" },
  { path: "/nova4d/render/team-render/publish", category: "render", action: "publish-team-render" },

  { path: "/nova4d/viewport/set-camera", category: "viewport", action: "set-camera" },
  { path: "/nova4d/viewport/focus-object", category: "viewport", action: "focus-object" },
  { path: "/nova4d/viewport/screenshot", category: "viewport", action: "capture-screenshot" },
  { path: "/nova4d/viewport/set-display-mode", category: "viewport", action: "set-display-mode" },

  { path: "/nova4d/io/import/gltf", category: "io", action: "import-gltf" },
  { path: "/nova4d/io/import/fbx", category: "io", action: "import-fbx" },
  { path: "/nova4d/io/import/obj", category: "io", action: "import-obj" },
  { path: "/nova4d/io/export/gltf", category: "io", action: "export-gltf" },
  { path: "/nova4d/io/export/fbx", category: "io", action: "export-fbx" },
  { path: "/nova4d/io/export/obj", category: "io", action: "export-obj" },
  { path: "/nova4d/io/export/alembic", category: "io", action: "export-alembic" },

  { path: "/nova4d/blender/import-gltf", category: "blender", action: "import-blender-gltf" },
  { path: "/nova4d/blender/import-fbx", category: "blender", action: "import-blender-fbx" },

  { path: "/nova4d/system/new-scene", category: "system", action: "new-scene" },
  { path: "/nova4d/system/open-scene", category: "system", action: "open-scene" },
  { path: "/nova4d/system/save-scene", category: "system", action: "save-scene" },

  { path: "/nova4d/headless/render-queue", category: "headless", action: "headless-render-queue" },
  { path: "/nova4d/headless/c4dpy-script", category: "headless", action: "run-c4dpy-script" },

  { path: "/nova4d/test/ping", category: "test", action: "test-ping" },
];

const commandRouteByPath = new Map(commandRoutes.map((spec) => [spec.path, spec]));

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

app.get("/nova4d/health", (_req, res) => {
  res.json({
    status: "ok",
    product: PRODUCT,
    service: SERVICE,
    version: VERSION,
    queue: store.summary(),
    import_dir: IMPORT_DIR,
    export_dir: EXPORT_DIR,
    api_key_enabled: Boolean(API_KEY),
    c4d_path: C4D_PATH,
  });
});

app.get("/nova4d/capabilities", requireApiKey, (_req, res) => {
  res.json({
    status: "ok",
    product: PRODUCT,
    service: SERVICE,
    version: VERSION,
    capabilities: minimalCapabilities(commandRoutes),
    routes: commandRoutes,
  });
});

app.get("/nova4d/assistant/providers", requireApiKey, (_req, res) => {
  const provider = normalizeProvider({}, process.env);
  res.json({
    status: "ok",
    default_provider: toPublicProvider(provider),
    supported_providers: [
      "builtin",
      "openai",
      "openrouter",
      "anthropic",
      "openai-compatible",
    ],
  });
});

app.post("/nova4d/assistant/plan", requireApiKey, async (req, res) => {
  const input = String(req.body.input || "").trim();
  if (!input) {
    return res.status(400).json({ status: "error", error: "input is required" });
  }

  const provider = normalizeProvider(req.body.provider || {}, process.env);
  const maxCommands = parseInteger(req.body.max_commands, 10, 1, 30);

  let warning = null;
  let plan;
  try {
    plan = await planCommands({
      input,
      provider,
      commandRoutes,
      routeMap: commandRouteByPath,
      maxCommands,
    });
  } catch (err) {
    warning = err.message;
    const builtinProvider = normalizeProvider({ kind: "builtin" }, process.env);
    plan = await planCommands({
      input,
      provider: builtinProvider,
      commandRoutes,
      routeMap: commandRouteByPath,
      maxCommands,
    });
  }

  return res.json({
    status: "ok",
    warning,
    provider: toPublicProvider(provider),
    plan: {
      mode: plan.mode,
      summary: plan.summary,
      commands: plan.commands,
    },
  });
});

app.post("/nova4d/assistant/run", requireApiKey, async (req, res) => {
  const input = String(req.body.input || "").trim();
  if (!input) {
    return res.status(400).json({ status: "error", error: "input is required" });
  }

  const provider = normalizeProvider(req.body.provider || {}, process.env);
  const maxCommands = parseInteger(req.body.max_commands, 10, 1, 30);
  const clientHint = String(req.body.client_hint || "cinema4d-live").trim();

  let warning = null;
  let plan;
  try {
    plan = await planCommands({
      input,
      provider,
      commandRoutes,
      routeMap: commandRouteByPath,
      maxCommands,
    });
  } catch (err) {
    warning = err.message;
    const builtinProvider = normalizeProvider({ kind: "builtin" }, process.env);
    plan = await planCommands({
      input,
      provider: builtinProvider,
      commandRoutes,
      routeMap: commandRouteByPath,
      maxCommands,
    });
  }

  const queued = queuePlannedCommands({
    commands: plan.commands,
    routeMap: commandRouteByPath,
    store,
    requestedBy: `assistant:${plan.mode}`,
    clientHint,
  });

  return res.json({
    status: "ok",
    warning,
    provider: toPublicProvider(provider),
    plan: {
      mode: plan.mode,
      summary: plan.summary,
      commands: plan.commands,
    },
    queued_count: queued.length,
    queued,
  });
});

app.post("/nova4d/assistant/queue", requireApiKey, (req, res) => {
  const requestedBy = String(req.body.requested_by || "assistant:manual").trim();
  const clientHint = String(req.body.client_hint || "cinema4d-live").trim();
  const maxCommands = parseInteger(req.body.max_commands, 20, 1, 100);
  const incoming = Array.isArray(req.body.commands) ? req.body.commands : [];
  if (incoming.length === 0) {
    return res.status(400).json({ status: "error", error: "commands[] is required" });
  }

  const commands = incoming.slice(0, maxCommands).map((item) => ({
    route: String(item.route || "").trim(),
    payload: item.payload && typeof item.payload === "object" && !Array.isArray(item.payload) ? item.payload : {},
    reason: String(item.reason || "").slice(0, 800),
    priority: parseInteger(item.priority, 0, -100, 100),
  })).filter((item) => commandRouteByPath.has(item.route));

  if (commands.length === 0) {
    return res.status(400).json({ status: "error", error: "no valid command routes in commands[]" });
  }

  const queued = queuePlannedCommands({
    commands,
    routeMap: commandRouteByPath,
    store,
    requestedBy,
    clientHint,
  });

  return res.json({
    status: "ok",
    queued_count: queued.length,
    queued,
  });
});

app.get("/nova4d/stats", requireApiKey, (_req, res) => {
  res.json({ status: "ok", stats: store.summary(), rate_limit: { window_ms: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_MAX } });
});

app.get("/nova4d/commands/recent", requireApiKey, (req, res) => {
  const limit = parseInteger(req.query.limit, 50, 1, 500);
  res.json({ status: "ok", commands: store.listRecent(limit) });
});

app.get("/nova4d/commands/:id", requireApiKey, (req, res) => {
  const command = store.get(req.params.id);
  if (!command) {
    return res.status(404).json({ status: "error", error: "not found" });
  }
  return res.json({ status: "ok", command });
});

app.post("/nova4d/command", requireApiKey, (req, res) => {
  const { route, category, action, payload } = req.body || {};
  if (!route || !action) {
    return res.status(400).json({ status: "error", error: "route and action are required" });
  }
  const command = store.enqueue({
    route,
    category: category || "custom",
    action,
    payload: payload || {},
    priority: parseInteger(req.body.priority, 0, -100, 100),
    metadata: req.body.metadata || {},
  });
  return res.json({ status: "queued", command_id: command.id, command });
});

app.post("/nova4d/commands/batch", requireApiKey, (req, res) => {
  const commands = Array.isArray(req.body.commands) ? req.body.commands : [];
  if (commands.length === 0) {
    return res.status(400).json({ status: "error", error: "commands[] is required" });
  }
  const queued = store.enqueueBatch(
    commands.map((cmd) => ({
      route: cmd.route || "/nova4d/custom",
      category: cmd.category || "custom",
      action: cmd.action || "command",
      payload: cmd.payload || {},
      priority: parseInteger(cmd.priority, 0, -100, 100),
      metadata: cmd.metadata || {},
    }))
  );
  return res.json({
    status: "queued",
    count: queued.length,
    command_ids: queued.map((cmd) => cmd.id),
  });
});

app.get("/nova4d/commands", requireApiKey, (req, res) => {
  const clientId = inferClientId(req);
  const limit = parseInteger(req.query.limit, 20, 1, 100);
  const commands = store.dispatch(clientId, limit);
  res.json({
    status: "ok",
    client_id: clientId,
    count: commands.length,
    commands,
  });
});

app.post("/nova4d/results", requireApiKey, (req, res) => {
  const result = store.result(req.body || {});
  if (!result.ok) {
    return res.status(400).json({ status: "error", error: result.error });
  }
  return res.json({
    status: "ok",
    command_id: result.command.id,
    command_status: result.command.status,
    updated_at: result.command.updated_at,
  });
});

app.post("/nova4d/commands/:id/requeue", requireApiKey, (req, res) => {
  const result = store.requeue(req.params.id);
  if (!result.ok) {
    return res.status(400).json({ status: "error", error: result.error });
  }
  return res.json({ status: "ok", command: result.command });
});

app.post("/nova4d/commands/:id/cancel", requireApiKey, (req, res) => {
  const result = store.cancel(req.params.id);
  if (!result.ok) {
    return res.status(400).json({ status: "error", error: result.error });
  }
  return res.json({ status: "ok", command: result.command });
});

app.get("/nova4d/stream", requireApiKey, (req, res) => {
  const clientId = inferClientId(req);
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  res.write("event: connected\n");
  res.write(`data: ${JSON.stringify({ client_id: clientId, ts: new Date().toISOString() })}\n\n`);

  store.addSseClient(clientId, res);

  const keepAlive = setInterval(() => {
    try {
      res.write("event: heartbeat\n");
      res.write(`data: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
    } catch (_err) {
      clearInterval(keepAlive);
      store.removeSseClient(res);
    }
  }, 15000);

  req.on("close", () => {
    clearInterval(keepAlive);
    store.removeSseClient(res);
  });
});

commandRoutes.forEach((spec) => {
  app.post(spec.path, requireApiKey, (req, res) => queueCommand(req, res, spec));
});

function queueUploadedImport(req, res, spec, defaults = {}) {
  let localPath = req.body.file_path || null;
  let originalName = null;
  if (req.file && req.file.path) {
    const extension = path.extname(req.file.originalname || "").toLowerCase();
    const safeName = `${req.file.filename}${extension}`;
    const finalPath = path.join(IMPORT_DIR, safeName);
    fs.renameSync(req.file.path, finalPath);
    localPath = finalPath;
    originalName = req.file.originalname || null;
  }

  if (!localPath) {
    return res.status(400).json({ status: "error", error: "Provide multipart file upload or file_path" });
  }

  const scaleRaw = req.body.scale_factor !== undefined ? req.body.scale_factor : req.body.scale;
  const scaleFactor = parseFloatSafe(scaleRaw, defaults.scale_factor || 1.0);

  return queueCommand(req, res, spec, {
    file_path: localPath,
    original_name: originalName,
    scale_factor: scaleFactor,
    scale_fix: req.body.scale_fix || defaults.scale_fix || "none",
  });
}

app.post("/nova4d/io/import/upload", requireApiKey, upload.single("file"), (req, res) => {
  const format = String(req.body.format || "").toLowerCase();
  const routeByFormat = {
    gltf: { path: "/nova4d/io/import/gltf", category: "io", action: "import-gltf" },
    glb: { path: "/nova4d/io/import/gltf", category: "io", action: "import-gltf" },
    fbx: { path: "/nova4d/io/import/fbx", category: "io", action: "import-fbx" },
    obj: { path: "/nova4d/io/import/obj", category: "io", action: "import-obj" },
  };
  const spec = routeByFormat[format] || routeByFormat.gltf;
  return queueUploadedImport(req, res, spec, { scale_factor: 1.0, scale_fix: "native" });
});

app.post("/nova4d/blender/import/upload", requireApiKey, upload.single("file"), (req, res) => {
  const format = String(req.body.format || "gltf").toLowerCase();
  const spec = format === "fbx"
    ? { path: "/nova4d/blender/import-fbx", category: "blender", action: "import-blender-fbx" }
    : { path: "/nova4d/blender/import-gltf", category: "blender", action: "import-blender-gltf" };

  return queueUploadedImport(req, res, spec, {
    scale_fix: "blender_to_c4d",
    scale_factor: BLENDER_TO_C4D_SCALE,
  });
});

app.post("/nova4d/export/upload-result", requireApiKey, upload.single("file"), (req, res) => {
  if (!req.file || !req.file.path) {
    return res.status(400).json({ status: "error", error: "multipart file is required" });
  }
  const extension = path.extname(req.file.originalname || "").toLowerCase();
  const safeName = `${req.file.filename}${extension}`;
  const finalPath = path.join(EXPORT_DIR, safeName);
  fs.renameSync(req.file.path, finalPath);
  return res.json({
    status: "ok",
    path: finalPath,
    original_name: req.file.originalname,
    bytes: req.file.size,
  });
});

app.post("/nova4d/batch/render", requireApiKey, (req, res) => {
  const sceneFile = req.body.scene_file ? path.resolve(String(req.body.scene_file)) : null;
  const customArgs = Array.isArray(req.body.args) ? req.body.args.map((item) => String(item)) : [];
  const outputPath = req.body.output_path ? path.resolve(String(req.body.output_path)) : path.join(EXPORT_DIR, `nova4d-render-${Date.now()}`);
  const timeoutSec = parseInteger(req.body.timeout_sec, HEADLESS_TIMEOUT_SEC, 30, 86400);

  const args = [];
  if (sceneFile) {
    args.push(sceneFile);
  }
  args.push(...customArgs);

  const logPath = path.join(EXPORT_DIR, `batch-${Date.now()}-${Math.random().toString(16).slice(2, 10)}.log`);
  const job = createJobRecord(C4D_PATH, args, logPath);
  job.output_path = outputPath;
  job.timeout_sec = timeoutSec;

  const logFd = fs.openSync(logPath, "a");
  const child = spawn(C4D_PATH, args, {
    stdio: ["ignore", logFd, logFd],
    env: Object.assign({}, process.env, {
      NOVA4D_OUTPUT_PATH: outputPath,
    }),
  });

  job.pid = child.pid;
  headlessJobs.set(job.id, job);

  const timeout = setTimeout(() => {
    if (job.status === "running") {
      child.kill("SIGKILL");
      finalizeJob(job, "timed_out", -1, "SIGKILL");
    }
  }, timeoutSec * 1000);

  child.on("error", (err) => {
    clearTimeout(timeout);
    finalizeJob(job, "failed", -1, null);
    job.error = err.message;
    fs.closeSync(logFd);
  });

  child.on("close", (code, signal) => {
    clearTimeout(timeout);
    const status = code === 0 ? "succeeded" : "failed";
    finalizeJob(job, status, code, signal);
    fs.closeSync(logFd);
  });

  return res.json({
    status: "accepted",
    job_id: job.id,
    pid: job.pid,
    command: C4D_PATH,
    args,
    output_path: outputPath,
    log_path: logPath,
    timeout_sec: timeoutSec,
  });
});

app.get("/nova4d/batch/jobs/:jobId", requireApiKey, (req, res) => {
  const job = headlessJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ status: "error", error: "job not found" });
  }
  return res.json({ status: "ok", job });
});

app.get("/nova4d/batch/jobs", requireApiKey, (req, res) => {
  const limit = parseInteger(req.query.limit, 50, 1, 500);
  const jobs = Array.from(headlessJobs.values())
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
  return res.json({ status: "ok", count: jobs.length, jobs });
});

app.post("/nova4d/batch/jobs/:jobId/cancel", requireApiKey, (req, res) => {
  const job = headlessJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ status: "error", error: "job not found" });
  }
  if (job.status !== "running") {
    return res.status(400).json({ status: "error", error: `job is ${job.status}` });
  }
  try {
    process.kill(job.pid, "SIGTERM");
    finalizeJob(job, "canceled", -1, "SIGTERM");
    return res.json({ status: "ok", job });
  } catch (err) {
    return res.status(500).json({ status: "error", error: err.message });
  }
});

app.use((err, _req, res, _next) => {
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ status: "error", error: "upload too large" });
  }
  return res.status(500).json({ status: "error", error: err ? err.message : "unknown error" });
});

const heartbeatInterval = setInterval(() => {
  store.broadcastHeartbeat();

  const cutoff = Date.now() - Math.max(5 * 60 * 1000, RATE_LIMIT_WINDOW_MS * 2);
  for (const [key, entry] of rateState.entries()) {
    if (entry.resetAt < cutoff) {
      rateState.delete(key);
    }
  }

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
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[Nova4D] ${SERVICE} listening on http://${HOST}:${PORT}`);
});
