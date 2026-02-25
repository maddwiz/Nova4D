#!/usr/bin/env bash
set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for this script." >&2
  exit 2
fi

BASE="${BASE:-http://127.0.0.1:30010}"
API_KEY="${NOVA4D_API_KEY:-${API_KEY:-}}"
MAX_COMMANDS="${MAX_COMMANDS:-20}"
POLL_SEC="${POLL_SEC:-1}"
TIMEOUT_SEC="${TIMEOUT_SEC:-180}"

WORKFLOW_OBJECT_NAME="${WORKFLOW_OBJECT_NAME:-SmokeCube}"
WORKFLOW_CLONER_NAME="${WORKFLOW_CLONER_NAME:-SmokeCloner}"
WORKFLOW_MATERIAL_NAME="${WORKFLOW_MATERIAL_NAME:-SmokeRedshiftMat}"
WORKFLOW_FRAME_START="${WORKFLOW_FRAME_START:-0}"
WORKFLOW_FRAME_END="${WORKFLOW_FRAME_END:-30}"
WORKFLOW_START_VALUE="${WORKFLOW_START_VALUE:-0}"
WORKFLOW_END_VALUE="${WORKFLOW_END_VALUE:-180}"
WORKFLOW_RENDER_FRAME="${WORKFLOW_RENDER_FRAME:-12}"
WORKFLOW_RENDER_OUTPUT="${WORKFLOW_RENDER_OUTPUT:-/tmp/nova4d-smoke-frame.png}"
WORKFLOW_GLTF_OUTPUT="${WORKFLOW_GLTF_OUTPUT:-/tmp/nova4d-smoke.gltf}"

STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_PATH="${REPORT_PATH:-/tmp/nova4d-cinematic-smoke-${STAMP}.json}"

curl_api() {
  if [[ -n "${API_KEY}" ]]; then
    curl -sS "$@" -H "X-API-Key: ${API_KEY}"
  else
    curl -sS "$@"
  fi
}

TMP_DIR="$(mktemp -d /tmp/nova4d-cinematic-smoke.XXXXXX)"
RUN_FILE="${TMP_DIR}/run.json"
SNAPSHOTS_FILE="${TMP_DIR}/snapshots.json"
SUMMARY_FILE="${TMP_DIR}/summary.json"
SNAP_DIR="${TMP_DIR}/commands"

cleanup() {
  rm -rf "${TMP_DIR}" >/dev/null 2>&1 || true
}
trap cleanup EXIT
mkdir -p "${SNAP_DIR}"

echo "[1/5] Queue cinematic smoke workflow"
cat > "${TMP_DIR}/payload.json" <<JSON
{
  "workflow_id": "cinematic_smoke",
  "options": {
    "object_name": "${WORKFLOW_OBJECT_NAME}",
    "cloner_name": "${WORKFLOW_CLONER_NAME}",
    "material_name": "${WORKFLOW_MATERIAL_NAME}",
    "frame_start": ${WORKFLOW_FRAME_START},
    "frame_end": ${WORKFLOW_FRAME_END},
    "start_value": ${WORKFLOW_START_VALUE},
    "end_value": ${WORKFLOW_END_VALUE},
    "render_frame": ${WORKFLOW_RENDER_FRAME},
    "render_output": "${WORKFLOW_RENDER_OUTPUT}",
    "gltf_output": "${WORKFLOW_GLTF_OUTPUT}"
  },
  "safety": {
    "mode": "balanced",
    "allow_dangerous": false
  },
  "max_commands": ${MAX_COMMANDS}
}
JSON

curl_api -X POST "${BASE}/nova4d/workflows/run" \
  -H 'Content-Type: application/json' \
  --data-binary @"${TMP_DIR}/payload.json" > "${RUN_FILE}"

QUEUED_COUNT="$(jq -r '.queued | length // 0' "${RUN_FILE}")"
BLOCKED_COUNT="$(jq -r '.blocked_commands | length // 0' "${RUN_FILE}")"
WORKFLOW_NAME="$(jq -r '.workflow.name // "cinematic_smoke"' "${RUN_FILE}")"

echo "  workflow=${WORKFLOW_NAME} queued=${QUEUED_COUNT} blocked=${BLOCKED_COUNT}"

if [[ "${QUEUED_COUNT}" -eq 0 ]]; then
  echo "No commands queued. Full response:"
  cat "${RUN_FILE}" | jq .
  exit 1
fi

COMMAND_IDS=()
while IFS= read -r id; do
  if [[ -n "${id}" ]]; then
    COMMAND_IDS+=("${id}")
  fi
done < <(jq -r '.queued[]?.id // empty' "${RUN_FILE}")
TOTAL="${#COMMAND_IDS[@]}"

printf "  command_ids:"
for id in "${COMMAND_IDS[@]}"; do
  printf " %s" "${id}"
done
printf "\n"

echo "[2/5] Poll command completion"
START_TS="$(date +%s)"
while true; do
  now="$(date +%s)"
  elapsed="$((now - START_TS))"

  succeeded=0
  failed=0
  canceled=0
  queued=0
  dispatched=0
  unknown=0

  for id in "${COMMAND_IDS[@]}"; do
    status="$(curl_api "${BASE}/nova4d/commands/${id}" | jq -r '.command.status // "unknown"')"
    case "${status}" in
      succeeded) succeeded=$((succeeded + 1)) ;;
      failed) failed=$((failed + 1)) ;;
      canceled) canceled=$((canceled + 1)) ;;
      queued) queued=$((queued + 1)) ;;
      dispatched) dispatched=$((dispatched + 1)) ;;
      *) unknown=$((unknown + 1)) ;;
    esac
  done

  terminal=$((succeeded + failed + canceled))
  echo "  t=${elapsed}s complete=${terminal}/${TOTAL} ok=${succeeded} fail=${failed} canceled=${canceled} queued=${queued} dispatched=${dispatched} unknown=${unknown}"

  if [[ "${terminal}" -eq "${TOTAL}" ]]; then
    break
  fi
  if [[ "${elapsed}" -ge "${TIMEOUT_SEC}" ]]; then
    echo "Timed out after ${TIMEOUT_SEC}s." >&2
    break
  fi
  sleep "${POLL_SEC}"
done

echo "[3/5] Fetch final snapshots"
for id in "${COMMAND_IDS[@]}"; do
  curl_api "${BASE}/nova4d/commands/${id}" | jq '.command // {}' > "${SNAP_DIR}/${id}.json"
done
jq -s '.' "${SNAP_DIR}"/*.json > "${SNAPSHOTS_FILE}"

jq '{
  total: (length),
  succeeded: (map(select(.status == "succeeded")) | length),
  failed: (map(select(.status == "failed")) | length),
  canceled: (map(select(.status == "canceled")) | length),
  queued: (map(select(.status == "queued")) | length),
  dispatched: (map(select(.status == "dispatched")) | length),
  unknown: (map(select(.status != "succeeded" and .status != "failed" and .status != "canceled" and .status != "queued" and .status != "dispatched")) | length)
}' "${SNAPSHOTS_FILE}" > "${SUMMARY_FILE}"

echo "[4/5] Write report"
jq -n \
  --arg exported_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg base_url "${BASE}" \
  --arg workflow "${WORKFLOW_NAME}" \
  --arg report_path "${REPORT_PATH}" \
  --slurpfile workflow_run "${RUN_FILE}" \
  --slurpfile snapshots "${SNAPSHOTS_FILE}" \
  --slurpfile summary "${SUMMARY_FILE}" \
  '{
    exported_at: $exported_at,
    base_url: $base_url,
    workflow_name: $workflow,
    workflow_run: ($workflow_run[0] // {}),
    summary: ($summary[0] // {}),
    commands: ($snapshots[0] // [])
  }' > "${REPORT_PATH}"

echo "[5/5] Final summary"
cat "${SUMMARY_FILE}" | jq .
echo "report=${REPORT_PATH}"

failed_count="$(jq -r '.failed // 0' "${SUMMARY_FILE}")"
canceled_count="$(jq -r '.canceled // 0' "${SUMMARY_FILE}")"
if [[ "${failed_count}" -gt 0 || "${canceled_count}" -gt 0 ]]; then
  exit 1
fi
