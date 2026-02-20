# Nova4D Buyer Guide

## 1. Install

1. Unzip `Nova4D-v1.0.0.zip`.
2. Put `plugins/Nova4D/` into your Cinema 4D plugins folder.
3. Start the bridge server:

```bash
npm install
npm start
```

4. Restart Cinema 4D and toggle `Nova4D - OpenClaw Bridge` from the plugin menu.

## 2. Verify in 30 Seconds

```bash
curl -s http://localhost:30010/nova4d/health | jq .
curl -s -X POST http://localhost:30010/nova4d/test/ping \
  -H 'Content-Type: application/json' \
  -d '{"message":"Nova4D Connected"}' | jq .
```

Then run:

```bash
node examples/mock/mock_c4d_client.js
```

## 3. Blender -> Cinema Pipeline

```bash
curl -s -X POST http://localhost:30010/nova4d/blender/import/upload \
  -F "file=@/path/to/scene.gltf" \
  -F "format=gltf" \
  -F "scale_fix=blender_to_c4d" \
  -F "scale_factor=1.0" | jq .
```

## 4. OpenClaw Extension

Use:

- `extensions/openclaw/cinema4d-bridge/index.js`
- `extensions/openclaw/cinema4d-bridge/openclaw.plugin.json`

## 5. Production Security

- Set `NOVA4D_API_KEY`.
- Tune `NOVA4D_RATE_LIMIT_MAX` and `NOVA4D_RATE_LIMIT_WINDOW_MS`.
- Bind host to private network if running on shared infrastructure.

## 6. License Tiers (Suggested)

- Standard: `$49.99` one-time (`$29.99` launch week)
- Pro: `$79.99` (adds priority support + advanced presets)
