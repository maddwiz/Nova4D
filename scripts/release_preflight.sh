#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

VERSION="v1.0.1"
ALLOW_PLACEHOLDER_IDS=0
SKIP_UI_TESTS=0
STRICT_LEGAL_SIGNOFF=0

for arg in "$@"; do
  case "${arg}" in
    --allow-placeholder-ids)
      ALLOW_PLACEHOLDER_IDS=1
      ;;
    --skip-ui-tests)
      SKIP_UI_TESTS=1
      ;;
    --strict-legal-signoff)
      STRICT_LEGAL_SIGNOFF=1
      ;;
    v*)
      VERSION="${arg}"
      ;;
    *)
      echo "[Nova4D] Unknown argument: ${arg}" >&2
      echo "Usage: $0 [vX.Y.Z] [--allow-placeholder-ids] [--skip-ui-tests] [--strict-legal-signoff]" >&2
      exit 1
      ;;
  esac
done

run_step() {
  local label="$1"
  shift
  echo "[Nova4D] ${label}"
  "$@"
}

run_step "Running syntax checks..." npm run check
run_step "Running unit tests..." npm run test:unit
run_step "Checking version alignment..." bash scripts/check_version_sync.sh

if [[ "${SKIP_UI_TESTS}" -eq 0 ]]; then
  run_step "Running UI tests..." npm run test:ui
else
  echo "[Nova4D] Skipping UI tests (--skip-ui-tests)."
fi

if [[ "${STRICT_LEGAL_SIGNOFF}" -eq 1 ]]; then
  run_step "Checking legal signoff (strict)..." bash scripts/check_legal_signoff.sh --strict
else
  run_step "Checking legal signoff (warning mode)..." bash scripts/check_legal_signoff.sh
fi

if [[ "${ALLOW_PLACEHOLDER_IDS}" -eq 1 ]]; then
  run_step "Validating PluginCafe IDs (dev mode)..." bash scripts/check_plugin_ids.sh --allow-placeholders
else
  run_step "Validating PluginCafe IDs..." bash scripts/check_plugin_ids.sh
fi

run_step "Building + verifying release zip ${VERSION}..." bash scripts/package_release.sh "${VERSION}"

echo "[Nova4D] Release preflight passed for ${VERSION}."
