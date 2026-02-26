#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if ! command -v node >/dev/null 2>&1; then
  echo "[Nova4D] ERROR: node is required for version sync check." >&2
  exit 1
fi

VERSION="$(node -p "require('./package.json').version")"
if [[ -z "${VERSION}" ]]; then
  echo "[Nova4D] ERROR: package.json version is missing." >&2
  exit 1
fi
VERSION_TAG="v${VERSION}"

assert_file_contains() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if ! rg -q --fixed-strings "${pattern}" "${file}"; then
    echo "[Nova4D] ERROR: ${label} mismatch. Expected '${pattern}' in ${file}" >&2
    return 1
  fi
  return 0
}

assert_equals() {
  local actual="$1"
  local expected="$2"
  local label="$3"
  if [[ "${actual}" != "${expected}" ]]; then
    echo "[Nova4D] ERROR: ${label} mismatch. Expected '${expected}', got '${actual}'" >&2
    return 1
  fi
  return 0
}

FAIL=0

README_FILE="${ROOT_DIR}/README.md"
OPENCLAW_MANIFEST="${ROOT_DIR}/extensions/openclaw/cinema4d-bridge/openclaw.plugin.json"
RELEASE_NOTES_FILE="${ROOT_DIR}/docs/RELEASE_NOTES_${VERSION_TAG}.md"

OPENCLAW_VERSION="$(node -p "require('./extensions/openclaw/cinema4d-bridge/openclaw.plugin.json').version")"

assert_equals "${OPENCLAW_VERSION}" "${VERSION}" "OpenClaw plugin version" || FAIL=1
assert_file_contains "${README_FILE}" "Nova4D-${VERSION_TAG}.zip" "README package version" || FAIL=1
assert_file_contains "${README_FILE}" "verify_release_zip.sh ${VERSION_TAG}" "README verify command version" || FAIL=1
assert_file_contains "${ROOT_DIR}/scripts/package_release.sh" "VERSION=\"\${1:-${VERSION_TAG}}\"" "package_release default version" || FAIL=1
assert_file_contains "${ROOT_DIR}/scripts/verify_release_zip.sh" "VERSION=\"\${1:-${VERSION_TAG}}\"" "verify_release default version" || FAIL=1
assert_file_contains "${ROOT_DIR}/scripts/release_preflight.sh" "VERSION=\"${VERSION_TAG}\"" "release_preflight default version" || FAIL=1
assert_file_contains "${ROOT_DIR}/docs/RELEASE_CHECKLIST.md" "dist/Nova4D-${VERSION_TAG}.zip" "release checklist package version" || FAIL=1
assert_file_contains "${ROOT_DIR}/docs/RELEASE_CHECKLIST.md" "verify_release_zip.sh ${VERSION_TAG}" "release checklist verify version" || FAIL=1

if [[ ! -f "${RELEASE_NOTES_FILE}" ]]; then
  echo "[Nova4D] ERROR: release notes file missing for ${VERSION_TAG}: ${RELEASE_NOTES_FILE}" >&2
  FAIL=1
fi

if [[ "${FAIL}" -ne 0 ]]; then
  exit 2
fi

echo "[Nova4D] OK: version sync check passed (${VERSION_TAG})."
