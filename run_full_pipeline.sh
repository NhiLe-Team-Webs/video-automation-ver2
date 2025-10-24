#!/usr/bin/env bash
set -euo pipefail

# Resolve repo root
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Step 1: Run the Python enrichment pipeline (transcript -> plan.json)
pushd "$ROOT/python-be" >/dev/null
./run_all.sh "$@"
popd >/dev/null

# Step 2: Start Remotion preview with regenerated inputs
pushd "$ROOT/remotion-app" >/dev/null
if [[ ! -d node_modules ]]; then
  npm install
fi
npm start
popd >/dev/null
