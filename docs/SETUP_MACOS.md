# Setup (macOS)

## Prerequisites

- Cinema 4D 2026.1+
- Node.js 18+

## Machine-Detected Paths (this setup run)

- Detected Cinema 4D app: not found under `/Applications` or `~/Applications`
- Detected `c4dpy`: not found; fallback configured:
  `/Applications/Maxon Cinema 4D 2026/Cinema 4D.app/Contents/MacOS/c4dpy`
- Plugin install target used:
  `/Users/desmondpottle/Library/Preferences/Maxon/Cinema 4D 2026/plugins/Nova4D`

## Steps

```bash
cd /Users/desmondpottle/Nova4D
npm install
bash scripts/run-mac-local.sh
```

Copy plugin folder:

- from: `plugins/Nova4D/`
- to: `/Users/desmondpottle/Library/Preferences/Maxon/Cinema 4D 2026/plugins/Nova4D/`

Restart Cinema 4D and run `Nova4D - OpenClaw Bridge`.

Validate:

```bash
curl -s http://localhost:30010/nova4d/health | jq .
curl -s -X POST http://localhost:30010/nova4d/test/ping \
  -H 'Content-Type: application/json' \
  -d '{"message":"macOS OK"}' | jq .
```
