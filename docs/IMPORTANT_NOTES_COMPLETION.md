# Completing The Important Notes

This is the exact closeout sequence before paid release.

## 1. Confirm Official Plugin IDs

Nova4D now supports env-driven IDs; no source edit required.

1. Official IDs currently assigned to `maddwiz`:
   - `NOVA4D_PLUGIN_ID_COMMAND=1067627`
   - `NOVA4D_PLUGIN_ID_MESSAGE=1067628`
   - `NOVA4D_SPECIAL_EVENT_ID=1067629`
2. Set environment variables used by Cinema 4D launch (or keep `.env.example` defaults):

```bash
export NOVA4D_PLUGIN_ID_COMMAND=1067627
export NOVA4D_PLUGIN_ID_MESSAGE=1067628
export NOVA4D_SPECIAL_EVENT_ID=1067629
```

3. Start Cinema 4D from the same environment/session.
4. Confirm no startup warning about legacy placeholder IDs appears in the console.
5. Run:

```bash
bash scripts/check_plugin_ids.sh
```

## 2. Validate Native Action Coverage In Real C4D

Fast path:

```bash
bash examples/curl/important_notes_smoke.sh
```

Then confirm every queued command is `succeeded` in `/nova4d/commands/recent`.

Run these in order and confirm scene changes:

1. `spawn-object`
2. `set-transform`
3. `create-standard-material` + `assign-material`
4. `create-cloner`
5. `create-xpresso-tag`
6. `set-key` + `delete-key` on `position.x`
7. `set-camera` + `focus-object`
8. `capture-screenshot`
9. `render-frame`
10. `render-sequence`

If any action fails, inspect result payload in `/nova4d/commands/recent` and fix target-specific IDs/parameters.

## 3. MoGraph Parameter IDs (Count/Mode)

`set-cloner-count` and `set-cloner-mode` are now executable but require exact `parameter_id` for your C4D build.

Use C4D Script Manager to inspect cloner DescIDs and pass:

```json
{
  "cloner_name": "MyCloner",
  "parameter_id": 1001001,
  "count": 50
}
```

and

```json
{
  "cloner_name": "MyCloner",
  "parameter_id": 1001002,
  "mode": 2
}
```

## 4. Renderer IDs (Redshift/Arnold)

`queue-redshift-render` and `queue-arnold-render` now render immediately, but renderer IDs can vary per install.

If needed, provide `engine_id` in payload before rendering.

## 5. Final Pre-Launch Gate

Run:

```bash
npm run check
bash examples/mock/e2e_mock.sh
bash scripts/package_release.sh v1.0.1
```

Then perform one manual in-app Cinema 4D pass with your licensed 2026.1+ build.
