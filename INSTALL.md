# Nova4D Install

## 1. Server

```bash
cd /home/nova/Nova4D
npm install
cp .env.example .env
npm start
```

## 2. Cinema 4D Plugin

1. Copy `plugins/Nova4D/nova4d_plugin.pyp` (and parent folder) to your Cinema 4D plugins directory.
2. Restart Cinema 4D.
3. Trigger `Nova4D - OpenClaw Bridge` command to start polling.

## 3. Validate Queue Round Trip

```bash
curl -s -X POST http://localhost:30010/nova4d/scene/spawn-object \
  -H 'Content-Type: application/json' \
  -d '{"object_type":"cube","name":"InstallCube","position":[0,120,0]}' | jq .

curl -s http://localhost:30010/nova4d/commands/recent?limit=5 | jq .
```

## 4. Optional: Headless Render

Set `NOVA4D_C4D_PATH` to your `c4dpy` binary, then:

```bash
curl -s -X POST http://localhost:30010/nova4d/batch/render \
  -H 'Content-Type: application/json' \
  -d '{"scene_file":"/path/to/scene.c4d","args":[],"timeout_sec":600}' | jq .
```
