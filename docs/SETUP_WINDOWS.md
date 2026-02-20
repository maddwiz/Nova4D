# Setup (Windows)

## Prerequisites

- Cinema 4D 2026.1+
- Node.js 18+
- Python 3.11 (for MCP/server tooling)

## Steps

```powershell
cd C:\path\to\Nova4D
npm install
copy .env.example .env
npm start
```

Copy plugin folder:

- from: `plugins\Nova4D\`
- to: `%APPDATA%\Maxon\Cinema 4D 2026\plugins\Nova4D\`

Restart Cinema 4D and run `Nova4D - OpenClaw Bridge`.

Validate:

```powershell
curl http://localhost:30010/nova4d/health
curl -X POST http://localhost:30010/nova4d/test/ping -H "Content-Type: application/json" -d "{\"message\":\"Windows OK\"}"
```
