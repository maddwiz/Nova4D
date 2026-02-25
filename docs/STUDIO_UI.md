# Nova4D Studio UI

Nova4D Studio is the built-in browser interface for text + voice control with pluggable AI providers.

## Open the UI

1. Start Nova4D server.
2. Open `http://localhost:30010/nova4d/studio`.

## What it does

- Connects provider settings (Builtin, OpenAI, OpenRouter, Anthropic, OpenAI-compatible)
- Accepts typed prompts or voice dictation (Web Speech API)
- Applies safety policy (`strict`, `balanced`, `unrestricted`) before queueing
- Uses live scene context by default (with toggle to refresh per request)
- Generates a command plan via `/nova4d/assistant/plan`
- Runs commands into Cinema 4D via `/nova4d/assistant/run`
- Captures scene snapshots via `/nova4d/introspection/request` and `/nova4d/introspection/latest`
- Supports scene query endpoints (`/nova4d/scene/graph`, `/nova4d/scene/objects`, `/nova4d/scene/materials`, `/nova4d/scene/object`)
- Shows recent queue history from `/nova4d/commands/recent`

## Notes

- Provider API keys are sent only per request; they are not persisted on the server.
- If external provider planning fails, Nova4D falls back to a local rule-based planner.
- Use `NOVA4D_API_KEY` in the UI if your server requires API authentication.
