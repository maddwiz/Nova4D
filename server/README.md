# Nova4D Server

Run:

```bash
node index.js
```

The server queues bridge commands from `/nova4d/*` endpoints and exposes:

- polling API: `GET /nova4d/commands`
- result API: `POST /nova4d/results`
- SSE notifications: `GET /nova4d/stream`
- blender import bridge: `POST /nova4d/blender/import/upload`
- headless launcher: `POST /nova4d/batch/render`

See `../docs/API.md` for the full route list.
