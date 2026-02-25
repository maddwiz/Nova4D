# PluginCafe IDs (Official Process)

Nova4D needs three unique Cinema 4D plugin IDs for release builds:

- `NOVA4D_PLUGIN_ID_COMMAND`
- `NOVA4D_PLUGIN_ID_MESSAGE`
- `NOVA4D_SPECIAL_EVENT_ID`

The local defaults (`1234567`, `1234568`, `1234569`) are placeholders only.

## Where to Request IDs

1. Sign in to the Maxon developers forum and PluginCafe system.
2. Open the official plugin ID request thread:
   - [How To Apply for Plugins IDs](https://developers.maxon.net/forum/topic/15195/how-to-apply-for-plugins-ids)
3. Use the ID Generator link from that thread:
   - [PluginCafe ID Generator](https://plugincafe.maxon.net/pid)

The Maxon team notes this flow is on the legacy forum system; use the old PluginCafe account/auth flow shown in the thread.

## How Many IDs to Generate

Generate exactly 3 unique IDs and map them as:

1. Command plugin registration ID -> `NOVA4D_PLUGIN_ID_COMMAND`
2. Message plugin registration ID -> `NOVA4D_PLUGIN_ID_MESSAGE`
3. Special event ID -> `NOVA4D_SPECIAL_EVENT_ID`

## Configure Nova4D

Set values in your shell or `.env`:

```bash
export NOVA4D_PLUGIN_ID_COMMAND=<official_id_1>
export NOVA4D_PLUGIN_ID_MESSAGE=<official_id_2>
export NOVA4D_SPECIAL_EVENT_ID=<official_id_3>
```

Then validate:

```bash
bash scripts/check_plugin_ids.sh
```

## Verify In Cinema 4D

1. Launch Cinema 4D from the same environment/session.
2. Confirm startup does not print the placeholder-ID warning.
3. Run a smoke queue (`/nova4d/test/ping` or Studio Smart Run) and confirm command flow succeeds.

## Troubleshooting

- If the PluginCafe ID page rejects login, verify credentials with the legacy PluginCafe account flow and reset there if needed:
  - [Why can’t I generate plugin IDs?](https://developers.maxon.net/forum/topic/14814/why-can-t-i-generate-plugin-ids)
- Do not ship with Maxon SDK test IDs (for example `1000001..1000010`), which are for sample/testing only:
  - [Cinema 4D C++ docs: Plugin IDs](https://developers.maxon.net/docs/Cinema4DCPPSDK/page_manual_module_functions.html)
