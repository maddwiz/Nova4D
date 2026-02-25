# Nova4D v1.0.1

Delivered scope:

- Expanded native plugin execution coverage for XPresso commands (`add-node`, `connect`, `set-parameter`) with graph + metadata fallback.
- Added renderer material creation path for Redshift/Arnold with safe fallback behavior.
- Added persistent on-disk command store (`NOVA4D_STORE_PATH`) so command history and scene snapshots survive server restart.
- Added unit tests for assistant planner sanitization, payload validation/safety filtering, rate limiting, and command-store persistence.
- Split Studio UI responsibilities into modules (`provider_management`, `workflow_engine`, `run_monitor`, `command_browser`) to reduce `app.js` size.
- Synced server/package/release scripts to v1.0.1.
