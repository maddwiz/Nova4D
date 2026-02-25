# Completing The Important Notes

This is the exact closeout sequence before paid release.

## 1. Replace Placeholder Plugin IDs

Nova4D now supports env-driven IDs; no source edit required.

1. Request 3 unique IDs from PluginCafe:
   - Command plugin ID
   - Message plugin ID
   - Special event ID
2. Set environment variables used by Cinema 4D launch:

```bash
export NOVA4D_PLUGIN_ID_COMMAND=<your_id_1>
export NOVA4D_PLUGIN_ID_MESSAGE=<your_id_2>
export NOVA4D_SPECIAL_EVENT_ID=<your_id_3>
```

3. Start Cinema 4D from the same environment/session.
4. Confirm no startup warning about placeholder IDs appears in the console.

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
  "parameter_id": 1234567,
  "count": 50
}
```

and

```json
{
  "cloner_name": "MyCloner",
  "parameter_id": 1234568,
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
