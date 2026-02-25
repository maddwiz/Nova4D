#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:30010}"
POLL_TIMEOUT_SEC="${POLL_TIMEOUT_SEC:-25}"
POLL_INTERVAL_SEC="${POLL_INTERVAL_SEC:-1}"

declare -a COMMAND_IDS=()

post() {
  local route="$1"
  local body="$2"
  echo "--> ${route}"
  local response
  response="$(curl -s -X POST "${BASE}${route}" -H 'Content-Type: application/json' -d "${body}")"
  echo "${response}" | jq .
  local command_id
  command_id="$(echo "${response}" | jq -r '.command_id // empty')"
  if [[ -n "${command_id}" ]]; then
    COMMAND_IDS+=("${command_id}")
  fi
  echo
}

is_terminal() {
  local status="$1"
  [[ "${status}" == "succeeded" || "${status}" == "failed" || "${status}" == "canceled" ]]
}

summarize_commands() {
  local succeeded=0
  local failed=0
  local canceled=0
  local other=0
  local status
  local id

  echo "---- Smoke Summary ----"
  for id in "${COMMAND_IDS[@]}"; do
    status="$(curl -s "${BASE}/nova4d/commands/${id}" | jq -r '.command.status // "unknown"')"
    case "${status}" in
      succeeded) succeeded=$((succeeded + 1)) ;;
      failed) failed=$((failed + 1)) ;;
      canceled) canceled=$((canceled + 1)) ;;
      *) other=$((other + 1)) ;;
    esac
    echo "${id} ${status}"
  done
  echo "Totals: succeeded=${succeeded} failed=${failed} canceled=${canceled} other=${other}"
  if [[ "${failed}" -gt 0 ]]; then
    echo "Failed commands:"
    for id in "${COMMAND_IDS[@]}"; do
      status="$(curl -s "${BASE}/nova4d/commands/${id}" | jq -r '.command.status // "unknown"')"
      if [[ "${status}" == "failed" ]]; then
        curl -s "${BASE}/nova4d/commands/${id}" | jq -r '"- \(.command.id) \(.command.route): \(.command.error // "unknown error")"'
      fi
    done
  fi
}

post /nova4d/scene/spawn-object '{"object_type":"cube","name":"NotesCube","position":[0,100,0]}'
post /nova4d/scene/set-transform '{"target_name":"NotesCube","position":[20,120,0],"scale":[1.2,1.2,1.2]}'
post /nova4d/material/create-standard '{"name":"NotesMat","color":[0.1,0.8,0.5]}'
post /nova4d/material/assign '{"target_name":"NotesCube","material_name":"NotesMat"}'
post /nova4d/mograph/cloner/create '{"name":"NotesCloner"}'
post /nova4d/xpresso/create-tag '{"target_name":"NotesCube"}'
post /nova4d/animation/set-key '{"target_name":"NotesCube","parameter":"position.x","frame":0,"value":20}'
post /nova4d/animation/set-key '{"target_name":"NotesCube","parameter":"position.x","frame":30,"value":140}'
post /nova4d/animation/delete-key '{"target_name":"NotesCube","parameter":"position.x","frame":30}'
post /nova4d/viewport/focus-object '{"target_name":"NotesCube"}'
post /nova4d/viewport/screenshot '{"frame":0,"output_path":"/tmp/nova4d-important-notes.png"}'
post /nova4d/render/frame '{"frame":0,"output_path":"/tmp/nova4d-render-frame.png"}'

echo "Queued important-notes smoke set (${#COMMAND_IDS[@]} commands)."

deadline=$((SECONDS + POLL_TIMEOUT_SEC))
while (( SECONDS < deadline )); do
  all_done=1
  for id in "${COMMAND_IDS[@]}"; do
    status="$(curl -s "${BASE}/nova4d/commands/${id}" | jq -r '.command.status // "unknown"')"
    if ! is_terminal "${status}"; then
      all_done=0
      break
    fi
  done
  if [[ "${all_done}" -eq 1 ]]; then
    break
  fi
  sleep "${POLL_INTERVAL_SEC}"
done

summarize_commands
echo "Recent history endpoint: ${BASE}/nova4d/commands/recent?limit=50"
