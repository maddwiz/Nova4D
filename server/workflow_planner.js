"use strict";

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

function createWorkflowPlanner({ applyCommandGuards }) {
  if (typeof applyCommandGuards !== "function") {
    throw new Error("applyCommandGuards must be a function");
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

  return {
    WORKFLOW_SPECS,
    workflowDefaults,
    buildWorkflowCommands,
    buildWorkflowPlan,
  };
}

module.exports = {
  WORKFLOW_SPECS,
  workflowDefaults,
  buildWorkflowCommands,
  createWorkflowPlanner,
};
