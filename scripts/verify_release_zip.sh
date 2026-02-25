#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:-v1.0.1}"
DIST_DIR="${ROOT_DIR}/dist"
PKG_NAME="Nova4D-${VERSION}"
ZIP_PATH="${DIST_DIR}/${PKG_NAME}.zip"

if [[ ! -f "${ZIP_PATH}" ]]; then
  echo "[Nova4D] ERROR: release zip not found: ${ZIP_PATH}" >&2
  echo "[Nova4D] Run: bash scripts/package_release.sh ${VERSION}" >&2
  exit 1
fi

if ! command -v unzip >/dev/null 2>&1; then
  echo "[Nova4D] ERROR: 'unzip' command is required to verify release zip contents." >&2
  exit 1
fi

entries=()
while IFS= read -r line; do
  entries+=("${line}")
done < <(unzip -Z1 "${ZIP_PATH}")

if [[ "${#entries[@]}" -eq 0 ]]; then
  echo "[Nova4D] ERROR: zip is empty: ${ZIP_PATH}" >&2
  exit 1
fi

have_prefix() {
  local prefix="$1"
  local line
  for line in "${entries[@]}"; do
    if [[ "${line}" == "${prefix}"* ]]; then
      return 0
    fi
  done
  return 1
}

have_exact() {
  local file="$1"
  local line
  for line in "${entries[@]}"; do
    if [[ "${line}" == "${file}" ]]; then
      return 0
    fi
  done
  return 1
}

missing=0
check_prefix() {
  local required="$1"
  if ! have_prefix "${required}"; then
    echo "[Nova4D] ERROR: missing required directory/content prefix: ${required}" >&2
    missing=1
  fi
}

check_file() {
  local required="$1"
  if ! have_exact "${required}"; then
    echo "[Nova4D] ERROR: missing required file: ${required}" >&2
    missing=1
  fi
}

check_prefix "${PKG_NAME}/server/"
check_prefix "${PKG_NAME}/plugins/"
check_prefix "${PKG_NAME}/extensions/"
check_prefix "${PKG_NAME}/python-sdk/"
check_prefix "${PKG_NAME}/mcp-server/"
check_prefix "${PKG_NAME}/scripts/"
check_prefix "${PKG_NAME}/examples/"
check_prefix "${PKG_NAME}/docs/"

check_file "${PKG_NAME}/README.md"
check_file "${PKG_NAME}/API.md"
check_file "${PKG_NAME}/QUICK_START.md"
check_file "${PKG_NAME}/INSTALL.md"
check_file "${PKG_NAME}/BuyerGuide.md"
check_file "${PKG_NAME}/RELEASE_CHECKLIST.md"
check_file "${PKG_NAME}/SETUP_MACOS.md"
check_file "${PKG_NAME}/SETUP_WINDOWS.md"
check_file "${PKG_NAME}/SETUP_LINUX.md"
check_file "${PKG_NAME}/EULA.txt"
check_file "${PKG_NAME}/package.json"
check_file "${PKG_NAME}/.env.example"

blocked=0
block_prefixes=(
  "${PKG_NAME}/legacy/"
  "${PKG_NAME}/node_modules/"
  "${PKG_NAME}/test-results/"
  "${PKG_NAME}/dist/"
  "${PKG_NAME}/.git/"
)

line=""
for line in "${entries[@]}"; do
  for banned in "${block_prefixes[@]}"; do
    if [[ "${line}" == "${banned}"* ]]; then
      echo "[Nova4D] ERROR: blocked path included in release zip: ${line}" >&2
      blocked=1
    fi
  done
  if [[ "${line}" == *"/__pycache__/"* ]] || [[ "${line}" == *".DS_Store"* ]]; then
    echo "[Nova4D] ERROR: blocked artifact included in release zip: ${line}" >&2
    blocked=1
  fi
done

if [[ "${missing}" -ne 0 || "${blocked}" -ne 0 ]]; then
  exit 2
fi

echo "[Nova4D] Release zip verification passed: ${ZIP_PATH}"
echo "[Nova4D] Entries checked: ${#entries[@]}"
