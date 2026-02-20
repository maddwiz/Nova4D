#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /path/to/file.gltf"
  exit 1
fi

curl -s -X POST http://localhost:30010/nova4d/blender/import/upload \
  -F "file=@$1" \
  -F "format=gltf" \
  -F "scale_fix=blender_to_c4d" \
  -F "scale_factor=1.0" | jq .
