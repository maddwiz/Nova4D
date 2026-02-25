"use strict";

const ROUTE_RULES = {
  "/nova4d/scene/spawn-object": {
    description: "Create a scene object.",
    risk: "safe",
    optional: ["object_type", "name", "position", "rotation", "scale", "parent_name"],
  },
  "/nova4d/scene/set-transform": {
    description: "Set position, rotation, or scale on an existing object.",
    risk: "safe",
    any_of: [["target_name", "target_path"]],
    at_least_one_of: ["position", "rotation", "scale"],
  },
  "/nova4d/scene/set-property": {
    description: "Set object property.",
    risk: "moderate",
    any_of: [["target_name", "target_path"]],
    required: ["property", "value"],
  },
  "/nova4d/scene/set-visibility": {
    description: "Set object editor/render visibility.",
    risk: "safe",
    any_of: [["target_name", "target_path"]],
    at_least_one_of: ["editor", "render"],
  },
  "/nova4d/scene/set-color": {
    description: "Set object color.",
    risk: "safe",
    any_of: [["target_name", "target_path"]],
    required: ["color"],
  },
  "/nova4d/scene/delete-object": {
    description: "Delete object from scene.",
    risk: "dangerous",
    any_of: [["target_name", "target_path", "name"]],
  },
  "/nova4d/scene/duplicate-object": {
    description: "Duplicate object.",
    risk: "safe",
    any_of: [["target_name", "target_path", "name"]],
    optional: ["new_name", "parent_name"],
  },
  "/nova4d/scene/group-objects": {
    description: "Group objects under null.",
    risk: "safe",
    required: ["object_names"],
    optional: ["group_name"],
  },
  "/nova4d/scene/parent-object": {
    description: "Parent one object under another.",
    risk: "safe",
    required: ["child_name", "parent_name"],
  },
  "/nova4d/scene/rename-object": {
    description: "Rename object.",
    risk: "safe",
    any_of: [["target_name", "target_path", "name"]],
    required: ["new_name"],
  },
  "/nova4d/scene/select-object": {
    description: "Select object.",
    risk: "safe",
    any_of: [["target_name", "target_path", "name"]],
  },
  "/nova4d/scene/clear-selection": {
    description: "Clear scene selection.",
    risk: "safe",
  },

  "/nova4d/material/create-standard": {
    description: "Create standard material.",
    risk: "safe",
    optional: ["name", "color"],
  },
  "/nova4d/material/create-redshift": {
    description: "Create Redshift material (falls back if renderer plugin is unavailable).",
    risk: "safe",
    optional: ["name"],
  },
  "/nova4d/material/create-arnold": {
    description: "Create Arnold material (falls back if renderer plugin is unavailable).",
    risk: "safe",
    optional: ["name"],
  },
  "/nova4d/material/assign": {
    description: "Assign material to object.",
    risk: "safe",
    required: ["target_name", "material_name"],
  },
  "/nova4d/material/set-parameter": {
    description: "Set material parameter.",
    risk: "moderate",
    required: ["material_name", "parameter", "value"],
  },
  "/nova4d/material/set-texture": {
    description: "Set material texture path.",
    risk: "moderate",
    required: ["material_name", "texture_path"],
  },

  "/nova4d/mograph/cloner/create": {
    description: "Create cloner object.",
    risk: "safe",
    optional: ["name", "parent_name"],
  },
  "/nova4d/mograph/matrix/create": {
    description: "Create matrix object.",
    risk: "safe",
    optional: ["name", "parent_name"],
  },
  "/nova4d/mograph/effector/random": {
    description: "Create random effector.",
    risk: "safe",
    optional: ["name", "parent_name"],
  },
  "/nova4d/mograph/effector/plain": {
    description: "Create plain effector.",
    risk: "safe",
    optional: ["name", "parent_name"],
  },
  "/nova4d/mograph/effector/step": {
    description: "Create step effector.",
    risk: "safe",
    optional: ["name", "parent_name"],
  },
  "/nova4d/mograph/assign-effector": {
    description: "Assign effector metadata.",
    risk: "safe",
    required: ["cloner_name", "effector_name"],
  },
  "/nova4d/mograph/set-count": {
    description: "Set cloner count by parameter ID.",
    risk: "moderate",
    any_of: [["cloner_name", "target_name"]],
    required: ["count", "parameter_id"],
  },
  "/nova4d/mograph/set-mode": {
    description: "Set cloner mode by parameter ID.",
    risk: "moderate",
    any_of: [["cloner_name", "target_name"]],
    required: ["mode", "parameter_id"],
  },

  "/nova4d/xpresso/create-tag": {
    description: "Create XPresso tag.",
    risk: "safe",
    optional: ["target_name", "name"],
  },
  "/nova4d/xpresso/add-node": {
    description: "Add XPresso node to tag graph.",
    risk: "moderate",
  },
  "/nova4d/xpresso/connect": {
    description: "Connect XPresso ports between nodes.",
    risk: "moderate",
  },
  "/nova4d/xpresso/set-parameter": {
    description: "Set XPresso parameter and apply target value.",
    risk: "moderate",
  },

  "/nova4d/animation/set-key": {
    description: "Set animation key.",
    risk: "safe",
    any_of: [["target_name", "target_path", "name"]],
    required: ["parameter", "value"],
    optional: ["frame", "interpolation"],
  },
  "/nova4d/animation/delete-key": {
    description: "Delete animation key.",
    risk: "moderate",
    any_of: [["target_name", "target_path", "name"]],
    required: ["parameter"],
    optional: ["frame"],
  },
  "/nova4d/animation/set-range": {
    description: "Set timeline range.",
    risk: "safe",
    optional: ["start_frame", "end_frame"],
  },
  "/nova4d/animation/play": {
    description: "Play animation from frame/time cursor.",
    risk: "safe",
  },
  "/nova4d/animation/stop": {
    description: "Stop animation playback.",
    risk: "safe",
  },
  "/nova4d/animation/set-fps": {
    description: "Set document FPS.",
    risk: "moderate",
    optional: ["fps"],
  },

  "/nova4d/render/set-engine": {
    description: "Set render engine ID.",
    risk: "moderate",
    any_of: [["engine", "engine_id"]],
  },
  "/nova4d/render/frame": {
    description: "Render frame.",
    risk: "moderate",
    optional: ["frame", "output_path"],
  },
  "/nova4d/render/sequence": {
    description: "Render frame sequence.",
    risk: "moderate",
    optional: ["start_frame", "end_frame", "step", "output_path"],
  },
  "/nova4d/render/queue/redshift": {
    description: "Queue redshift render.",
    risk: "moderate",
  },
  "/nova4d/render/queue/arnold": {
    description: "Queue arnold render.",
    risk: "moderate",
  },
  "/nova4d/render/team-render/publish": {
    description: "Publish scene for Team Render.",
    risk: "moderate",
  },

  "/nova4d/viewport/set-camera": {
    description: "Set active camera.",
    risk: "safe",
    any_of: [["camera_name", "target_name", "name"]],
  },
  "/nova4d/viewport/focus-object": {
    description: "Frame/focus object or selection.",
    risk: "safe",
    optional: ["target_name", "target_path", "name"],
  },
  "/nova4d/viewport/screenshot": {
    description: "Capture viewport screenshot.",
    risk: "safe",
    optional: ["frame", "output_path"],
  },
  "/nova4d/viewport/set-display-mode": {
    description: "Set viewport display mode.",
    risk: "safe",
    any_of: [["mode", "display_mode"]],
  },

  "/nova4d/io/import/gltf": {
    description: "Import glTF file.",
    risk: "moderate",
    required: ["file_path"],
  },
  "/nova4d/io/import/fbx": {
    description: "Import FBX file.",
    risk: "moderate",
    required: ["file_path"],
  },
  "/nova4d/io/import/obj": {
    description: "Import OBJ file.",
    risk: "moderate",
    required: ["file_path"],
  },
  "/nova4d/io/export/gltf": {
    description: "Export glTF file.",
    risk: "moderate",
    any_of: [["output_path", "file_path"]],
  },
  "/nova4d/io/export/fbx": {
    description: "Export FBX file.",
    risk: "moderate",
    any_of: [["output_path", "file_path"]],
  },
  "/nova4d/io/export/obj": {
    description: "Export OBJ file.",
    risk: "moderate",
    any_of: [["output_path", "file_path"]],
  },
  "/nova4d/io/export/alembic": {
    description: "Export Alembic file.",
    risk: "moderate",
    any_of: [["output_path", "file_path"]],
  },

  "/nova4d/blender/import-gltf": {
    description: "Import Blender glTF with scale fix.",
    risk: "moderate",
    required: ["file_path"],
  },
  "/nova4d/blender/import-fbx": {
    description: "Import Blender FBX with scale fix.",
    risk: "moderate",
    required: ["file_path"],
  },

  "/nova4d/system/new-scene": {
    description: "Create new scene, replacing active doc.",
    risk: "dangerous",
  },
  "/nova4d/system/open-scene": {
    description: "Open scene file.",
    risk: "dangerous",
    required: ["file_path"],
  },
  "/nova4d/system/save-scene": {
    description: "Save scene file.",
    risk: "moderate",
    required: ["file_path"],
  },

  "/nova4d/headless/render-queue": {
    description: "Queue headless render.",
    risk: "moderate",
  },
  "/nova4d/headless/c4dpy-script": {
    description: "Queue c4dpy script execution.",
    risk: "dangerous",
  },

  "/nova4d/test/ping": {
    description: "Queue test ping command.",
    risk: "safe",
    optional: ["message"],
  },

  "/nova4d/introspection/scene": {
    description: "Collect scene summary snapshot from active C4D document.",
    risk: "safe",
    optional: ["max_objects", "max_materials", "include_paths"],
  },
};

function getRule(route) {
  return ROUTE_RULES[route] || { description: "No explicit schema", risk: "safe" };
}

function getRisk(route) {
  return getRule(route).risk || "safe";
}

function hasOwn(payload, key) {
  return payload && Object.prototype.hasOwnProperty.call(payload, key);
}

function validatePayload(route, payload) {
  const rule = getRule(route);
  const data = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
  if (!data) {
    return {
      ok: false,
      errors: ["payload must be an object"],
      warnings: [],
      rule,
    };
  }

  const errors = [];
  const warnings = [];

  (rule.required || []).forEach((key) => {
    if (!hasOwn(data, key)) {
      errors.push(`missing required field: ${key}`);
    }
  });

  (rule.any_of || []).forEach((group) => {
    const matched = group.some((key) => hasOwn(data, key));
    if (!matched) {
      errors.push(`one of [${group.join(", ")}] is required`);
    }
  });

  if (Array.isArray(rule.at_least_one_of) && rule.at_least_one_of.length) {
    const matched = rule.at_least_one_of.some((key) => hasOwn(data, key));
    if (!matched) {
      errors.push(`at least one of [${rule.at_least_one_of.join(", ")}] is required`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    rule,
  };
}

function buildCatalog(commandRoutes) {
  return commandRoutes.map((route) => {
    const rule = getRule(route.path);
    return {
      path: route.path,
      category: route.category,
      action: route.action,
      description: rule.description,
      risk: rule.risk || "safe",
      required: rule.required || [],
      any_of: rule.any_of || [],
      at_least_one_of: rule.at_least_one_of || [],
      optional: rule.optional || [],
    };
  });
}

function normalizeSafetyPolicy(input = {}) {
  const modeRaw = String(input.mode || "balanced").toLowerCase().trim();
  const mode = ["strict", "balanced", "unrestricted"].includes(modeRaw) ? modeRaw : "balanced";

  return {
    mode,
    allow_dangerous: input.allow_dangerous === true,
  };
}

function filterCommandsBySafety(commands, routeRiskResolver, policyInput) {
  const policy = normalizeSafetyPolicy(policyInput || {});
  const allowed = [];
  const blocked = [];

  (commands || []).forEach((command) => {
    const risk = routeRiskResolver(command.route);
    let blockedReason = null;

    if (policy.mode === "strict" && risk !== "safe") {
      blockedReason = `blocked by strict safety mode (${risk})`;
    } else if (policy.mode === "balanced" && risk === "dangerous" && !policy.allow_dangerous) {
      blockedReason = "blocked dangerous action (set allow_dangerous=true to override)";
    }

    if (blockedReason) {
      blocked.push({
        route: command.route,
        reason: blockedReason,
        risk,
        payload: command.payload || {},
      });
      return;
    }

    allowed.push(command);
  });

  return { policy, allowed, blocked };
}

module.exports = {
  ROUTE_RULES,
  getRisk,
  validatePayload,
  buildCatalog,
  normalizeSafetyPolicy,
  filterCommandsBySafety,
};
