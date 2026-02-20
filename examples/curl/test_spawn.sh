#!/usr/bin/env bash
set -euo pipefail

curl -s -X POST http://localhost:30010/nova4d/test/ping \
  -H 'Content-Type: application/json' \
  -d '{"message":"Nova4D Connected"}' | jq .
