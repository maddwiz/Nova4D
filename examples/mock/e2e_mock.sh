#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${NOVA4D_PORT:-30110}"
HOST="${NOVA4D_HOST:-127.0.0.1}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then kill "${SERVER_PID}" >/dev/null 2>&1 || true; fi
  if [[ -n "${MOCK_PID:-}" ]]; then kill "${MOCK_PID}" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

cd "${ROOT_DIR}"

NOVA4D_HOST="${HOST}" NOVA4D_PORT="${PORT}" node server/index.js >/tmp/nova4d-e2e-server.log 2>&1 &
SERVER_PID=$!
sleep 1

NOVA4D_HOST="${HOST}" NOVA4D_PORT="${PORT}" MOCK_RUN_SECONDS=8 node examples/mock/mock_c4d_client.js >/tmp/nova4d-e2e-mock.log 2>&1 &
MOCK_PID=$!

curl -s -X POST "http://${HOST}:${PORT}/nova4d/scene/spawn-object" \
  -H 'Content-Type: application/json' \
  -d '{"object_type":"cube","name":"E2E_Mock_Cube","position":[1,120,3],"scale":[2,2,2]}' >/tmp/nova4d-e2e-cmd1.json

curl -s -X POST "http://${HOST}:${PORT}/nova4d/mograph/cloner/create" \
  -H 'Content-Type: application/json' \
  -d '{"name":"E2E_Cloner"}' >/tmp/nova4d-e2e-cmd2.json

wait "${MOCK_PID}"
sleep 1

echo "---- Health ----"
curl -s "http://${HOST}:${PORT}/nova4d/health"
echo
echo "---- Recent ----"
curl -s "http://${HOST}:${PORT}/nova4d/commands/recent?limit=10"
echo
echo "---- Mock log ----"
cat /tmp/nova4d-e2e-mock.log
