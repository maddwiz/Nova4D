#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:30010}"

post() {
  local route="$1"
  local body="$2"
  echo "--> ${route}"
  curl -s -X POST "${BASE}${route}" -H 'Content-Type: application/json' -d "${body}" | jq .
  echo
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

echo "Queued important-notes smoke set."
echo "Now verify results in: ${BASE}/nova4d/commands/recent?limit=25"
