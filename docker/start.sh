#!/bin/sh
# DP-API W6 — supervise the Python sidecar and the Node API server together.
set -e
PORT="${PORT:-8080}"
export PORT
python -m src.mergeready.sidecar &
SIDECAR_PID=$!
npx vite-node -e 'import("./src/mergeready/api/server.js").then(async (m) => { const s = m.createServer({ port: Number(process.env.PORT || "8080") }); await s.listen(); console.log("mergeready listening on " + (process.env.PORT || "8080")); })' &
API_PID=$!
wait $SIDECAR_PID $API_PID
