"use strict";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com";
const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api";
const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const DEFAULT_MODEL_BY_PROVIDER = {
  builtin: "rules-v1",
  openai: "gpt-4o-mini",
  openrouter: "openai/gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-latest",
  "openai-compatible": "gpt-4o-mini",
};

function safeString(input, fallback = "") {
  if (typeof input === "string") {
    return input;
  }
  if (input === undefined || input === null) {
    return fallback;
  }
  return String(input);
}

function extractJsonObject(text) {
  const source = safeString(text).trim();
  if (!source) {
    return null;
  }

  try {
    return JSON.parse(source);
  } catch (_err) {
    // Continue to brace extraction.
  }

  const firstBrace = source.indexOf("{");
  const lastBrace = source.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  const slice = source.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(slice);
  } catch (_err) {
    return null;
  }
}

function clampInt(value, fallback, min, max) {
  const parsed = parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function clampFloat(value, fallback, min, max) {
  const parsed = Number.parseFloat(String(value ?? fallback));
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function normalizeProvider(input = {}, env = process.env) {
  const normalizedKind = safeString(input.kind || env.NOVA4D_AI_PROVIDER || "builtin").trim().toLowerCase();
  const kind = ["builtin", "openai", "openrouter", "anthropic", "openai-compatible"].includes(normalizedKind)
    ? normalizedKind
    : "builtin";

  const defaultBaseByKind = {
    openai: DEFAULT_OPENAI_BASE_URL,
    openrouter: DEFAULT_OPENROUTER_BASE_URL,
    anthropic: DEFAULT_ANTHROPIC_BASE_URL,
    "openai-compatible": safeString(env.NOVA4D_AI_BASE_URL || DEFAULT_OPENAI_BASE_URL),
    builtin: "",
  };

  const baseUrl = safeString(input.base_url || input.baseUrl || env.NOVA4D_AI_BASE_URL || defaultBaseByKind[kind]).trim();
  const apiKey = safeString(input.api_key || input.apiKey || env.NOVA4D_AI_API_KEY || "").trim();
  const model = safeString(input.model || env.NOVA4D_AI_MODEL || DEFAULT_MODEL_BY_PROVIDER[kind]).trim();
  const temperature = clampFloat(input.temperature, 0.2, 0, 1);
  const maxTokens = clampInt(input.max_tokens || input.maxTokens, 1200, 128, 4096);

  return {
    kind,
    base_url: baseUrl,
    model,
    api_key: apiKey,
    temperature,
    max_tokens: maxTokens,
    configured: kind === "builtin" || (baseUrl && model),
  };
}

function minimalCapabilities(commandRoutes) {
  const byCategory = {};
  commandRoutes.forEach((route) => {
    if (!byCategory[route.category]) {
      byCategory[route.category] = [];
    }
    byCategory[route.category].push(route.path);
  });

  return {
    total_routes: commandRoutes.length,
    categories: Object.keys(byCategory).sort().map((category) => ({
      category,
      count: byCategory[category].length,
      routes: byCategory[category],
    })),
    voice_input_supported_in_browser: true,
    ai_providers: [
      "builtin",
      "openai",
      "openrouter",
      "anthropic",
      "openai-compatible",
    ],
  };
}

function summarizeSceneContext(sceneContext, maxObjects = 80, maxMaterials = 40) {
  const context = sceneContext && typeof sceneContext === "object" ? sceneContext : null;
  if (!context) {
    return null;
  }

  const objects = Array.isArray(context.objects) ? context.objects.slice(0, maxObjects) : [];
  const materials = Array.isArray(context.materials) ? context.materials.slice(0, maxMaterials) : [];
  const objectLines = objects.map((obj) => {
    const name = safeString(obj.name || "").trim();
    const path = safeString(obj.path || "").trim();
    const type = safeString(obj.type_id || "").trim();
    const selected = obj.selected ? " selected" : "";
    return `- ${name}${path ? ` | ${path}` : ""}${type ? ` | type ${type}` : ""}${selected}`;
  });
  const materialLines = materials.map((mat) => `- ${safeString(mat.name || "").trim()}`);

  return {
    document_name: safeString(context.document_name || ""),
    active_object: safeString(context.active_object || ""),
    fps: context.fps,
    counts: context.counts || {},
    object_lines: objectLines,
    material_lines: materialLines,
    raw: context,
  };
}

function pickReferencedObjectName(text, sceneContextSummary) {
  if (!sceneContextSummary || !Array.isArray(sceneContextSummary.raw?.objects)) {
    return null;
  }
  const lowered = safeString(text).toLowerCase();
  const objects = sceneContextSummary.raw.objects.slice(0, 300);
  for (const obj of objects) {
    const name = safeString(obj.name || "").trim();
    if (name && lowered.includes(name.toLowerCase())) {
      return name;
    }
  }
  return null;
}

function defaultObjectTarget(sceneContextSummary) {
  if (!sceneContextSummary) {
    return null;
  }
  const preferred = safeString(sceneContextSummary.active_object || "").trim();
  if (preferred) {
    return preferred;
  }
  const first = sceneContextSummary.raw?.objects?.[0];
  if (first && first.name) {
    return safeString(first.name).trim();
  }
  return null;
}

function fallbackPlanFromText(input, maxCommands, sceneContext = null) {
  const text = safeString(input).toLowerCase();
  const sceneSummary = summarizeSceneContext(sceneContext);
  const commands = [];

  const wantCube = /cube|object|spawn|create/.test(text);
  const wantCloner = /cloner|mograph|clone/.test(text);
  const wantRedshift = /redshift/.test(text);
  const wantAnimate = /animate|animation|key|move/.test(text);
  const wantRender = /render|frame|image|screenshot/.test(text);
  const wantBlenderImport = /blender|gltf import|import gltf/.test(text);
  const wantSnapshot = /snapshot|introspect|inspect|list objects|what.?s in scene|scene summary/.test(text);
  const promptTarget = pickReferencedObjectName(text, sceneSummary);
  const defaultTarget = promptTarget || defaultObjectTarget(sceneSummary) || "AICube";

  if (wantSnapshot) {
    commands.push({
      route: "/nova4d/introspection/scene",
      payload: { max_objects: 300, max_materials: 120, include_paths: true },
      reason: "Capture current scene context.",
    });
  }

  if (wantCube) {
    commands.push({
      route: "/nova4d/scene/spawn-object",
      payload: { object_type: "cube", name: "AICube", position: [0, 120, 0] },
      reason: "Create a base object to manipulate.",
    });
  }

  if (wantCloner) {
    commands.push({
      route: "/nova4d/mograph/cloner/create",
      payload: { name: "AICloner" },
      reason: "Add a MoGraph cloner.",
    });
  }

  if (wantRedshift) {
    commands.push({
      route: "/nova4d/material/create-redshift",
      payload: { name: "AIRedshiftMat" },
      reason: "Create a Redshift material.",
    });
  }

  if (wantAnimate) {
    commands.push({
      route: "/nova4d/animation/set-key",
      payload: { target_name: defaultTarget, parameter: "position.x", frame: 0, value: 0 },
      reason: "Animation start key.",
    });
    commands.push({
      route: "/nova4d/animation/set-key",
      payload: { target_name: defaultTarget, parameter: "position.x", frame: 30, value: 180 },
      reason: "Animation end key.",
    });
  }

  if (wantRender) {
    commands.push({
      route: "/nova4d/render/frame",
      payload: { frame: 0, output_path: "/tmp/nova4d-ai-studio-frame.png" },
      reason: "Render preview frame.",
    });
  }

  if (wantBlenderImport) {
    commands.push({
      route: "/nova4d/blender/import-gltf",
      payload: {
        file_path: "/tmp/nova4d-smoke-blender.gltf",
        scale_fix: "blender_to_c4d",
        scale_factor: 1.0,
      },
      reason: "Import Blender glTF asset.",
    });
  }

  const trimmed = commands.slice(0, maxCommands);
  if (trimmed.length === 0) {
    trimmed.push({
      route: "/nova4d/test/ping",
      payload: { message: "AI request received. Ask for a concrete scene action." },
      reason: "Fallback acknowledgement.",
    });
  }

  return {
    mode: "builtin",
    summary: sceneSummary
      ? "Generated by local fallback planner with scene context."
      : "Generated by local fallback planner.",
    commands: trimmed,
    raw_response: null,
  };
}

function buildPlannerPrompt(commandRoutes, maxCommands, sceneContext = null) {
  const routeList = commandRoutes
    .map((route) => `${route.path} | ${route.category} | ${route.action}`)
    .join("\n");
  const sceneSummary = summarizeSceneContext(sceneContext);

  const sceneSection = sceneSummary
    ? [
      "Live scene context:",
      `document: ${sceneSummary.document_name || "unknown"}`,
      `active_object: ${sceneSummary.active_object || "none"}`,
      `fps: ${sceneSummary.fps ?? "unknown"}`,
      `object_count: ${sceneSummary.counts?.objects_total ?? sceneSummary.raw?.objects?.length ?? 0}`,
      `material_count: ${sceneSummary.counts?.materials_total ?? sceneSummary.raw?.materials?.length ?? 0}`,
      "objects:",
      ...(sceneSummary.object_lines.length ? sceneSummary.object_lines : ["- none"]),
      "materials:",
      ...(sceneSummary.material_lines.length ? sceneSummary.material_lines : ["- none"]),
    ].join("\n")
    : "Live scene context: unavailable";

  const system = [
    "You are Nova4D Planner.",
    "Convert user intent into safe, minimal command plans for Cinema 4D.",
    `Return only valid JSON with <= ${maxCommands} commands.`,
    "Allowed routes are listed below and cannot be invented.",
    "Output schema:",
    "{\"summary\":\"...\",\"commands\":[{\"route\":\"/nova4d/...\",\"payload\":{},\"reason\":\"...\"}]}",
    "Rules:",
    "- Use deterministic object/material names.",
    "- Keep payloads concise.",
    "- If unclear, emit /nova4d/test/ping with guidance.",
    "- Prefer existing scene objects/materials when possible.",
    sceneSection,
    "Allowed routes:",
    routeList,
  ].join("\n");

  return system;
}

async function callOpenAICompatible(provider, systemPrompt, userPrompt) {
  const base = provider.base_url.replace(/\/$/, "");
  const url = `${base}/v1/chat/completions`;
  const headers = {
    "Content-Type": "application/json",
  };
  if (provider.api_key) {
    headers.Authorization = `Bearer ${provider.api_key}`;
  }
  if (provider.kind === "openrouter") {
    headers["HTTP-Referer"] = "https://localhost/nova4d";
    headers["X-Title"] = "Nova4D Studio";
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: provider.model,
      temperature: provider.temperature,
      max_tokens: provider.max_tokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`provider_error:${response.status} ${bodyText.slice(0, 400)}`);
  }

  const parsed = extractJsonObject(bodyText) || {};
  const content = parsed.choices?.[0]?.message?.content;
  const contentText = typeof content === "string" ? content : JSON.stringify(content || "");
  return {
    raw: bodyText,
    text: contentText,
    json: extractJsonObject(contentText),
  };
}

async function callAnthropic(provider, systemPrompt, userPrompt) {
  const base = provider.base_url.replace(/\/$/, "");
  const url = `${base}/v1/messages`;
  const headers = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
  };
  if (provider.api_key) {
    headers["x-api-key"] = provider.api_key;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: provider.model,
      max_tokens: provider.max_tokens,
      temperature: provider.temperature,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`provider_error:${response.status} ${bodyText.slice(0, 400)}`);
  }

  const parsed = extractJsonObject(bodyText) || {};
  const content = Array.isArray(parsed.content) ? parsed.content : [];
  const textChunk = content.find((chunk) => chunk && chunk.type === "text");
  const contentText = textChunk ? String(textChunk.text || "") : "";
  return {
    raw: bodyText,
    text: contentText,
    json: extractJsonObject(contentText),
  };
}

function sanitizePlan(candidate, routeMap, maxCommands) {
  const summary = safeString(candidate?.summary || "").slice(0, 4000);
  const rows = Array.isArray(candidate?.commands) ? candidate.commands : [];
  const commands = [];

  rows.forEach((row) => {
    if (commands.length >= maxCommands) {
      return;
    }
    const route = safeString(row?.route || "").trim();
    if (!routeMap.has(route)) {
      return;
    }

    const payload = row?.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? row.payload
      : {};

    const reason = safeString(row?.reason || "").slice(0, 800);
    const priority = clampInt(row?.priority, 0, -100, 100);

    commands.push({
      route,
      payload,
      reason,
      priority,
    });
  });

  return {
    summary: summary || "AI-generated command plan",
    commands,
  };
}

async function planCommands({ input, provider, commandRoutes, routeMap, maxCommands, sceneContext = null }) {
  if (provider.kind === "builtin") {
    return fallbackPlanFromText(input, maxCommands, sceneContext);
  }

  const systemPrompt = buildPlannerPrompt(commandRoutes, maxCommands, sceneContext);
  const userPrompt = safeString(input).slice(0, 12000);

  let providerOutput;
  if (provider.kind === "anthropic") {
    providerOutput = await callAnthropic(provider, systemPrompt, userPrompt);
  } else {
    providerOutput = await callOpenAICompatible(provider, systemPrompt, userPrompt);
  }

  const parsedJson = providerOutput.json || extractJsonObject(providerOutput.text || "") || {};
  const sanitized = sanitizePlan(parsedJson, routeMap, maxCommands);

  if (sanitized.commands.length === 0) {
    const fallback = fallbackPlanFromText(input, maxCommands, sceneContext);
    return {
      mode: `${provider.kind}-fallback`,
      summary: `${sanitized.summary || "Model returned no valid routes."} Fallback plan applied.`,
      commands: fallback.commands,
      raw_response: providerOutput.raw,
    };
  }

  return {
    mode: provider.kind,
    summary: sanitized.summary,
    commands: sanitized.commands,
    raw_response: providerOutput.raw,
  };
}

async function testProviderConnection(provider, commandRoutes = []) {
  const startedAt = Date.now();
  if (!provider || provider.kind === "builtin") {
    return {
      ok: true,
      mode: "builtin",
      latency_ms: 0,
      details: "Builtin planner is local and ready.",
    };
  }

  const systemPrompt = buildPlannerPrompt(commandRoutes.slice(0, 20), 1, null);
  const userPrompt = "Connectivity test: return one /nova4d/test/ping command.";
  let providerOutput;
  if (provider.kind === "anthropic") {
    providerOutput = await callAnthropic(provider, systemPrompt, userPrompt);
  } else {
    providerOutput = await callOpenAICompatible(provider, systemPrompt, userPrompt);
  }

  const parsedJson = providerOutput.json || extractJsonObject(providerOutput.text || "") || {};
  const commandCount = Array.isArray(parsedJson.commands) ? parsedJson.commands.length : 0;
  return {
    ok: true,
    mode: provider.kind,
    latency_ms: Date.now() - startedAt,
    model: provider.model,
    command_count: commandCount,
    response_preview: safeString(providerOutput.text || "").slice(0, 220),
  };
}

function queuePlannedCommands({ commands, routeMap, store, requestedBy, clientHint }) {
  const queued = [];
  commands.forEach((item) => {
    const spec = routeMap.get(item.route);
    if (!spec) {
      return;
    }
    const command = store.enqueue({
      route: spec.path,
      category: spec.category,
      action: spec.action,
      payload: item.payload || {},
      priority: clampInt(item.priority, 0, -100, 100),
      metadata: {
        requested_by: requestedBy || "assistant",
        client_hint: clientHint || null,
        assistant_reason: safeString(item.reason || "").slice(0, 800),
      },
    });
    queued.push({
      id: command.id,
      route: command.route,
      action: command.action,
      status: command.status,
      queued_at: command.created_at,
    });
  });
  return queued;
}

module.exports = {
  minimalCapabilities,
  normalizeProvider,
  summarizeSceneContext,
  fallbackPlanFromText,
  planCommands,
  testProviderConnection,
  queuePlannedCommands,
};
