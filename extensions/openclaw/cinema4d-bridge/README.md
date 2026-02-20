# OpenClaw Extension: Nova4D Cinema 4D Bridge

This extension exposes high-coverage Nova4D route groups:

- Scene (`/nova4d/scene/*`)
- Material (`/nova4d/material/*`)
- MoGraph (`/nova4d/mograph/*`)
- XPresso (`/nova4d/xpresso/*`)
- Animation (`/nova4d/animation/*`)
- Rendering (`/nova4d/render/*`)
- Viewport (`/nova4d/viewport/*`)
- I/O (`/nova4d/io/*`)
- Blender pipeline (`/nova4d/blender/*`)
- Headless (`/nova4d/batch/*`, `/nova4d/headless/*`)

Environment variables:

- `NOVA4D_HOST` (default `localhost`)
- `NOVA4D_PORT` (default `30010`)
- `NOVA4D_API_KEY` (optional)
