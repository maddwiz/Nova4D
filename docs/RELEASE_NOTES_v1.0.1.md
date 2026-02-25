# Nova4D v1.0.1

Delivered scope:

- Expanded native plugin execution coverage for XPresso commands (`add-node`, `connect`, `set-parameter`) with graph + metadata fallback.
- Added renderer material creation path for Redshift/Arnold with safe fallback behavior.
- Added Scene Vision loop in assistant run flow (post-run screenshot capture, multimodal vision feedback, bounded correction iterations).
- Added optional SQLite persistence mode (`NOVA4D_STORE_DRIVER=sqlite`, `NOVA4D_STORE_SQLITE_PATH`) in addition to JSON store mode.
- Expanded unit coverage for assistant planner/safety logic, command store behavior, rate limiting, workflow engine, voice shortcuts, and run monitor.
- Split Studio UI responsibilities into focused modules and added Scene Vision controls in Studio.
- Extracted server route registration into modular route files (`system`, `scene/introspection`, `assistant`, `queue`, `upload/batch`) to reduce `server/index.js` complexity.
- Finalized release hardening: plugin ID validation gate, legal EULA update, and release zip verification excluding `legacy/`.
- Synced server/package/release scripts to v1.0.1.
