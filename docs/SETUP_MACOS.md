# Setup (macOS)

## Prerequisites

- Cinema 4D 2026.1+
- Node.js 18+

## Steps

```bash
cd /path/to/Nova4D
npm install
cp .env.example .env
npm start
```

Copy plugin folder:

- from: `plugins/Nova4D/`
- to: `~/Library/Preferences/Maxon/Cinema 4D 2026/plugins/Nova4D/`

Restart Cinema 4D and run `Nova4D - OpenClaw Bridge`.

Validate:

```bash
curl -s http://localhost:30010/nova4d/health | jq .
curl -s -X POST http://localhost:30010/nova4d/test/ping \
  -H 'Content-Type: application/json' \
  -d '{"message":"macOS OK"}' | jq .
```
