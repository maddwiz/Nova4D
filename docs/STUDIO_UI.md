# Nova4D Studio UI

Nova4D Studio is the built-in browser interface for text + voice control with pluggable AI providers.

## Open the UI

1. Start Nova4D server.
2. Open `http://localhost:30010/nova4d/studio`.

## What it does

- Connects provider settings (Builtin, OpenAI, OpenRouter, Anthropic, OpenAI-compatible)
- Supports saved provider profiles for fast switching between AI backends
- Tests provider connectivity before plan/run (`/nova4d/assistant/provider-test`)
- Provides quick workflow templates for common one-click actions (deterministic mode uses `/nova4d/workflows/run`)
- Includes a toggle to run templates through AI planning or deterministic workflow execution
- Supports deterministic workflow option inputs and a preview action before queueing
- Runs one-click preflight diagnostics for local setup and optional worker probe
- Includes a one-click guided checklist (bridge health, local readiness, worker probe, provider status)
- Shows consolidated system status (queue, readiness, stream clients, snapshot + worker activity)
- Accepts typed prompts or voice dictation (Web Speech API)
- Supports voice command shortcuts prefixed with `nova command` for plan/run/template/check actions
- Applies safety policy (`strict`, `balanced`, `unrestricted`) before queueing
- Uses live scene context by default (with toggle to refresh per request)
- Generates a command plan via `/nova4d/assistant/plan`
- Runs commands into Cinema 4D via `/nova4d/assistant/run`
- Queues the exact reviewed plan via `/nova4d/assistant/queue` (no re-plan drift)
- Captures scene snapshots via `/nova4d/introspection/request` and `/nova4d/introspection/latest`
- Supports scene query endpoints (`/nova4d/scene/graph`, `/nova4d/scene/objects`, `/nova4d/scene/materials`, `/nova4d/scene/object`)
- Subscribes to `/nova4d/stream` for live queue events (queued/dispatched/succeeded/failed)
- Shows recent queue history from `/nova4d/commands/recent`
- Supports direct command controls in recent history (view, requeue, cancel queued/dispatched)
- Includes emergency stop control to cancel all queued/dispatched commands
- Supports bulk retry of failed commands and status-filtered recent view
- Persists non-secret Studio settings in browser local storage
- Can optionally persist provider API keys in local browser profile storage

## Notes

- Provider API keys are sent only per request; they are never persisted on the server.
- Provider API keys are not saved in Studio profiles unless "Remember provider API key in this browser" is enabled.
- If external provider planning fails, Nova4D falls back to a local rule-based planner.
- Use `NOVA4D_API_KEY` in the UI if your server requires API authentication.
