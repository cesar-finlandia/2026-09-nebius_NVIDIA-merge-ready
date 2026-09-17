"""Jobs batch tests (W6)."""
import hashlib
import importlib.util
import pathlib

_jobs_path = pathlib.Path(__file__).with_name("jobs.py")
_spec = importlib.util.spec_from_file_location("mergeready_jobs", str(_jobs_path))
jobs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(jobs)


def _branches(n):
    return [{"stepId": "s%d" % i, "file": "a.txt", "unifiedDiff": "diff-%d" % i,
             "testCommand": "true", "timeoutSeconds": 60} for i in range(n)]


def test_threshold_selects_batch_vs_sequential():
    seen = {}

    def fake_submit(traceId, parentTag, branches):
        seen["submit"] = True
        batch = jobs.build_batch(traceId, parentTag, branches)
        assert set(batch.keys()) == {"traceId", "parentTag", "branches"}
        assert len(batch["branches"]) == 5
        assert set(batch["branches"][0].keys()) == {"stepId", "file", "unifiedDiff", "testCommand", "timeoutSeconds"}
        return {"jobId": "job-1", "batch": batch}

    def fake_poll(jobId):
        assert jobId == "job-1"
        seen["poll"] = True
        return {"status": "done", "results": [
            {"branchTag": "mergeready-t-s%d" % i, "parentTag": "p",
             "exitCode": 0, "stdout": "ok", "stderr": "",
             "durationMs": 1,
             "verifiedSha": hashlib.sha256(("diff-%d" % i).encode()).hexdigest(),
             "rolledBack": False} for i in range(5)]}

    def boom(*a, **k):
        raise AssertionError("sequential must not run in batch mode")

    res = jobs.run_batch_or_sequential("t", "p", _branches(5), threshold=4,
                                       submit_fn=fake_submit, poll_fn=fake_poll,
                                       sequential_fn=boom)
    assert len(res) == 5
    assert seen.get("submit") is True and seen.get("poll") is True
    assert res[0]["branchTag"] == "mergeready-t-s0"

    seq_seen = {}

    def seq(traceId, parentTag, b):
        seq_seen[b["stepId"]] = True
        return {"branchTag": "mergeready-%s-%s" % (traceId, b["stepId"]),
                "parentTag": parentTag, "exitCode": 0, "stdout": "", "stderr": "",
                "durationMs": 0,
                "verifiedSha": hashlib.sha256(b["unifiedDiff"].encode()).hexdigest(),
                "rolledBack": False}

    def no_submit(*a, **k):
        raise AssertionError("batch must not run for count 2")

    res2 = jobs.run_batch_or_sequential("t", "p", _branches(2), threshold=4,
                                        submit_fn=no_submit, sequential_fn=seq)
    assert len(res2) == 2
    assert len(seq_seen) == 2


def test_timeout_falls_back_to_sequential():
    calls = {"seq": 0}

    def fake_submit(traceId, parentTag, branches):
        return {"jobId": "job-timeout"}

    def fake_poll_timeout(jobId):
        # Simulate poll_job timeout shape without sleeping 600s.
        return {"status": "timeout"}

    def seq(traceId, parentTag, b):
        calls["seq"] += 1
        return {"branchTag": "mergeready-%s-%s" % (traceId, b["stepId"]),
                "parentTag": parentTag, "exitCode": 0, "stdout": "seq",
                "stderr": "", "durationMs": 0,
                "verifiedSha": hashlib.sha256(b["unifiedDiff"].encode()).hexdigest(),
                "rolledBack": False}

    res = jobs.run_batch_or_sequential("t", "p", _branches(5), threshold=4,
                                       submit_fn=fake_submit,
                                       poll_fn=fake_poll_timeout,
                                       sequential_fn=seq)
    assert len(res) == 5
    assert calls["seq"] == 5
    assert all(r["stdout"] == "seq" for r in res)
    # Real poll_job timeout path: get_status never done, zero-sleep fake clock.
    clock = {"t": 0.0}

    def never_done(jobId):
        return {"status": "running"}

    out = jobs.poll_job("j", get_status=never_done,
                        sleep_fn=lambda s: clock.__setitem__("t", clock["t"] + s),
                        now_fn=lambda: clock["t"])
    assert out["status"] == "timeout"
