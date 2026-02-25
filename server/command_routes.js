"use strict";

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

module.exports = {
  commandRoutes,
};
