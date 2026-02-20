# Nova4D API (v1.0.0)

Base URL: `http://localhost:30010`

If `NOVA4D_API_KEY` is set, include header:

```text
X-API-Key: <key>
```

## Core Queue Endpoints

- `GET /nova4d/health`
- `GET /nova4d/stats`
- `GET /nova4d/stream`
- `GET /nova4d/commands`
- `GET /nova4d/commands/recent`
- `GET /nova4d/commands/:id`
- `POST /nova4d/command`
- `POST /nova4d/commands/batch`
- `POST /nova4d/results`
- `POST /nova4d/commands/:id/requeue`
- `POST /nova4d/commands/:id/cancel`

## Command Route Index (60+)

### Scene

- `POST /nova4d/scene/spawn-object`
- `POST /nova4d/scene/set-transform`
- `POST /nova4d/scene/set-property`
- `POST /nova4d/scene/set-visibility`
- `POST /nova4d/scene/set-color`
- `POST /nova4d/scene/delete-object`
- `POST /nova4d/scene/duplicate-object`
- `POST /nova4d/scene/group-objects`
- `POST /nova4d/scene/parent-object`
- `POST /nova4d/scene/rename-object`
- `POST /nova4d/scene/select-object`
- `POST /nova4d/scene/clear-selection`

### Materials

- `POST /nova4d/material/create-standard`
- `POST /nova4d/material/create-redshift`
- `POST /nova4d/material/create-arnold`
- `POST /nova4d/material/assign`
- `POST /nova4d/material/set-parameter`
- `POST /nova4d/material/set-texture`

### MoGraph

- `POST /nova4d/mograph/cloner/create`
- `POST /nova4d/mograph/matrix/create`
- `POST /nova4d/mograph/effector/random`
- `POST /nova4d/mograph/effector/plain`
- `POST /nova4d/mograph/effector/step`
- `POST /nova4d/mograph/assign-effector`
- `POST /nova4d/mograph/set-count`
- `POST /nova4d/mograph/set-mode`

### XPresso

- `POST /nova4d/xpresso/create-tag`
- `POST /nova4d/xpresso/add-node`
- `POST /nova4d/xpresso/connect`
- `POST /nova4d/xpresso/set-parameter`

### Animation

- `POST /nova4d/animation/set-key`
- `POST /nova4d/animation/delete-key`
- `POST /nova4d/animation/set-range`
- `POST /nova4d/animation/play`
- `POST /nova4d/animation/stop`
- `POST /nova4d/animation/set-fps`

### Rendering

- `POST /nova4d/render/set-engine`
- `POST /nova4d/render/frame`
- `POST /nova4d/render/sequence`
- `POST /nova4d/render/queue/redshift`
- `POST /nova4d/render/queue/arnold`
- `POST /nova4d/render/team-render/publish`

### Viewport

- `POST /nova4d/viewport/set-camera`
- `POST /nova4d/viewport/focus-object`
- `POST /nova4d/viewport/screenshot`
- `POST /nova4d/viewport/set-display-mode`

### Import/Export

- `POST /nova4d/io/import/gltf`
- `POST /nova4d/io/import/fbx`
- `POST /nova4d/io/import/obj`
- `POST /nova4d/io/export/gltf`
- `POST /nova4d/io/export/fbx`
- `POST /nova4d/io/export/obj`
- `POST /nova4d/io/export/alembic`
- `POST /nova4d/io/import/upload` (multipart helper)
- `POST /nova4d/export/upload-result` (multipart helper)

### Blender Pipeline

- `POST /nova4d/blender/import-gltf`
- `POST /nova4d/blender/import-fbx`
- `POST /nova4d/blender/import/upload` (multipart helper)

### System + Headless

- `POST /nova4d/system/new-scene`
- `POST /nova4d/system/open-scene`
- `POST /nova4d/system/save-scene`
- `POST /nova4d/headless/render-queue`
- `POST /nova4d/headless/c4dpy-script`
- `POST /nova4d/batch/render` (immediate c4dpy launcher)
- `GET /nova4d/batch/jobs`
- `GET /nova4d/batch/jobs/:jobId`
- `POST /nova4d/batch/jobs/:jobId/cancel`

### Test

- `POST /nova4d/test/ping`

## Examples

Health:

```bash
curl -s http://localhost:30010/nova4d/health | jq .
```

Queue cloner:

```bash
curl -s -X POST http://localhost:30010/nova4d/mograph/cloner/create \
  -H 'Content-Type: application/json' \
  -d '{"name":"AgentCloner"}' | jq .
```

Batch render:

```bash
curl -s -X POST http://localhost:30010/nova4d/batch/render \
  -H 'Content-Type: application/json' \
  -d '{"scene_file":"/path/to/scene.c4d","timeout_sec":900}' | jq .
```
