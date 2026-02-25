"use strict";

const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const multer = require("multer");

const { CommandStore } = require("./command_store");
const { createRateLimitMiddleware } = require("./rate_limiter");
const {
  minimalCapabilities,
  normalizeProvider,
  summarizeSceneContext,
  planCommands,
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
const STORE_PATH = process.env.NOVA4D_STORE_PATH || path.join(os.homedir(), ".nova4d", "command-store.json");

fs.mkdirSync(IMPORT_DIR, { recursive: true });
fs.mkdirSync(EXPORT_DIR, { recursive: true });

const store = new CommandStore({
  leaseMs: Number.isFinite(COMMAND_LEASE_MS) ? COMMAND_LEASE_MS : 120000,
  maxRetention: Number.isFinite(MAX_RETENTION) ? MAX_RETENTION : 10000,
  persistPath: STORE_PATH,
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

  { path: "/nova4d/introspection/scene", category: "introspection", action: "introspect-scene" },

  { path: "/nova4d/test/ping", category: "test", action: "test-ping" },
];

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

function sanitizeIncomingCommands(rows, maxCommands) {
  return (rows || []).slice(0, maxCommands).map((item) => ({
    route: String(item.route || "").trim(),
    payload: item.payload && typeof item.payload === "object" && !Array.isArray(item.payload) ? item.payload : {},
    reason: String(item.reason || "").slice(0, 800),
    priority: parseInteger(item.priority, 0, -100, 100),
  })).filter((item) => commandRouteByPath.has(item.route));
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

const WORKFLOW_SPECS = [
  { id: "spawn_cube", name: "Spawn Cube", description: "Create a single cube object." },
  { id: "mograph_cloner", name: "MoGraph Cloner Setup", description: "Create a cloner object." },
  { id: "redshift_material", name: "Redshift Material", description: "Create and assign a Redshift material." },
  { id: "animate_render", name: "Animate + Render", description: "Set keys and render frame 0." },
  { id: "full_smoke", name: "Full Workflow Smoke", description: "Cube + cloner + Redshift + animation + render." },
  {
    id: "cinematic_smoke",
    name: "Cinematic Smoke",
    description: "Cube + cloner + Redshift + animation + render + glTF export/import.",
  },
];

const workflowById = new Map(WORKFLOW_SPECS.map((workflow) => [workflow.id, workflow]));

function workflowDefaults(options = {}) {
  const objectName = String(options.object_name || "WorkflowCube").trim() || "WorkflowCube";
  const clonerName = String(options.cloner_name || "WorkflowCloner").trim() || "WorkflowCloner";
  const materialName = String(options.material_name || "WorkflowRedshiftMat").trim() || "WorkflowRedshiftMat";
  const frameStart = parseInteger(options.frame_start, 0, -100000, 1000000);
  const frameEnd = parseInteger(options.frame_end, 30, -100000, 1000000);
  const startValue = parseFloatSafe(options.start_value, 0);
  const endValue = parseFloatSafe(options.end_value, 180);
  const renderFrame = parseInteger(options.render_frame, frameStart, -100000, 1000000);
  const renderOutput = String(options.render_output || "/tmp/nova4d-workflow-frame.png").trim()
    || "/tmp/nova4d-workflow-frame.png";
  const gltfOutput = String(options.gltf_output || "/tmp/nova4d-workflow-smoke.gltf").trim()
    || "/tmp/nova4d-workflow-smoke.gltf";

  return {
    object_name: objectName,
    cloner_name: clonerName,
    material_name: materialName,
    frame_start: frameStart,
    frame_end: frameEnd,
    start_value: startValue,
    end_value: endValue,
    render_frame: renderFrame,
    render_output: renderOutput,
    gltf_output: gltfOutput,
  };
}

function buildWorkflowCommands(workflowId, options = {}) {
  const defaults = workflowDefaults(options);
  const spawnCube = {
    route: "/nova4d/scene/spawn-object",
    payload: {
      object_type: "cube",
      name: defaults.object_name,
      position: [0, 120, 0],
    },
    reason: "Create workflow base cube.",
  };
  const createCloner = {
    route: "/nova4d/mograph/cloner/create",
    payload: { name: defaults.cloner_name },
    reason: "Create workflow cloner.",
  };
  const createRedshift = {
    route: "/nova4d/material/create-redshift",
    payload: { name: defaults.material_name },
    reason: "Create workflow Redshift material.",
  };
  const assignMaterial = {
    route: "/nova4d/material/assign",
    payload: {
      target_name: defaults.object_name,
      material_name: defaults.material_name,
    },
    reason: "Assign workflow material to cube.",
  };
  const keyStart = {
    route: "/nova4d/animation/set-key",
    payload: {
      target_name: defaults.object_name,
      parameter: "position.x",
      frame: defaults.frame_start,
      value: defaults.start_value,
    },
    reason: "Animation start key.",
  };
  const keyEnd = {
    route: "/nova4d/animation/set-key",
    payload: {
      target_name: defaults.object_name,
      parameter: "position.x",
      frame: defaults.frame_end,
      value: defaults.end_value,
    },
    reason: "Animation end key.",
  };
  const renderFrame = {
    route: "/nova4d/render/frame",
    payload: {
      frame: defaults.render_frame,
      output_path: defaults.render_output,
    },
    reason: "Render workflow preview frame.",
  };
  const exportGltf = {
    route: "/nova4d/io/export/gltf",
    payload: {
      output_path: defaults.gltf_output,
    },
    reason: "Export workflow scene to glTF.",
  };
  const importBlenderGltf = {
    route: "/nova4d/blender/import-gltf",
    payload: {
      file_path: defaults.gltf_output,
      scale_fix: "blender_to_c4d",
    },
    reason: "Validate Blender glTF import path.",
  };

  if (workflowId === "spawn_cube") {
    return [spawnCube];
  }
  if (workflowId === "mograph_cloner") {
    return [createCloner];
  }
  if (workflowId === "redshift_material") {
    return [spawnCube, createRedshift, assignMaterial];
  }
  if (workflowId === "animate_render") {
    return [spawnCube, keyStart, keyEnd, renderFrame];
  }
  if (workflowId === "full_smoke") {
    return [spawnCube, createCloner, createRedshift, assignMaterial, keyStart, keyEnd, renderFrame];
  }
  if (workflowId === "cinematic_smoke") {
    return [
      spawnCube,
      createCloner,
      createRedshift,
      assignMaterial,
      keyStart,
      keyEnd,
      renderFrame,
      exportGltf,
      importBlenderGltf,
    ];
  }
  return [];
}

function buildWorkflowPlan(workflowId, options = {}, safetyInput = {}, maxCommands = 20) {
  const workflow = workflowById.get(workflowId);
  if (!workflow) {
    return {
      ok: false,
      error: "workflow not found",
      workflow_id: workflowId,
    };
  }

  const normalizedOptions = workflowDefaults(options);
  const cappedMax = parseInteger(maxCommands, 20, 1, 100);
  const commands = buildWorkflowCommands(workflow.id, normalizedOptions).slice(0, cappedMax);
  if (commands.length === 0) {
    return {
      ok: false,
      error: "workflow produced no commands",
      workflow_id: workflow.id,
    };
  }

  const guarded = applyCommandGuards(commands, safetyInput);
  return {
    ok: true,
    workflow,
    options: normalizedOptions,
    guarded,
    max_commands: cappedMax,
  };
}

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

app.get("/nova4d/health", (_req, res) => {
  res.json({
    status: "ok",
    product: PRODUCT,
    service: SERVICE,
    version: VERSION,
    queue: store.summary(),
    import_dir: IMPORT_DIR,
    export_dir: EXPORT_DIR,
    store_path: STORE_PATH,
    api_key_enabled: Boolean(API_KEY),
    c4d_path: C4D_PATH,
  });
});

app.get("/nova4d/system/preflight", requireApiKey, async (req, res) => {
  const probeWorker = parseBoolean(req.query.probe_worker, false);
  const probeTimeoutMs = parseInteger(req.query.probe_timeout_ms, 8000, 1000, 30000);
  const checks = await buildPreflightChecks({
    probeWorker,
    probeTimeoutMs,
  });
  const preflight = summarizePreflight(checks, probeWorker, probeTimeoutMs);

  return res.json({
    status: "ok",
    overall_status: preflight.overall_status,
    ready_for_local_use: preflight.ready_for_local_use,
    probe_worker: preflight.probe_worker,
    probe_timeout_ms: preflight.probe_timeout_ms,
    summary: preflight.summary,
    checks: preflight.checks,
  });
});

app.get("/nova4d/system/status", requireApiKey, async (_req, res) => {
  const checks = await buildPreflightChecks({
    probeWorker: false,
    probeTimeoutMs: 8000,
  });
  const preflight = summarizePreflight(checks, false, 8000);
  const snapshotCommand = latestSceneSnapshot(1000);
  const snapshotAgeMs = snapshotCommand ? Math.max(0, Date.now() - snapshotTimestampMs(snapshotCommand)) : null;
  const worker = recentWorkerCommand();
  const workerAgeMs = worker
    ? Math.max(0, Date.now() - Date.parse(worker.updated_at || worker.completed_at || worker.created_at || ""))
    : null;
  const clients = store.listSseClients(50);

  return res.json({
    status: "ok",
    product: PRODUCT,
    service: SERVICE,
    version: VERSION,
    queue: store.summary(),
    preflight: {
      overall_status: preflight.overall_status,
      ready_for_local_use: preflight.ready_for_local_use,
      summary: preflight.summary,
    },
    latest_snapshot: snapshotCommand
      ? {
        available: true,
        command_id: snapshotCommand.id,
        captured_at: snapshotCommand.completed_at || snapshotCommand.updated_at || null,
        age_ms: snapshotAgeMs,
        delivered_to: snapshotCommand.delivered_to || null,
        summary: summarizeSnapshot(snapshotCommand.result),
      }
      : {
        available: false,
        command_id: null,
        captured_at: null,
        age_ms: null,
        delivered_to: null,
        summary: null,
      },
    recent_worker_activity: worker
      ? {
        available: true,
        command_id: worker.id,
        route: worker.route,
        status: worker.status,
        delivered_to: worker.delivered_to || null,
        updated_at: worker.updated_at || worker.completed_at || null,
        age_ms: Number.isFinite(workerAgeMs) ? workerAgeMs : null,
      }
      : {
        available: false,
        command_id: null,
      },
    stream_clients: {
      count: clients.length,
      clients,
    },
  });
});

app.get("/nova4d/capabilities", requireApiKey, (_req, res) => {
  const summary = minimalCapabilities(commandRoutes);
  res.json({
    status: "ok",
    product: PRODUCT,
    service: SERVICE,
    version: VERSION,
    capabilities: Object.assign({}, summary, {
      risk_levels: ["safe", "moderate", "dangerous"],
      scene_query_endpoints: [
        "/nova4d/scene/graph",
        "/nova4d/scene/objects",
        "/nova4d/scene/materials",
        "/nova4d/scene/object",
      ],
      workflow_endpoints: [
        "/nova4d/workflows",
        "/nova4d/workflows/preview",
        "/nova4d/workflows/run",
      ],
    }),
    routes: routeCatalog,
  });
});

app.get("/nova4d/routes", requireApiKey, (_req, res) => {
  res.json({
    status: "ok",
    count: routeCatalog.length,
    routes: routeCatalog,
  });
});

app.get("/nova4d/workflows", requireApiKey, (_req, res) => {
  res.json({
    status: "ok",
    workflows: WORKFLOW_SPECS,
    defaults: workflowDefaults(),
  });
});

app.post("/nova4d/workflows/preview", requireApiKey, (req, res) => {
  const workflowId = String(req.body.workflow_id || "").trim();
  if (!workflowId) {
    return res.status(400).json({ status: "error", error: "workflow_id is required" });
  }
  const options = req.body.options && typeof req.body.options === "object" && !Array.isArray(req.body.options)
    ? req.body.options
    : {};
  const maxCommands = parseInteger(req.body.max_commands, 20, 1, 100);
  const safety = normalizeSafetyPolicy(req.body.safety || {});

  const plan = buildWorkflowPlan(workflowId, options, safety, maxCommands);
  if (!plan.ok) {
    return res.status(plan.error === "workflow not found" ? 404 : 400).json({
      status: "error",
      error: plan.error,
      workflow_id: workflowId,
    });
  }

  return res.json({
    status: "ok",
    workflow: {
      id: plan.workflow.id,
      name: plan.workflow.name,
      description: plan.workflow.description,
      options: plan.options,
    },
    safety_policy: plan.guarded.policy,
    commands: plan.guarded.allowed,
    blocked_commands: plan.guarded.blocked,
  });
});

app.post("/nova4d/workflows/run", requireApiKey, (req, res) => {
  const workflowId = String(req.body.workflow_id || "").trim();
  if (!workflowId) {
    return res.status(400).json({ status: "error", error: "workflow_id is required" });
  }

  const options = req.body.options && typeof req.body.options === "object" && !Array.isArray(req.body.options)
    ? req.body.options
    : {};
  const maxCommands = parseInteger(req.body.max_commands, 20, 1, 100);
  const safety = normalizeSafetyPolicy(req.body.safety || {});
  const clientHint = String(req.body.client_hint || "cinema4d-live").trim();
  const requestedBy = String(req.body.requested_by || `workflow:${workflowId}`).trim();
  const plan = buildWorkflowPlan(workflowId, options, safety, maxCommands);
  if (!plan.ok) {
    return res.status(plan.error === "workflow not found" ? 404 : 400).json({
      status: "error",
      error: plan.error,
      workflow_id: workflowId,
    });
  }

  const queued = queuePlannedCommands({
    commands: plan.guarded.allowed,
    routeMap: commandRouteByPath,
    store,
    requestedBy,
    clientHint,
  });

  return res.json({
    status: "ok",
    workflow: {
      id: plan.workflow.id,
      name: plan.workflow.name,
      description: plan.workflow.description,
      options: plan.options,
    },
    safety_policy: plan.guarded.policy,
    blocked_commands: plan.guarded.blocked,
    queued_count: queued.length,
    queued,
  });
});

app.post("/nova4d/introspection/request", requireApiKey, (req, res) => {
  const spec = commandRouteByPath.get("/nova4d/introspection/scene");
  return queueCommand(req, res, spec);
});

app.get("/nova4d/introspection/latest", requireApiKey, (req, res) => {
  const limit = parseInteger(req.query.limit, 1000, 1, 5000);
  const found = latestSceneSnapshot(limit);
  if (!found) {
    return res.status(404).json({
      status: "error",
      error: "no successful introspection snapshot found",
    });
  }
  return res.json({
    status: "ok",
    source: "cache",
    command_id: found.id,
    captured_at: found.completed_at || found.updated_at,
    delivered_to: found.delivered_to,
    summary: summarizeSnapshot(found.result),
    result: found.result,
  });
});

app.get("/nova4d/scene/graph", requireApiKey, async (req, res) => {
  const refresh = parseBoolean(req.query.refresh, false);
  const maxAgeMs = parseInteger(req.query.max_age_ms, 30000, 1000, 3600000);
  const snapshot = await resolveSceneSnapshot({
    refresh,
    maxAgeMs,
    requestedBy: "api:scene-graph",
    timeoutMs: parseInteger(req.query.timeout_ms, 8000, 500, 30000),
    payload: {
      max_objects: parseInteger(req.query.max_objects, 1500, 1, 5000),
      max_materials: parseInteger(req.query.max_materials, 1000, 1, 3000),
      include_paths: true,
    },
  });

  if (!snapshot.snapshot) {
    return res.status(404).json({
      status: "error",
      error: "scene snapshot unavailable",
      source: snapshot.source,
      warning: snapshot.warning,
    });
  }

  return res.json({
    status: "ok",
    source: snapshot.source,
    warning: snapshot.warning,
    age_ms: snapshot.age_ms,
    summary: summarizeSnapshot(snapshot.snapshot),
    graph: snapshot.snapshot,
  });
});

app.get("/nova4d/scene/objects", requireApiKey, async (req, res) => {
  const refresh = parseBoolean(req.query.refresh, false);
  const snapshot = await resolveSceneSnapshot({
    refresh,
    maxAgeMs: parseInteger(req.query.max_age_ms, 30000, 1000, 3600000),
    requestedBy: "api:scene-objects",
    timeoutMs: parseInteger(req.query.timeout_ms, 8000, 500, 30000),
  });

  if (!snapshot.snapshot) {
    return res.status(404).json({
      status: "error",
      error: "scene snapshot unavailable",
      source: snapshot.source,
      warning: snapshot.warning,
    });
  }

  const objects = Array.isArray(snapshot.snapshot.objects) ? snapshot.snapshot.objects : [];
  const filtered = filterObjectRows(objects, req);
  return res.json({
    status: "ok",
    source: snapshot.source,
    warning: snapshot.warning,
    age_ms: snapshot.age_ms,
    summary: summarizeSnapshot(snapshot.snapshot),
    total: filtered.total,
    count: filtered.items.length,
    limit: filtered.limit,
    offset: filtered.offset,
    objects: filtered.items,
  });
});

app.get("/nova4d/scene/materials", requireApiKey, async (req, res) => {
  const refresh = parseBoolean(req.query.refresh, false);
  const snapshot = await resolveSceneSnapshot({
    refresh,
    maxAgeMs: parseInteger(req.query.max_age_ms, 30000, 1000, 3600000),
    requestedBy: "api:scene-materials",
    timeoutMs: parseInteger(req.query.timeout_ms, 8000, 500, 30000),
  });

  if (!snapshot.snapshot) {
    return res.status(404).json({
      status: "error",
      error: "scene snapshot unavailable",
      source: snapshot.source,
      warning: snapshot.warning,
    });
  }

  const materials = Array.isArray(snapshot.snapshot.materials) ? snapshot.snapshot.materials : [];
  const filtered = filterMaterialRows(materials, req);
  return res.json({
    status: "ok",
    source: snapshot.source,
    warning: snapshot.warning,
    age_ms: snapshot.age_ms,
    summary: summarizeSnapshot(snapshot.snapshot),
    total: filtered.total,
    count: filtered.items.length,
    limit: filtered.limit,
    offset: filtered.offset,
    materials: filtered.items,
  });
});

app.get("/nova4d/scene/object", requireApiKey, async (req, res) => {
  const name = String(req.query.name || "").trim();
  const pathQuery = String(req.query.path || "").trim();
  if (!name && !pathQuery) {
    return res.status(400).json({
      status: "error",
      error: "name or path query param is required",
    });
  }

  const refresh = parseBoolean(req.query.refresh, false);
  const snapshot = await resolveSceneSnapshot({
    refresh,
    maxAgeMs: parseInteger(req.query.max_age_ms, 30000, 1000, 3600000),
    requestedBy: "api:scene-object",
    timeoutMs: parseInteger(req.query.timeout_ms, 8000, 500, 30000),
  });
  if (!snapshot.snapshot) {
    return res.status(404).json({
      status: "error",
      error: "scene snapshot unavailable",
      source: snapshot.source,
      warning: snapshot.warning,
    });
  }

  const objects = Array.isArray(snapshot.snapshot.objects) ? snapshot.snapshot.objects : [];
  let found = null;
  if (pathQuery) {
    found = objects.find((row) => String(row.path || "") === pathQuery) || null;
  }
  if (!found && name) {
    found = objects.find((row) => String(row.name || "") === name) || null;
  }
  if (!found) {
    return res.status(404).json({
      status: "error",
      error: "object not found in latest scene snapshot",
      source: snapshot.source,
    });
  }

  const objectPath = String(found.path || "");
  const descendants = objectPath
    ? objects.filter((row) => {
      const candidate = String(row.path || "");
      return candidate.startsWith(`${objectPath}/`);
    })
    : [];

  return res.json({
    status: "ok",
    source: snapshot.source,
    warning: snapshot.warning,
    age_ms: snapshot.age_ms,
    summary: summarizeSnapshot(snapshot.snapshot),
    object: found,
    descendants,
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
    supported_safety_modes: [
      "strict",
      "balanced",
      "unrestricted",
    ],
    defaults: {
      use_scene_context: true,
      refresh_scene_context: true,
      scene_context_max_age_ms: 30000,
      safety_mode: "balanced",
    },
  });
});

app.post("/nova4d/assistant/provider-test", requireApiKey, async (req, res) => {
  const provider = normalizeProvider(req.body.provider || {}, process.env);
  if (provider.kind !== "builtin" && (!provider.base_url || !provider.model)) {
    return res.status(400).json({
      status: "error",
      error: "provider base_url and model are required",
      provider: toPublicProvider(provider),
    });
  }

  try {
    const result = await testProviderConnection(provider, commandRoutes);
    return res.json({
      status: "ok",
      provider: toPublicProvider(provider),
      result,
    });
  } catch (err) {
    return res.status(502).json({
      status: "error",
      error: err.message,
      provider: toPublicProvider(provider),
    });
  }
});

app.post("/nova4d/assistant/plan", requireApiKey, async (req, res) => {
  const input = String(req.body.input || "").trim();
  if (!input) {
    return res.status(400).json({ status: "error", error: "input is required" });
  }

  const provider = normalizeProvider(req.body.provider || {}, process.env);
  const maxCommands = parseInteger(req.body.max_commands, 10, 1, 30);
  const safety = normalizeSafetyPolicy(req.body.safety || {});
  const useSceneContext = parseBoolean(req.body.use_scene_context, true);
  const refreshSceneContext = parseBoolean(req.body.refresh_scene_context, true);
  const sceneContextMaxAgeMs = parseInteger(req.body.scene_context_max_age_ms, 30000, 1000, 3600000);
  const sceneContextTimeoutMs = parseInteger(req.body.scene_context_timeout_ms, 8000, 500, 30000);

  const warnings = [];
  let sceneSnapshot = null;
  let sceneMeta = {
    enabled: useSceneContext,
    source: "disabled",
    warning: null,
    command_id: null,
    captured_at: null,
  };

  if (useSceneContext) {
    const contextResult = await resolveSceneSnapshot({
      refresh: refreshSceneContext,
      maxAgeMs: sceneContextMaxAgeMs,
      timeoutMs: sceneContextTimeoutMs,
      requestedBy: "assistant:plan-context",
    });
    sceneSnapshot = contextResult.snapshot || null;
    sceneMeta = {
      enabled: true,
      source: contextResult.source,
      warning: contextResult.warning,
      command_id: contextResult.command ? contextResult.command.id : null,
      captured_at: contextResult.command ? (contextResult.command.completed_at || contextResult.command.updated_at || null) : null,
    };
    if (contextResult.warning) {
      warnings.push(`scene_context: ${contextResult.warning}`);
    }
    if (!sceneSnapshot) {
      warnings.push("scene_context: unavailable");
    }
  }

  let plan;
  try {
    plan = await planCommands({
      input,
      provider,
      commandRoutes,
      routeMap: commandRouteByPath,
      maxCommands,
      sceneContext: sceneSnapshot,
    });
  } catch (err) {
    warnings.push(err.message);
    const builtinProvider = normalizeProvider({ kind: "builtin" }, process.env);
    plan = await planCommands({
      input,
      provider: builtinProvider,
      commandRoutes,
      routeMap: commandRouteByPath,
      maxCommands,
      sceneContext: sceneSnapshot,
    });
  }

  const guarded = applyCommandGuards(plan.commands, safety);
  const warning = warnings.length ? warnings.join(" | ") : null;

  return res.json({
    status: "ok",
    warning,
    warnings,
    provider: toPublicProvider(provider),
    safety_policy: guarded.policy,
    scene_context: Object.assign({}, sceneMeta, {
      summary: summarizeSnapshot(sceneSnapshot),
    }),
    plan: {
      mode: plan.mode,
      summary: plan.summary,
      commands: guarded.allowed,
    },
    blocked_commands: guarded.blocked,
    valid_command_count: guarded.allowed.length,
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
  const safety = normalizeSafetyPolicy(req.body.safety || {});
  const useSceneContext = parseBoolean(req.body.use_scene_context, true);
  const refreshSceneContext = parseBoolean(req.body.refresh_scene_context, true);
  const sceneContextMaxAgeMs = parseInteger(req.body.scene_context_max_age_ms, 30000, 1000, 3600000);
  const sceneContextTimeoutMs = parseInteger(req.body.scene_context_timeout_ms, 8000, 500, 30000);

  const warnings = [];
  let sceneSnapshot = null;
  let sceneMeta = {
    enabled: useSceneContext,
    source: "disabled",
    warning: null,
    command_id: null,
    captured_at: null,
  };

  if (useSceneContext) {
    const contextResult = await resolveSceneSnapshot({
      refresh: refreshSceneContext,
      maxAgeMs: sceneContextMaxAgeMs,
      timeoutMs: sceneContextTimeoutMs,
      requestedBy: "assistant:run-context",
    });
    sceneSnapshot = contextResult.snapshot || null;
    sceneMeta = {
      enabled: true,
      source: contextResult.source,
      warning: contextResult.warning,
      command_id: contextResult.command ? contextResult.command.id : null,
      captured_at: contextResult.command ? (contextResult.command.completed_at || contextResult.command.updated_at || null) : null,
    };
    if (contextResult.warning) {
      warnings.push(`scene_context: ${contextResult.warning}`);
    }
    if (!sceneSnapshot) {
      warnings.push("scene_context: unavailable");
    }
  }

  let plan;
  try {
    plan = await planCommands({
      input,
      provider,
      commandRoutes,
      routeMap: commandRouteByPath,
      maxCommands,
      sceneContext: sceneSnapshot,
    });
  } catch (err) {
    warnings.push(err.message);
    const builtinProvider = normalizeProvider({ kind: "builtin" }, process.env);
    plan = await planCommands({
      input,
      provider: builtinProvider,
      commandRoutes,
      routeMap: commandRouteByPath,
      maxCommands,
      sceneContext: sceneSnapshot,
    });
  }

  const guarded = applyCommandGuards(plan.commands, safety);

  const queued = queuePlannedCommands({
    commands: guarded.allowed,
    routeMap: commandRouteByPath,
    store,
    requestedBy: `assistant:${plan.mode}`,
    clientHint,
  });

  const warning = warnings.length ? warnings.join(" | ") : null;

  return res.json({
    status: "ok",
    warning,
    warnings,
    provider: toPublicProvider(provider),
    safety_policy: guarded.policy,
    scene_context: Object.assign({}, sceneMeta, {
      summary: summarizeSnapshot(sceneSnapshot),
    }),
    plan: {
      mode: plan.mode,
      summary: plan.summary,
      commands: guarded.allowed,
    },
    blocked_commands: guarded.blocked,
    queued_count: queued.length,
    queued,
  });
});

app.post("/nova4d/assistant/queue", requireApiKey, (req, res) => {
  const requestedBy = String(req.body.requested_by || "assistant:manual").trim();
  const clientHint = String(req.body.client_hint || "cinema4d-live").trim();
  const maxCommands = parseInteger(req.body.max_commands, 20, 1, 100);
  const safety = normalizeSafetyPolicy(req.body.safety || {});
  const incoming = Array.isArray(req.body.commands) ? req.body.commands : [];
  if (incoming.length === 0) {
    return res.status(400).json({ status: "error", error: "commands[] is required" });
  }

  const sanitized = sanitizeIncomingCommands(incoming, maxCommands);
  if (sanitized.length === 0) {
    return res.status(400).json({ status: "error", error: "no valid command routes in commands[]" });
  }

  const guarded = applyCommandGuards(sanitized, safety);
  const queued = queuePlannedCommands({
    commands: guarded.allowed,
    routeMap: commandRouteByPath,
    store,
    requestedBy,
    clientHint,
  });

  return res.json({
    status: "ok",
    safety_policy: guarded.policy,
    blocked_commands: guarded.blocked,
    queued_count: queued.length,
    queued,
  });
});

app.get("/nova4d/stats", requireApiKey, (_req, res) => {
  res.json({ status: "ok", stats: store.summary(), rate_limit: { window_ms: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_MAX } });
});

app.get("/nova4d/commands/recent", requireApiKey, (req, res) => {
  const limit = parseInteger(req.query.limit, 50, 1, 500);
  const statusFilter = String(req.query.status || "").trim().toLowerCase();
  const routeFilter = String(req.query.route || "").trim().toLowerCase();
  const actionFilter = String(req.query.action || "").trim().toLowerCase();
  const clientFilter = String(req.query.client || "").trim().toLowerCase();

  const statusSet = new Set(
    statusFilter
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );

  let commands = store.listRecent(500);
  if (statusSet.size > 0) {
    commands = commands.filter((command) => statusSet.has(String(command.status || "").toLowerCase()));
  }
  if (routeFilter) {
    commands = commands.filter((command) => String(command.route || "").toLowerCase().includes(routeFilter));
  }
  if (actionFilter) {
    commands = commands.filter((command) => String(command.action || "").toLowerCase().includes(actionFilter));
  }
  if (clientFilter) {
    commands = commands.filter((command) => String(command.delivered_to || "").toLowerCase().includes(clientFilter));
  }

  res.json({ status: "ok", commands: commands.slice(0, limit) });
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
  const routeSpec = commandRouteByPath.get(String(route));
  if (routeSpec) {
    const validation = validateQueuedPayload(routeSpec.path, payload || {});
    if (!validation.ok) {
      return res.status(400).json({
        status: "error",
        error: "payload validation failed",
        route: routeSpec.path,
        details: validation.errors,
      });
    }
  }

  const command = store.enqueue({
    route,
    category: category || (routeSpec ? routeSpec.category : "custom"),
    action: routeSpec ? routeSpec.action : action,
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
  const normalized = [];
  for (const cmd of commands) {
    const route = cmd.route || "/nova4d/custom";
    const routeSpec = commandRouteByPath.get(String(route));
    const payload = cmd.payload || {};
    if (routeSpec) {
      const validation = validateQueuedPayload(routeSpec.path, payload);
      if (!validation.ok) {
        return res.status(400).json({
          status: "error",
          error: "payload validation failed",
          route: routeSpec.path,
          details: validation.errors,
        });
      }
    }
    normalized.push({
      route,
      category: cmd.category || (routeSpec ? routeSpec.category : "custom"),
      action: routeSpec ? routeSpec.action : (cmd.action || "command"),
      payload,
      priority: parseInteger(cmd.priority, 0, -100, 100),
      metadata: cmd.metadata || {},
    });
  }
  const queued = store.enqueueBatch(normalized);
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
    ignored: Boolean(result.ignored),
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

app.post("/nova4d/commands/cancel-pending", requireApiKey, (_req, res) => {
  const result = store.cancelPending();
  return res.json({
    status: "ok",
    canceled_count: result.canceled_count,
    command_ids: result.command_ids,
  });
});

app.post("/nova4d/commands/retry-failed", requireApiKey, (req, res) => {
  const limit = parseInteger(req.body.limit, 20, 1, 200);
  const includeCanceled = parseBoolean(req.body.include_canceled, false);
  const result = store.retryFailed({
    limit,
    includeCanceled,
  });
  return res.json({
    status: "ok",
    requested_limit: result.requested_limit,
    include_canceled: result.include_canceled,
    requeued_count: result.requeued_count,
    command_ids: result.command_ids,
  });
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
