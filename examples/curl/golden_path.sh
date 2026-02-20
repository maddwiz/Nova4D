#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:30010}"

echo "Queue cube spawn"
curl -s -X POST "${BASE}/nova4d/scene/spawn-object" \
  -H 'Content-Type: application/json' \
  -d '{"object_type":"cube","name":"GoldenCube","position":[0,100,0],"scale":[1.5,1.5,1.5]}' | jq .

echo "Queue MoGraph cloner"
curl -s -X POST "${BASE}/nova4d/mograph/cloner/create" \
  -H 'Content-Type: application/json' \
  -d '{"name":"GoldenCloner"}' | jq .

echo "Queue Redshift render"
curl -s -X POST "${BASE}/nova4d/render/queue/redshift" \
  -H 'Content-Type: application/json' \
  -d '{"frame":0,"output_path":"/tmp/nova4d-golden.png"}' | jq .

echo "Recent commands"
curl -s "${BASE}/nova4d/commands/recent?limit=5" | jq .
