"""Serverless Jobs batch dispatch (W6, A5-5)."""
import hashlib
import json
import os
import time
import urllib.request

POLL_INTERVAL_S = 3
MAX_WAIT_S = 600


def _threshold_default():
    try:
        return int(os.environ.get("MERGEREADY_JOBS_THRESHOLD", "4"))
    except Exception:
        return 4


def build_batch(traceId, parentTag, branches):
    items = []
    for b in branches or []:
        items.append({
            "stepId": b.get("stepId", ""),
            "file": b.get("file", ""),
            "unifiedDiff": b.get("unifiedDiff", ""),
            "testCommand": b.get("testCommand", ""),
            "timeoutSeconds": int(b.get("timeoutSeconds", 300)),
        })
    return {"traceId": traceId, "parentTag": parentTag, "branches": items}


def _jobs_endpoint():
    return os.environ.get("MERGEREADY_JOBS_ENDPOINT", "")


def submit_batch(traceId, parentTag, branches):
    batch = build_batch(traceId, parentTag, branches)
    endpoint = _jobs_endpoint()
    if not endpoint:
        # Offline / no endpoint: return a local job record carrying the batch.
        # run_batch_or_sequential treats this as transport-unavailable and
        # falls back to sequential unless a poll_fn is injected (tests).
        return {"jobId": "local-%s" % (traceId,), "batch": batch}
    url = endpoint.rstrip("/") + "/jobs"
    data = json.dumps(batch).encode("utf-8")
    req = urllib.request.Request(url, data=data,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode("utf-8") or "{}")
    job_id = payload.get("jobId", "") if isinstance(payload, dict) else ""
    return {"jobId": job_id, "batch": batch, "response": payload}


def _fetch_job_status(jobId):
    endpoint = _jobs_endpoint()
    if not endpoint:
        raise RuntimeError("jobs endpoint not configured")
    url = endpoint.rstrip("/") + "/jobs/" + str(jobId)
    with urllib.request.urlopen(url, timeout=30) as resp:
        payload = json.loads(resp.read().decode("utf-8") or "{}")
    return payload if isinstance(payload, dict) else {}


def poll_job(jobId, get_status=None, sleep_fn=None, now_fn=None):
    poll_interval = 3
    max_wait = 600
    fetch = get_status or _fetch_job_status
    sleep = sleep_fn or time.sleep
    now = now_fn or time.monotonic
    start = now()
    last = {}
    while True:
        try:
            status_doc = fetch(jobId)
        except Exception as e:
            raise
        if not isinstance(status_doc, dict):
            status_doc = {}
        last = status_doc
        status = str(status_doc.get("status", ""))
        if status in ("done", "failed"):
            return status_doc
        if (now() - start) >= max_wait:
            result = dict(status_doc)
            result["status"] = "timeout"
            return result
        sleep(poll_interval)


def _run_sequential(traceId, parentTag, branches, branch_fn=None):
    if branch_fn is not None:
        return [branch_fn(traceId, parentTag, b) for b in (branches or [])]
    from . import sandbox_routes as _routes
    results = []
    for b in (branches or []):
        body = {
            "traceId": traceId,
            "stepId": b.get("stepId", ""),
            "parentTag": parentTag,
            "file": b.get("file", ""),
            "unifiedDiff": b.get("unifiedDiff", ""),
            "testCommand": b.get("testCommand", ""),
            "timeoutSeconds": int(b.get("timeoutSeconds", 300)),
        }
        results.append(_routes.handler("/branch", body))
    return results


def _map_done_to_results(done_doc, traceId, parentTag, branches):
    items = []
    raw = done_doc.get("results", done_doc.get("branches", []))
    if isinstance(raw, list) and raw:
        for entry in raw:
            if isinstance(entry, dict) and "branchTag" in entry:
                items.append(entry)
        if items:
            return items
    # Fallback mapping: synthesize per-branch results from payloads.
    out = []
    payloads = raw if isinstance(raw, list) else []
    for i, b in enumerate(branches or []):
        payload = payloads[i] if i < len(payloads) and isinstance(payloads[i], dict) else {}
        diff = b.get("unifiedDiff", "") or ""
        out.append({
            "branchTag": "mergeready-%s-%s" % (traceId, b.get("stepId", "")),
            "parentTag": parentTag,
            "exitCode": int(payload.get("exitCode", 0)),
            "stdout": str(payload.get("stdout", "")),
            "stderr": str(payload.get("stderr", "")),
            "durationMs": payload.get("durationMs", 0),
            "verifiedSha": hashlib.sha256(diff.encode("utf-8")).hexdigest(),
            "rolledBack": bool(payload.get("rolledBack", False)),
        })
    return out


def run_batch_or_sequential(traceId, parentTag, branches, threshold=None,
                            submit_fn=None, poll_fn=None, sequential_fn=None):
    if threshold is None:
        threshold = _threshold_default()
    try:
        threshold = int(threshold)
    except Exception:
        threshold = 4
    count = len(branches or [])
    if count <= threshold:
        return _run_sequential(traceId, parentTag, branches, branch_fn=sequential_fn)
    submit = submit_fn or submit_batch
    # Batch mode: without a configured endpoint and without an injected
    # submit_fn, submit_batch returns a local-* jobId which cannot complete
    # remotely, so fall back to sequential (transport-unavailable path).
    try:
        submitted = submit(traceId, parentTag, branches)
    except Exception:
        return _run_sequential(traceId, parentTag, branches, branch_fn=sequential_fn)
    job_id = submitted.get("jobId", "") if isinstance(submitted, dict) else ""
    if not job_id or str(job_id).startswith("local-") and submit_fn is None:
        if poll_fn is None:
            return _run_sequential(traceId, parentTag, branches, branch_fn=sequential_fn)
    poll = poll_fn or poll_job
    try:
        done = poll(job_id)
    except Exception:
        return _run_sequential(traceId, parentTag, branches, branch_fn=sequential_fn)
    if not isinstance(done, dict):
        return _run_sequential(traceId, parentTag, branches, branch_fn=sequential_fn)
    if done.get("status") == "done":
        try:
            return _map_done_to_results(done, traceId, parentTag, branches)
        except Exception:
            return _run_sequential(traceId, parentTag, branches, branch_fn=sequential_fn)
    return _run_sequential(traceId, parentTag, branches, branch_fn=sequential_fn)
