#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

OPEN_C4D=0
FOREGROUND=0

for arg in "$@"; do
  case "${arg}" in
    --open-c4d) OPEN_C4D=1 ;;
    --foreground) FOREGROUND=1 ;;
    *)
      echo "[Nova4D] Unknown argument: ${arg}"
      echo "Usage: $0 [--open-c4d] [--foreground]"
      exit 1
      ;;
  esac
done

detect_c4d_app() {
  local app=""
  app="$(find /Applications "${HOME}/Applications" -maxdepth 3 -type d -name 'Cinema 4D.app' 2>/dev/null | sort | tail -n 1 || true)"
  echo "${app}"
}

detect_c4dpy() {
  local app_path="$1"
  local c4dpy=""
  if [[ -n "${app_path}" ]]; then
    c4dpy="${app_path}/Contents/MacOS/c4dpy"
    if [[ -x "${c4dpy}" ]]; then
      echo "${c4dpy}"
      return 0
    fi
  fi
  c4dpy="$(find /Applications "${HOME}/Applications" -maxdepth 5 -type f -name c4dpy 2>/dev/null | sort | tail -n 1 || true)"
  if [[ -n "${c4dpy}" ]]; then
    echo "${c4dpy}"
    return 0
  fi
  echo "/Applications/Maxon Cinema 4D 2026/Cinema 4D.app/Contents/MacOS/c4dpy"
}

if [[ -f "${ROOT_DIR}/.env" ]]; then
  while IFS='=' read -r key value; do
    [[ -z "${key}" ]] && continue
    [[ "${key}" =~ ^[[:space:]]*# ]] && continue
    if [[ "${key}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      if [[ -z "${!key+x}" ]]; then
        export "${key}=${value}"
      fi
    fi
  done < "${ROOT_DIR}/.env"
fi

export NOVA4D_HOST="${NOVA4D_HOST:-127.0.0.1}"
export NOVA4D_PORT="${NOVA4D_PORT:-30010}"
export NOVA4D_PLUGIN_ID_COMMAND="${NOVA4D_PLUGIN_ID_COMMAND:-1067627}"
export NOVA4D_PLUGIN_ID_MESSAGE="${NOVA4D_PLUGIN_ID_MESSAGE:-1067628}"
export NOVA4D_SPECIAL_EVENT_ID="${NOVA4D_SPECIAL_EVENT_ID:-1067629}"

if [[ "${NOVA4D_PLUGIN_ID_COMMAND}" == "1234567" ]] || [[ "${NOVA4D_PLUGIN_ID_MESSAGE}" == "1234568" ]] || [[ "${NOVA4D_SPECIAL_EVENT_ID}" == "1234569" ]]; then
  echo "[Nova4D] WARNING: legacy placeholder PluginCafe IDs are active."
  echo "[Nova4D] For marketplace/release builds, request official IDs and run: bash scripts/check_plugin_ids.sh"
fi

DETECTED_APP="$(detect_c4d_app)"
export NOVA4D_C4D_PATH="${NOVA4D_C4D_PATH:-$(detect_c4dpy "${DETECTED_APP}")}"
HEALTH_URL="http://${NOVA4D_HOST}:${NOVA4D_PORT}/nova4d/health"

if [[ ! -d node_modules ]]; then
  echo "[Nova4D] Installing npm dependencies..."
  npm install
fi

echo "[Nova4D] host=${NOVA4D_HOST} port=${NOVA4D_PORT}"
echo "[Nova4D] c4dpy=${NOVA4D_C4D_PATH}"
echo "[Nova4D] health=${HEALTH_URL}"

if [[ "${FOREGROUND}" -eq 1 ]]; then
  npm start
  exit 0
fi

LOG_FILE="${NOVA4D_LOG_FILE:-/tmp/nova4d-server.log}"
nohup node server/index.js >"${LOG_FILE}" 2>&1 &
SERVER_PID=$!
sleep 1

echo "[Nova4D] server pid=${SERVER_PID} log=${LOG_FILE}"
if ! kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
  echo "[Nova4D] server process exited early. See log: ${LOG_FILE}"
  exit 1
fi
HEALTH_RESPONSE="$(curl -fsS "${HEALTH_URL}" || true)"
if [[ -z "${HEALTH_RESPONSE}" || "${HEALTH_RESPONSE}" != *'"product":"Nova4D"'* ]]; then
  echo "[Nova4D] health check failed"
  exit 1
fi
echo "${HEALTH_RESPONSE}"
echo

if [[ "${OPEN_C4D}" -eq 1 ]]; then
  if [[ -n "${DETECTED_APP}" && -d "${DETECTED_APP}" ]]; then
    open "${DETECTED_APP}"
    echo "[Nova4D] opened Cinema 4D: ${DETECTED_APP}"
  else
    echo "[Nova4D] Cinema 4D app not found on this machine."
  fi
fi
