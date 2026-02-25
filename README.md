# Nova4D

Nova4D is an OpenClaw-ready Cinema 4D bridge for autonomous scene control, MoGraph workflows, render queueing, and headless `c4dpy` execution.

## Requirements

Requires an active Cinema 4D 2025+ or 2026 subscription (standalone or Maxon One). Nova4D will not work on trial or Lite versions. A free 14-day trial of Maxon One is available from maxon.net if you want to test first.

## What Ships

- Node.js queue bridge server (`server/index.js`) on `NOVA4D_PORT` (default `30010`)
- Cinema 4D Python plugin (`plugins/Nova4D/nova4d_plugin.pyp`) with polling executor
- OpenClaw extension (`extensions/openclaw/cinema4d-bridge`)
- Python SDK (`python-sdk/nova4d.py`)
- MCP server (`mcp-server/nova4d_mcp.py`)
- Built-in Studio UI (`/nova4d/studio`) for text + voice control
- Curl + mock client examples (`examples/`)
- Full copy-paste API reference (`API.md` and `docs/API.md`)
- Packaging script producing `dist/Nova4D-v1.0.0.zip`

## Core Capabilities

- 60+ routed actions across scene, materials, MoGraph, XPresso, animation, render, viewport, import/export, and system control
- Queue + lease-based dispatch + result reporting
- SSE event stream for low-latency workers
- API key auth (`X-API-Key`) + request rate limiting
- Multipart uploads for import pipelines
- One-click headless render launcher (`POST /nova4d/batch/render`)
- Blender->Cinema pipeline routes (`/nova4d/blender/import-*`)

## Quick Start

```bash
cd /home/nova/Nova4D
npm install
cp .env.example .env
npm start
```

Health check:

```bash
curl -s http://localhost:30010/nova4d/health | jq .
```

Queue a test command:

```bash
curl -s -X POST http://localhost:30010/nova4d/test/ping \
  -H 'Content-Type: application/json' \
  -d '{"message":"Nova4D Connected"}' | jq .
```

Run mock worker (no Cinema 4D required):

```bash
node examples/mock/mock_c4d_client.js
```

## Nova4D Studio UI (AI + Voice)

Start the server, then open:

`http://localhost:30010/nova4d/studio`

From the UI you can:

- Connect AI provider settings (Builtin/OpenAI/OpenRouter/Anthropic/OpenAI-compatible)
- Test provider connectivity before planning/running
- Use one-click quick workflow templates for common tasks (AI-planned or deterministic via `/nova4d/workflows/run`)
- Toggle template mode between AI planning and deterministic execution
- Configure deterministic workflow options (names/frame range/output) and preview before run
- Dictate prompts with browser voice input
- Run one-click preflight diagnostics (paths, plugin presence, worker probe)
- View consolidated system status (queue, readiness, stream clients, snapshot health)
- Generate plans (`/nova4d/assistant/plan`) and run them (`/nova4d/assistant/run`)
- Queue the exact last-reviewed plan (`/nova4d/assistant/queue`) without re-planning
- Set safety mode (`strict`, `balanced`, `unrestricted`) with dangerous-action guardrails
- Capture live scene snapshots via `/nova4d/introspection/scene`
- Query scene graph data via `/nova4d/scene/graph`, `/nova4d/scene/objects`, `/nova4d/scene/materials`, `/nova4d/scene/object`
- Use context-aware planning by default (planner reads latest live scene snapshot)
- Persist non-secret Studio settings in browser local storage
- Watch live queue lifecycle updates in Studio via `/nova4d/stream`
- Inspect recent command execution in one place
- Manage recent commands directly in Studio (view details, requeue, cancel queued jobs)
- Emergency stop: cancel all queued/dispatched commands from Studio or `/nova4d/commands/cancel-pending`
- Retry failed jobs in bulk from Studio or `/nova4d/commands/retry-failed`

Detailed guide: `docs/STUDIO_UI.md`

## Plugin Install (Cinema 4D)

1. Copy `plugins/Nova4D/` into your Cinema 4D plugins directory.
2. Launch Cinema 4D and enable the command `Nova4D - OpenClaw Bridge`.
3. Start Nova4D server.
4. Queue commands from OpenClaw/SDK/MCP.

## Riley Mode Demo Prompt

"Build a neon cyber city with a MoGraph cloner of 50 cubes, assign a Redshift material, animate scale from frame 0-60, and render frame 45."

## Environment Variables

- `NOVA4D_HOST`
- `NOVA4D_PORT`
- `NOVA4D_API_KEY`
- `NOVA4D_COMMAND_LEASE_MS`
- `NOVA4D_MAX_RETENTION`
- `NOVA4D_IMPORT_DIR`
- `NOVA4D_EXPORT_DIR`
- `NOVA4D_MAX_UPLOAD_MB`
- `NOVA4D_BLENDER_SCALE`
- `NOVA4D_RATE_LIMIT_WINDOW_MS`
- `NOVA4D_RATE_LIMIT_MAX`
- `NOVA4D_C4D_PATH`
- `NOVA4D_HEADLESS_TIMEOUT_SEC`

## Notes

- Plugin IDs are env-configurable (`NOVA4D_PLUGIN_ID_COMMAND`, `NOVA4D_PLUGIN_ID_MESSAGE`, `NOVA4D_SPECIAL_EVENT_ID`).
- Complete the production closeout checklist in `docs/IMPORTANT_NOTES_COMPLETION.md`.
