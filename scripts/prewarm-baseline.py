"""Prewarm baseline (W7)."""
import json
import os
import urllib.request

BASE = os.environ.get("MERGEREADY_SIDECAR_URL", "http://127.0.0.1:8787").rstrip("/")
TRACE = os.environ.get("MERGEREADY_PREWARM_TRACE", "prewarm")

body = {
    "traceId": TRACE,
    "baseImage": "ubuntu:latest",
    "files": [{"path": "app.txt", "bytes": 6, "text": "hello\n"}],
    "testCommand": "python -c \"print('ok')\"",
}
data = json.dumps(body).encode("utf-8")
req = urllib.request.Request(BASE + "/sandbox/baseline", data=data,
                             headers={"Content-Type": "application/json"})
with urllib.request.urlopen(req, timeout=120) as resp:
    payload = json.loads(resp.read().decode("utf-8") or "{}")
print(payload.get("tag", payload))
