# Nova4D Architecture

```
OpenClaw / LLM Agent / SDK / MCP
  -> HTTP API (Node.js Nova4D bridge, port 30010)
    -> Route modules (system/workflow, scene/introspection, assistant, queue, upload/batch)
    -> Shared services (queue guards/validation, headless job store, scene snapshot cache/resolution, preflight checks)
    -> Command queue (lease-based store with optional JSON/SQLite persistence)
      -> Cinema 4D plugin poller (1s default)
        -> Main-thread command executor
          -> Scene / MoGraph / Materials / Render actions

Optional:
  -> /nova4d/batch/render
    -> c4dpy headless process
  -> /nova4d/assistant/run (scene vision loop)
    -> execute plan -> capture screenshot -> multimodal feedback -> correction pass (max iterations)
```

## Command Flow

1. Client posts command to a route like `/nova4d/mograph/cloner/create`.
2. Server queues command with metadata + priority.
3. Plugin polls `/nova4d/commands` and receives leased commands.
4. Plugin executes command in Cinema 4D and posts `/nova4d/results`.
5. Status becomes `succeeded` or `failed` and is queryable via `/nova4d/commands/:id`.

## Reliability Controls

- Lease timeout + automatic requeue for stale dispatched commands
- Manual requeue/cancel endpoints
- Queue retention cap
- Store persistence on disk:
  - JSON mode (`NOVA4D_STORE_DRIVER=json`, `NOVA4D_STORE_PATH`)
  - SQLite mode (`NOVA4D_STORE_DRIVER=sqlite`, `NOVA4D_STORE_SQLITE_PATH`)
- SSE stream for immediate wake-up fetches

## Security Controls

- Optional API key auth (`NOVA4D_API_KEY` -> `X-API-Key`)
- Request rate limiting (`NOVA4D_RATE_LIMIT_*`)

## Headless Mode

- Endpoint: `POST /nova4d/batch/render`
- Binary path: `NOVA4D_C4D_PATH` (defaults to `c4dpy`)
- Job status endpoints:
  - `GET /nova4d/batch/jobs`
  - `GET /nova4d/batch/jobs/:jobId`
  - `POST /nova4d/batch/jobs/:jobId/cancel`
