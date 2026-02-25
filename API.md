# Nova4D API

Copy-paste API reference for local Nova4D usage with Cinema 4D.

## Base Setup

```bash
BASE_URL="${BASE_URL:-http://127.0.0.1:30010}"
API_KEY="${NOVA4D_API_KEY:-}"
AUTH_HEADER=()
if [ -n "$API_KEY" ]; then AUTH_HEADER=(-H "X-API-Key: $API_KEY"); fi
```

## Core Endpoints

### Health

```bash
curl -s "${BASE_URL}/nova4d/health" "${AUTH_HEADER[@]}" | jq .
```

### Queue Stats

```bash
curl -s "${BASE_URL}/nova4d/stats" "${AUTH_HEADER[@]}" | jq .
```

### Recent Commands

```bash
curl -s "${BASE_URL}/nova4d/commands/recent?limit=50" "${AUTH_HEADER[@]}" | jq .
```

### Command By ID

```bash
curl -s "${BASE_URL}/nova4d/commands/<command_id>" "${AUTH_HEADER[@]}" | jq .
```

### Dispatch Commands To Client

```bash
curl -s "${BASE_URL}/nova4d/commands?client_id=cinema4d-live&limit=20" "${AUTH_HEADER[@]}" | jq .
```

### Queue Custom Command

```bash
curl -s -X POST "${BASE_URL}/nova4d/command" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "route": "/nova4d/test/ping",
  "category": "test",
  "action": "test-ping",
  "payload": {
    "message": "custom queue command"
  }
}' | jq .
```

### Queue Batch Commands

```bash
curl -s -X POST "${BASE_URL}/nova4d/commands/batch" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "commands": [
    {
      "route": "/nova4d/test/ping",
      "category": "test",
      "action": "test-ping",
      "payload": {
        "message": "batch-one"
      }
    },
    {
      "route": "/nova4d/test/ping",
      "category": "test",
      "action": "test-ping",
      "payload": {
        "message": "batch-two"
      }
    }
  ]
}' | jq .
```

### Post Command Result (worker -> bridge)

```bash
curl -s -X POST "${BASE_URL}/nova4d/results" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "command_id": "<command_id>",
  "ok": true,
  "status": "ok",
  "result": {
    "note": "completed by worker"
  }
}' | jq .
```

### Requeue Command

```bash
curl -s -X POST "${BASE_URL}/nova4d/commands/<command_id>/requeue" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq .
```

### Cancel Command

```bash
curl -s -X POST "${BASE_URL}/nova4d/commands/<command_id>/cancel" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq .
```

### Launch Immediate c4dpy Batch Render

```bash
curl -s -X POST "${BASE_URL}/nova4d/batch/render" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "scene_file": "/tmp/scene.c4d",
  "output_path": "/tmp/render-output",
  "timeout_sec": 900
}' | jq .
```

### Batch Jobs

```bash
curl -s "${BASE_URL}/nova4d/batch/jobs?limit=20" "${AUTH_HEADER[@]}" | jq .
```

### Batch Job By ID

```bash
curl -s "${BASE_URL}/nova4d/batch/jobs/<job_id>" "${AUTH_HEADER[@]}" | jq .
```

### Cancel Batch Job

```bash
curl -s -X POST "${BASE_URL}/nova4d/batch/jobs/<job_id>/cancel" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq .
```

## Upload Helper Endpoints

### Import Upload Helper (`/nova4d/io/import/upload`)

```bash
curl -s -X POST "${BASE_URL}/nova4d/io/import/upload" \
  "${AUTH_HEADER[@]}" \
  -F "file=@/tmp/asset.gltf" \
  -F "format=gltf" \
  -F "scale_factor=1.0" \
  -F "scale_fix=native" | jq .
```

### Blender Upload Helper (`/nova4d/blender/import/upload`)

```bash
curl -s -X POST "${BASE_URL}/nova4d/blender/import/upload" \
  "${AUTH_HEADER[@]}" \
  -F "file=@/tmp/blender-scene.gltf" \
  -F "format=gltf" \
  -F "scale_fix=blender_to_c4d" \
  -F "scale_factor=1.0" | jq .
```

### Export Upload Result Helper (`/nova4d/export/upload-result`)

```bash
curl -s -X POST "${BASE_URL}/nova4d/export/upload-result" \
  "${AUTH_HEADER[@]}" \
  -F "file=@/tmp/render-output.png" | jq .
```

## Command Routes (62)

All routes below queue commands for the Cinema 4D worker/plugin.

### Scene (12)

#### POST /nova4d/scene/spawn-object

```bash
curl -s -X POST "${BASE_URL}/nova4d/scene/spawn-object" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "object_type": "cube",
  "name": "ApiCube",
  "position": [
    0,
    120,
    0
  ],
  "scale": [
    1,
    1,
    1
  ]
}' | jq .
```

#### POST /nova4d/scene/set-transform

```bash
curl -s -X POST "${BASE_URL}/nova4d/scene/set-transform" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "target_name": "ApiCube",
  "position": [
    40,
    150,
    10
  ],
  "rotation": [
    0,
    45,
    0
  ],
  "scale": [
    1.2,
    1.2,
    1.2
  ]
}' | jq .
```

#### POST /nova4d/scene/set-property

```bash
curl -s -X POST "${BASE_URL}/nova4d/scene/set-property" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "target_name": "ApiCube",
  "property": "name",
  "value": "ApiCube_Renamed"
}' | jq .
```

#### POST /nova4d/scene/set-visibility

```bash
curl -s -X POST "${BASE_URL}/nova4d/scene/set-visibility" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "target_name": "ApiCube",
  "editor": 0,
  "render": 0
}' | jq .
```

#### POST /nova4d/scene/set-color

```bash
curl -s -X POST "${BASE_URL}/nova4d/scene/set-color" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "target_name": "ApiCube",
  "color": [
    0.3,
    0.8,
    0.5
  ]
}' | jq .
```

#### POST /nova4d/scene/delete-object

```bash
curl -s -X POST "${BASE_URL}/nova4d/scene/delete-object" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "target_name": "ApiCube"
}' | jq .
```

#### POST /nova4d/scene/duplicate-object

```bash
curl -s -X POST "${BASE_URL}/nova4d/scene/duplicate-object" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "target_name": "ApiCube",
  "new_name": "ApiCube_Copy"
}' | jq .
```

#### POST /nova4d/scene/group-objects

```bash
curl -s -X POST "${BASE_URL}/nova4d/scene/group-objects" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "object_names": [
    "ApiCube",
    "ApiCube_Copy"
  ],
  "group_name": "ApiGroup"
}' | jq .
```

#### POST /nova4d/scene/parent-object

```bash
curl -s -X POST "${BASE_URL}/nova4d/scene/parent-object" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "child_name": "ApiCube_Copy",
  "parent_name": "ApiGroup"
}' | jq .
```

#### POST /nova4d/scene/rename-object

```bash
curl -s -X POST "${BASE_URL}/nova4d/scene/rename-object" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "target_name": "ApiCube",
  "new_name": "ApiCube_Main"
}' | jq .
```

#### POST /nova4d/scene/select-object

```bash
curl -s -X POST "${BASE_URL}/nova4d/scene/select-object" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "target_name": "ApiCube_Main"
}' | jq .
```

#### POST /nova4d/scene/clear-selection

```bash
curl -s -X POST "${BASE_URL}/nova4d/scene/clear-selection" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq .
```

### Materials (6)

#### POST /nova4d/material/create-standard

```bash
curl -s -X POST "${BASE_URL}/nova4d/material/create-standard" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "name": "ApiStdMat",
  "color": [
    0.15,
    0.65,
    0.95
  ]
}' | jq .
```

#### POST /nova4d/material/create-redshift

```bash
curl -s -X POST "${BASE_URL}/nova4d/material/create-redshift" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "name": "ApiRSMat"
}' | jq .
```

#### POST /nova4d/material/create-arnold

```bash
curl -s -X POST "${BASE_URL}/nova4d/material/create-arnold" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "name": "ApiArnoldMat"
}' | jq .
```

#### POST /nova4d/material/assign

```bash
curl -s -X POST "${BASE_URL}/nova4d/material/assign" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "target_name": "ApiCube_Main",
  "material_name": "ApiStdMat"
}' | jq .
```

#### POST /nova4d/material/set-parameter

```bash
curl -s -X POST "${BASE_URL}/nova4d/material/set-parameter" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "material_name": "ApiStdMat",
  "parameter": "roughness",
  "value": 0.2
}' | jq .
```

#### POST /nova4d/material/set-texture

```bash
curl -s -X POST "${BASE_URL}/nova4d/material/set-texture" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "material_name": "ApiStdMat",
  "channel": "color",
  "texture_path": "/tmp/albedo.png"
}' | jq .
```

### MoGraph (8)

#### POST /nova4d/mograph/cloner/create

```bash
curl -s -X POST "${BASE_URL}/nova4d/mograph/cloner/create" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "name": "ApiCloner",
  "mode": "grid"
}' | jq .
```

#### POST /nova4d/mograph/matrix/create

```bash
curl -s -X POST "${BASE_URL}/nova4d/mograph/matrix/create" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "name": "ApiMatrix",
  "count": 20
}' | jq .
```

#### POST /nova4d/mograph/effector/random

```bash
curl -s -X POST "${BASE_URL}/nova4d/mograph/effector/random" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "name": "ApiRandomEffector",
  "position_strength": [
    30,
    30,
    30
  ]
}' | jq .
```

#### POST /nova4d/mograph/effector/plain

```bash
curl -s -X POST "${BASE_URL}/nova4d/mograph/effector/plain" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "name": "ApiPlainEffector",
  "scale_strength": [
    0.2,
    0.2,
    0.2
  ]
}' | jq .
```

#### POST /nova4d/mograph/effector/step

```bash
curl -s -X POST "${BASE_URL}/nova4d/mograph/effector/step" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "name": "ApiStepEffector"
}' | jq .
```

#### POST /nova4d/mograph/assign-effector

```bash
curl -s -X POST "${BASE_URL}/nova4d/mograph/assign-effector" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "cloner_name": "ApiCloner",
  "effector_name": "ApiRandomEffector"
}' | jq .
```

#### POST /nova4d/mograph/set-count

```bash
curl -s -X POST "${BASE_URL}/nova4d/mograph/set-count" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "cloner_name": "ApiCloner",
  "count": 50
}' | jq .
```

#### POST /nova4d/mograph/set-mode

```bash
curl -s -X POST "${BASE_URL}/nova4d/mograph/set-mode" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "cloner_name": "ApiCloner",
  "mode": "object"
}' | jq .
```

### XPresso (4)

#### POST /nova4d/xpresso/create-tag

```bash
curl -s -X POST "${BASE_URL}/nova4d/xpresso/create-tag" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "target_name": "ApiCube_Main"
}' | jq .
```

#### POST /nova4d/xpresso/add-node

```bash
curl -s -X POST "${BASE_URL}/nova4d/xpresso/add-node" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "target_name": "ApiCube_Main",
  "node_type": "object",
  "node_name": "CubeNode"
}' | jq .
```

#### POST /nova4d/xpresso/connect

```bash
curl -s -X POST "${BASE_URL}/nova4d/xpresso/connect" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "target_name": "ApiCube_Main",
  "from_node": "Time",
  "from_port": "Frame",
  "to_node": "CubeNode",
  "to_port": "Position.X"
}' | jq .
```

#### POST /nova4d/xpresso/set-parameter

```bash
curl -s -X POST "${BASE_URL}/nova4d/xpresso/set-parameter" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "target_name": "ApiCube_Main",
  "node_name": "CubeNode",
  "parameter": "Position.X",
  "value": 120
}' | jq .
```

### Animation (6)

#### POST /nova4d/animation/set-key

```bash
curl -s -X POST "${BASE_URL}/nova4d/animation/set-key" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "target_name": "ApiCube_Main",
  "parameter": "position.x",
  "frame": 0,
  "value": 0
}' | jq .
```

#### POST /nova4d/animation/delete-key

```bash
curl -s -X POST "${BASE_URL}/nova4d/animation/delete-key" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "target_name": "ApiCube_Main",
  "parameter": "position.x",
  "frame": 30
}' | jq .
```

#### POST /nova4d/animation/set-range

```bash
curl -s -X POST "${BASE_URL}/nova4d/animation/set-range" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "start_frame": 0,
  "end_frame": 120
}' | jq .
```

#### POST /nova4d/animation/play

```bash
curl -s -X POST "${BASE_URL}/nova4d/animation/play" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "from_frame": 0
}' | jq .
```

#### POST /nova4d/animation/stop

```bash
curl -s -X POST "${BASE_URL}/nova4d/animation/stop" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq .
```

#### POST /nova4d/animation/set-fps

```bash
curl -s -X POST "${BASE_URL}/nova4d/animation/set-fps" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "fps": 30
}' | jq .
```

### Rendering (6)

#### POST /nova4d/render/set-engine

```bash
curl -s -X POST "${BASE_URL}/nova4d/render/set-engine" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "engine": "redshift"
}' | jq .
```

#### POST /nova4d/render/frame

```bash
curl -s -X POST "${BASE_URL}/nova4d/render/frame" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "frame": 0,
  "output_path": "/tmp/nova4d-frame-0000.png"
}' | jq .
```

#### POST /nova4d/render/sequence

```bash
curl -s -X POST "${BASE_URL}/nova4d/render/sequence" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "start_frame": 0,
  "end_frame": 60,
  "output_path": "/tmp/nova4d-sequence"
}' | jq .
```

#### POST /nova4d/render/queue/redshift

```bash
curl -s -X POST "${BASE_URL}/nova4d/render/queue/redshift" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "scene_path": "/tmp/api_scene.c4d",
  "output_path": "/tmp/redshift-output"
}' | jq .
```

#### POST /nova4d/render/queue/arnold

```bash
curl -s -X POST "${BASE_URL}/nova4d/render/queue/arnold" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "scene_path": "/tmp/api_scene.c4d",
  "output_path": "/tmp/arnold-output"
}' | jq .
```

#### POST /nova4d/render/team-render/publish

```bash
curl -s -X POST "${BASE_URL}/nova4d/render/team-render/publish" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "scene_path": "/tmp/api_scene.c4d",
  "team_render_machine": "render-node-01"
}' | jq .
```

### Viewport (4)

#### POST /nova4d/viewport/set-camera

```bash
curl -s -X POST "${BASE_URL}/nova4d/viewport/set-camera" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "camera_name": "Camera"
}' | jq .
```

#### POST /nova4d/viewport/focus-object

```bash
curl -s -X POST "${BASE_URL}/nova4d/viewport/focus-object" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "target_name": "ApiCube_Main"
}' | jq .
```

#### POST /nova4d/viewport/screenshot

```bash
curl -s -X POST "${BASE_URL}/nova4d/viewport/screenshot" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "frame": 0,
  "output_path": "/tmp/nova4d-viewport.png"
}' | jq .
```

#### POST /nova4d/viewport/set-display-mode

```bash
curl -s -X POST "${BASE_URL}/nova4d/viewport/set-display-mode" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "mode": "gouraud"
}' | jq .
```

### Import / Export (7)

#### POST /nova4d/io/import/gltf

```bash
curl -s -X POST "${BASE_URL}/nova4d/io/import/gltf" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "file_path": "/tmp/sample.gltf",
  "scale_factor": 1
}' | jq .
```

#### POST /nova4d/io/import/fbx

```bash
curl -s -X POST "${BASE_URL}/nova4d/io/import/fbx" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "file_path": "/tmp/sample.fbx",
  "scale_factor": 1
}' | jq .
```

#### POST /nova4d/io/import/obj

```bash
curl -s -X POST "${BASE_URL}/nova4d/io/import/obj" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "file_path": "/tmp/sample.obj",
  "scale_factor": 1
}' | jq .
```

#### POST /nova4d/io/export/gltf

```bash
curl -s -X POST "${BASE_URL}/nova4d/io/export/gltf" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "output_path": "/tmp/export_scene.gltf"
}' | jq .
```

#### POST /nova4d/io/export/fbx

```bash
curl -s -X POST "${BASE_URL}/nova4d/io/export/fbx" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "output_path": "/tmp/export_scene.fbx"
}' | jq .
```

#### POST /nova4d/io/export/obj

```bash
curl -s -X POST "${BASE_URL}/nova4d/io/export/obj" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "output_path": "/tmp/export_scene.obj"
}' | jq .
```

#### POST /nova4d/io/export/alembic

```bash
curl -s -X POST "${BASE_URL}/nova4d/io/export/alembic" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "output_path": "/tmp/export_scene.abc",
  "start_frame": 0,
  "end_frame": 60
}' | jq .
```

### Blender Pipeline (2)

#### POST /nova4d/blender/import-gltf

```bash
curl -s -X POST "${BASE_URL}/nova4d/blender/import-gltf" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "file_path": "/tmp/blender_scene.gltf",
  "scale_fix": "blender_to_c4d",
  "scale_factor": 1
}' | jq .
```

#### POST /nova4d/blender/import-fbx

```bash
curl -s -X POST "${BASE_URL}/nova4d/blender/import-fbx" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "file_path": "/tmp/blender_scene.fbx",
  "scale_fix": "blender_to_c4d",
  "scale_factor": 1
}' | jq .
```

### System (3)

#### POST /nova4d/system/new-scene

```bash
curl -s -X POST "${BASE_URL}/nova4d/system/new-scene" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq .
```

#### POST /nova4d/system/open-scene

```bash
curl -s -X POST "${BASE_URL}/nova4d/system/open-scene" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "file_path": "/tmp/scene_to_open.c4d"
}' | jq .
```

#### POST /nova4d/system/save-scene

```bash
curl -s -X POST "${BASE_URL}/nova4d/system/save-scene" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "file_path": "/tmp/scene_saved.c4d"
}' | jq .
```

### Headless (2)

#### POST /nova4d/headless/render-queue

```bash
curl -s -X POST "${BASE_URL}/nova4d/headless/render-queue" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "scene_file": "/tmp/headless_scene.c4d",
  "output_path": "/tmp/headless-out",
  "timeout_sec": 900
}' | jq .
```

#### POST /nova4d/headless/c4dpy-script

```bash
curl -s -X POST "${BASE_URL}/nova4d/headless/c4dpy-script" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "script_path": "/tmp/headless_script.py",
  "args": [
    "--quality",
    "high"
  ]
}' | jq .
```

### Introspection (1)

#### POST /nova4d/introspection/scene

```bash
curl -s -X POST "${BASE_URL}/nova4d/introspection/scene" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "max_objects": 300,
  "max_materials": 120,
  "include_paths": true
}' | jq .
```

### Test (1)

#### POST /nova4d/test/ping

```bash
curl -s -X POST "${BASE_URL}/nova4d/test/ping" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "message": "Nova4D API connected"
}' | jq .
```

## AI Studio Endpoints

### GET /nova4d/capabilities

```bash
curl -s "${BASE_URL}/nova4d/capabilities" "${AUTH_HEADER[@]}" | jq .
```

### GET /nova4d/assistant/providers

```bash
curl -s "${BASE_URL}/nova4d/assistant/providers" "${AUTH_HEADER[@]}" | jq .
```

### POST /nova4d/assistant/provider-test

```bash
curl -s -X POST "${BASE_URL}/nova4d/assistant/provider-test" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "provider": {
    "kind": "openai",
    "base_url": "https://api.openai.com",
    "model": "gpt-4o-mini",
    "api_key": "'"${NOVA4D_AI_API_KEY:-}"'"
  }
}' | jq .
```

### POST /nova4d/assistant/plan

```bash
curl -s -X POST "${BASE_URL}/nova4d/assistant/plan" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "input": "Create a cube, cloner, and redshift material",
  "provider": {
    "kind": "builtin"
  },
  "safety": {
    "mode": "balanced",
    "allow_dangerous": false
  },
  "use_scene_context": true,
  "refresh_scene_context": true,
  "max_commands": 10
}' | jq .
```

### POST /nova4d/assistant/run

```bash
curl -s -X POST "${BASE_URL}/nova4d/assistant/run" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "input": "Animate a cube and render frame 0",
  "provider": {
    "kind": "builtin"
  },
  "safety": {
    "mode": "balanced",
    "allow_dangerous": false
  },
  "use_scene_context": true,
  "refresh_scene_context": true,
  "max_commands": 10
}' | jq .
```

### POST /nova4d/assistant/queue

```bash
curl -s -X POST "${BASE_URL}/nova4d/assistant/queue" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "requested_by": "assistant:manual",
  "safety": {
    "mode": "strict"
  },
  "commands": [
    {
      "route": "/nova4d/scene/spawn-object",
      "payload": { "object_type": "cube", "name": "ManualCube" }
    }
  ]
}' | jq .
```

Queue the exact last-reviewed plan (Studio "Queue Last Plan" pattern):

```bash
curl -s -X POST "${BASE_URL}/nova4d/assistant/queue" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "requested_by": "assistant:studio-approved-plan",
  "client_hint": "cinema4d-live",
  "safety": {
    "mode": "balanced",
    "allow_dangerous": false
  },
  "commands": [
    {
      "route": "/nova4d/scene/spawn-object",
      "payload": { "object_type": "cube", "name": "ApprovedCube" },
      "reason": "Reviewed plan item"
    }
  ]
}' | jq .
```

### POST /nova4d/introspection/request

```bash
curl -s -X POST "${BASE_URL}/nova4d/introspection/request" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
  "max_objects": 300,
  "max_materials": 120,
  "include_paths": true
}' | jq .
```

### GET /nova4d/introspection/latest

```bash
curl -s "${BASE_URL}/nova4d/introspection/latest" "${AUTH_HEADER[@]}" | jq .
```

## Scene Query Endpoints

### GET /nova4d/scene/graph

```bash
curl -s "${BASE_URL}/nova4d/scene/graph?refresh=1&max_objects=1000&max_materials=500" "${AUTH_HEADER[@]}" | jq .
```

### GET /nova4d/scene/objects

```bash
curl -s "${BASE_URL}/nova4d/scene/objects?q=cube&selected=false&limit=100" "${AUTH_HEADER[@]}" | jq .
```

### GET /nova4d/scene/materials

```bash
curl -s "${BASE_URL}/nova4d/scene/materials?q=redshift&limit=100" "${AUTH_HEADER[@]}" | jq .
```

### GET /nova4d/scene/object

```bash
curl -s "${BASE_URL}/nova4d/scene/object?name=AICube" "${AUTH_HEADER[@]}" | jq .
```

Studio UI:

- Open `http://localhost:30010/nova4d/studio`

## SSE Stream

```bash
curl -N "${BASE_URL}/nova4d/stream" "${AUTH_HEADER[@]}"
```
