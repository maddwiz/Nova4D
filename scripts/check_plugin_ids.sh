#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ALLOW_PLACEHOLDERS=0

for arg in "$@"; do
  case "${arg}" in
    --allow-placeholders)
      ALLOW_PLACEHOLDERS=1
      ;;
    *)
      echo "[Nova4D] Unknown argument: ${arg}" >&2
      echo "Usage: $0 [--allow-placeholders]" >&2
      exit 1
      ;;
  esac
done

load_env_file() {
  local env_file="$1"
  if [[ ! -f "${env_file}" ]]; then
    return 0
  fi
  while IFS='=' read -r key value; do
    [[ -z "${key}" ]] && continue
    [[ "${key}" =~ ^[[:space:]]*# ]] && continue
    if [[ "${key}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      if [[ -z "${!key+x}" ]]; then
        export "${key}=${value}"
      fi
    fi
  done < "${env_file}"
}

load_env_file "${ROOT_DIR}/.env"

PLUGIN_ID_COMMAND="${NOVA4D_PLUGIN_ID_COMMAND:-}"
PLUGIN_ID_MESSAGE="${NOVA4D_PLUGIN_ID_MESSAGE:-}"
SPECIAL_EVENT_ID="${NOVA4D_SPECIAL_EVENT_ID:-}"

fail=0

validate_int() {
  local name="$1"
  local value="$2"
  if [[ -z "${value}" ]]; then
    echo "[Nova4D] ERROR: ${name} is not set." >&2
    fail=1
    return
  fi
  if [[ ! "${value}" =~ ^[0-9]+$ ]]; then
    echo "[Nova4D] ERROR: ${name} must be an integer. Got: ${value}" >&2
    fail=1
  fi
}

validate_int "NOVA4D_PLUGIN_ID_COMMAND" "${PLUGIN_ID_COMMAND}"
validate_int "NOVA4D_PLUGIN_ID_MESSAGE" "${PLUGIN_ID_MESSAGE}"
validate_int "NOVA4D_SPECIAL_EVENT_ID" "${SPECIAL_EVENT_ID}"

if [[ "${PLUGIN_ID_COMMAND}" == "${PLUGIN_ID_MESSAGE}" ]] \
  || [[ "${PLUGIN_ID_COMMAND}" == "${SPECIAL_EVENT_ID}" ]] \
  || [[ "${PLUGIN_ID_MESSAGE}" == "${SPECIAL_EVENT_ID}" ]]; then
  echo "[Nova4D] ERROR: Plugin IDs must be unique (command, message, special event)." >&2
  fail=1
fi

placeholder_hit=0
if [[ "${PLUGIN_ID_COMMAND}" == "1234567" ]] || [[ "${PLUGIN_ID_MESSAGE}" == "1234568" ]] || [[ "${SPECIAL_EVENT_ID}" == "1234569" ]]; then
  placeholder_hit=1
fi

if [[ "${fail}" -ne 0 ]]; then
  exit 1
fi

if [[ "${placeholder_hit}" -eq 1 && "${ALLOW_PLACEHOLDERS}" -ne 1 ]]; then
  echo "[Nova4D] ERROR: Placeholder PluginCafe IDs are still configured." >&2
  echo "[Nova4D] Request official IDs and update NOVA4D_PLUGIN_ID_* before release." >&2
  echo "[Nova4D] See docs/PLUGINCAFE_IDS.md for the exact process." >&2
  exit 2
fi

if [[ "${placeholder_hit}" -eq 1 ]]; then
  echo "[Nova4D] OK (local/dev): placeholder PluginCafe IDs are in use."
  exit 0
fi

echo "[Nova4D] OK: PluginCafe IDs are set, unique, and non-placeholder."
