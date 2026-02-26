#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SIGNOFF_FILE="${ROOT_DIR}/docs/LEGAL_SIGNOFF.md"
STRICT=0

for arg in "$@"; do
  case "${arg}" in
    --strict)
      STRICT=1
      ;;
    *)
      echo "[Nova4D] Unknown argument: ${arg}" >&2
      echo "Usage: $0 [--strict]" >&2
      exit 1
      ;;
  esac
done

warn_or_fail() {
  local msg="$1"
  if [[ "${STRICT}" -eq 1 ]]; then
    echo "[Nova4D] ERROR: ${msg}" >&2
    exit 2
  fi
  echo "[Nova4D] WARN: ${msg}" >&2
  return 0
}

if [[ ! -f "${SIGNOFF_FILE}" ]]; then
  warn_or_fail "Legal signoff file missing: ${SIGNOFF_FILE}"
  exit 0
fi

if ! rg -q "^LEGAL_APPROVED:\s*true\s*$" "${SIGNOFF_FILE}"; then
  warn_or_fail "EULA legal signoff not approved in ${SIGNOFF_FILE}"
  exit 0
fi

if ! rg -q "^APPROVED_BY:\s*.+$" "${SIGNOFF_FILE}"; then
  warn_or_fail "APPROVED_BY missing in ${SIGNOFF_FILE}"
  exit 0
fi

if ! rg -q "^APPROVED_AT:\s*.+$" "${SIGNOFF_FILE}"; then
  warn_or_fail "APPROVED_AT missing in ${SIGNOFF_FILE}"
  exit 0
fi

echo "[Nova4D] OK: legal signoff check passed."
