#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ ! -d node_modules ]]; then
  echo "[Nova4D] Installing npm dependencies..."
  npm install
fi

echo "[Nova4D] Starting bridge server on http://localhost:${NOVA4D_PORT:-30010}"
npm start
