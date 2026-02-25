"use strict";

const http = require("http");
const { Type } = require("@sinclair/typebox");

const BRIDGE_HOST = process.env.NOVA4D_HOST || "localhost";
const BRIDGE_PORT = parseInt(process.env.NOVA4D_PORT || "30010", 10);
const BRIDGE_API_KEY = process.env.NOVA4D_API_KEY || "";

function request(method, route, payload) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : null;
    const headers = { "Content-Type": "application/json" };
    if (BRIDGE_API_KEY) {
      headers["X-API-Key"] = BRIDGE_API_KEY;
    }
    if (body) {
      headers["Content-Length"] = Buffer.byteLength(body);
    }

    const req = http.request(
      {
        hostname: BRIDGE_HOST,
        port: BRIDGE_PORT,
        path: route,
        method,
        headers,
        timeout: 30000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (!data) {
            resolve({ status: "ok" });
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (_err) {
            resolve({ status: "ok", raw: data });
          }
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("request timed out"));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function wrapped(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

async function run(method, route, payload) {
  try {
    const response = await request(method, route, payload);
    return wrapped(response);
  } catch (err) {
    return wrapped({ status: "error", error: err.message });
  }
}

const QUEUE_PARAMS = Type.Object({
  priority: Type.Optional(Type.Number({ description: "Queue priority (-100 to 100)." })),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
  payload: Type.Optional(Type.Record(Type.String(), Type.Any())),
});

const POST_ROUTE_TOOLS = [
  ["c4d_scene_spawn_object", "Spawn Object", "/nova4d/scene/spawn-object", "Spawn a C4D object in the scene."],
  ["c4d_scene_set_transform", "Set Transform", "/nova4d/scene/set-transform", "Set object position/rotation/scale."],
  ["c4d_scene_set_property", "Set Property", "/nova4d/scene/set-property", "Set a property on a target object."],
  ["c4d_scene_set_visibility", "Set Visibility", "/nova4d/scene/set-visibility", "Set editor/render visibility."],
  ["c4d_scene_set_color", "Set Color", "/nova4d/scene/set-color", "Set object color metadata."],
  ["c4d_scene_delete_object", "Delete Object", "/nova4d/scene/delete-object", "Delete object by name/path."],
  ["c4d_scene_duplicate_object", "Duplicate Object", "/nova4d/scene/duplicate-object", "Duplicate selected target object."],
  ["c4d_scene_group_objects", "Group Objects", "/nova4d/scene/group-objects", "Create null group from objects."],
  ["c4d_material_create_standard", "Create Standard Material", "/nova4d/material/create-standard", "Create standard C4D material."],
  ["c4d_material_create_redshift", "Create Redshift Material", "/nova4d/material/create-redshift", "Create Redshift material in Cinema 4D."],
  ["c4d_material_create_arnold", "Create Arnold Material", "/nova4d/material/create-arnold", "Create Arnold material in Cinema 4D."],
  ["c4d_material_assign", "Assign Material", "/nova4d/material/assign", "Assign material to object."],
  ["c4d_mograph_create_cloner", "Create Cloner", "/nova4d/mograph/cloner/create", "Create MoGraph cloner."],
  ["c4d_mograph_random_effector", "Create Random Effector", "/nova4d/mograph/effector/random", "Create random effector."],
  ["c4d_mograph_assign_effector", "Assign Effector", "/nova4d/mograph/assign-effector", "Assign effector to cloner."],
  ["c4d_xpresso_create_tag", "Create XPresso Tag", "/nova4d/xpresso/create-tag", "Create XPresso tag on object."],
  ["c4d_xpresso_add_node", "Add XPresso Node", "/nova4d/xpresso/add-node", "Add node to XPresso graph."],
  ["c4d_animation_set_key", "Set Key", "/nova4d/animation/set-key", "Insert animation keyframe."],
  ["c4d_animation_set_range", "Set Timeline Range", "/nova4d/animation/set-range", "Set document frame range."],
  ["c4d_render_set_engine", "Set Render Engine", "/nova4d/render/set-engine", "Set render engine id/name."],
  ["c4d_render_frame", "Render Frame", "/nova4d/render/frame", "Render a frame through queue."],
  ["c4d_render_sequence", "Render Sequence", "/nova4d/render/sequence", "Render frame sequence."],
  ["c4d_render_redshift_queue", "Queue Redshift Render", "/nova4d/render/queue/redshift", "Queue Redshift render."],
  ["c4d_render_arnold_queue", "Queue Arnold Render", "/nova4d/render/queue/arnold", "Queue Arnold render."],
  ["c4d_viewport_set_camera", "Set Camera", "/nova4d/viewport/set-camera", "Switch active camera."],
  ["c4d_viewport_screenshot", "Viewport Screenshot", "/nova4d/viewport/screenshot", "Capture viewport screenshot."],
  ["c4d_import_gltf", "Import glTF", "/nova4d/io/import/gltf", "Import glTF into active scene."],
  ["c4d_import_fbx", "Import FBX", "/nova4d/io/import/fbx", "Import FBX into active scene."],
  ["c4d_export_gltf", "Export glTF", "/nova4d/io/export/gltf", "Export active scene to glTF."],
  ["c4d_export_fbx", "Export FBX", "/nova4d/io/export/fbx", "Export active scene to FBX."],
  ["c4d_blender_import_gltf", "Blender glTF Pipeline", "/nova4d/blender/import-gltf", "Import Blender-generated glTF with scale fix."],
  ["c4d_headless_render_queue", "Headless Render Queue", "/nova4d/headless/render-queue", "Queue render for c4dpy execution."],
  ["c4d_test_ping", "Bridge Test Ping", "/nova4d/test/ping", "Queue bridge connectivity test marker."],
];

module.exports = {
  id: "nova4d-cinema4d-bridge",
  name: "Nova4D Cinema 4D Bridge",
  description: "Queue Cinema 4D commands through Nova4D bridge",

  register(api) {
    api.registerTool({
      name: "c4d_health",
      label: "Nova4D Health",
      description: "Check Nova4D server health and queue status.",
      parameters: Type.Object({}),
      async execute() {
        return run("GET", "/nova4d/health");
      },
    });

    api.registerTool({
      name: "c4d_stats",
      label: "Queue Stats",
      description: "Get queue counters and status totals.",
      parameters: Type.Object({}),
      async execute() {
        return run("GET", "/nova4d/stats");
      },
    });

    api.registerTool({
      name: "c4d_recent_commands",
      label: "Recent Commands",
      description: "Get recently queued/dispatched commands.",
      parameters: Type.Object({
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 500 })),
      }),
      async execute(_id, params) {
        const limit = Math.max(1, Math.min(500, Number(params.limit || 50)));
        return run("GET", `/nova4d/commands/recent?limit=${limit}`);
      },
    });

    api.registerTool({
      name: "c4d_command_status",
      label: "Command Status",
      description: "Check status by command_id.",
      parameters: Type.Object({
        command_id: Type.String(),
      }),
      async execute(_id, params) {
        return run("GET", `/nova4d/commands/${encodeURIComponent(params.command_id)}`);
      },
    });

    api.registerTool({
      name: "c4d_queue_custom",
      label: "Queue Custom Command",
      description: "Queue any custom command route/action payload.",
      parameters: Type.Object({
        route: Type.String(),
        action: Type.String(),
        category: Type.Optional(Type.String()),
        priority: Type.Optional(Type.Number()),
        metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
        payload: Type.Optional(Type.Record(Type.String(), Type.Any())),
      }),
      async execute(_id, params) {
        return run("POST", "/nova4d/command", {
          route: params.route,
          action: params.action,
          category: params.category || "custom",
          priority: params.priority,
          metadata: params.metadata,
          payload: params.payload || {},
        });
      },
    });

    api.registerTool({
      name: "c4d_batch_render",
      label: "Batch Render (c4dpy)",
      description: "Launch an immediate c4dpy headless render job.",
      parameters: Type.Object({
        scene_file: Type.Optional(Type.String()),
        output_path: Type.Optional(Type.String()),
        timeout_sec: Type.Optional(Type.Number()),
        args: Type.Optional(Type.Array(Type.String())),
      }),
      async execute(_id, params) {
        return run("POST", "/nova4d/batch/render", params);
      },
    });

    api.registerTool({
      name: "c4d_batch_job_status",
      label: "Batch Job Status",
      description: "Get status of a headless c4dpy job.",
      parameters: Type.Object({
        job_id: Type.String(),
      }),
      async execute(_id, params) {
        return run("GET", `/nova4d/batch/jobs/${encodeURIComponent(params.job_id)}`);
      },
    });

    POST_ROUTE_TOOLS.forEach(([name, label, route, description]) => {
      api.registerTool({
        name,
        label,
        description,
        parameters: QUEUE_PARAMS,
        async execute(_id, params) {
          const body = Object.assign({}, params.payload || {});
          if (params.priority !== undefined) {
            body.priority = params.priority;
          }
          if (params.metadata !== undefined) {
            body.metadata = params.metadata;
          }
          return run("POST", route, body);
        },
      });
    });
  },
};
