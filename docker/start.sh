#!/bin/sh
# DP-API W6 — supervise the Python sidecar and the Node API server together.
set -e
PORT="${PORT:-8080}"
export PORT
export API_PORT="${API_PORT:-$PORT}"
python3 -m src.mergeready.sidecar &
# Wait for the sidecar before exposing Node: Cloud Run's TCP probe passes as
# soon as Node listens, which can send the first baseline into a sidecar that
# is still importing (connection refused -> baseline:failed). Poll locally.
for i in $(seq 1 60); do
  if python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8787/healthz', timeout=2)" 2>/dev/null; then break; fi
  sleep 1
done
npx vite-node scripts/serve-api.ts &
wait
