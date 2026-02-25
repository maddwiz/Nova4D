# Mock Cinema 4D Client

`mock_c4d_client.js` simulates a Cinema 4D plugin worker against Nova4D:

- polls `/nova4d/commands`
- executes mock behaviors for common actions
- posts results to `/nova4d/results`

## Run

```bash
cd /home/nova/Nova4D
node examples/mock/mock_c4d_client.js
```

Environment options:

- `NOVA4D_HOST` (default `localhost`)
- `NOVA4D_PORT` (default `30010`)
- `NOVA4D_API_KEY` (optional)
- `MOCK_CLIENT_ID` (default `mock-c4d`)
- `MOCK_POLL_MS` (default `1000`)
- `MOCK_RUN_SECONDS` (default `0`, infinite)

## End-to-end demo

```bash
bash examples/mock/e2e_mock.sh
```

## Cinematic Smoke CLI Demo

With server + mock worker running, execute:

```bash
bash examples/curl/cinematic_smoke_e2e.sh
```
