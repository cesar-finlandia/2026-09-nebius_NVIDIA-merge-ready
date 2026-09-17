"""Fake-adapter tests for sandbox routes (W3)."""
import hashlib
import importlib.util
import os
import pathlib

import pytest

_ROUTES = pathlib.Path(__file__).with_name("sandbox_routes.py")
_spec = importlib.util.spec_from_file_location("sandbox_routes", str(_ROUTES))
sandbox_routes = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sandbox_routes)


def _diff_one_line():
    return ("--- a/app.txt\n+++ b/app.txt\n@@ -1 +1 @@\n-hello\n+hello world\n")


def test_fake_baseline_tag():
    body = {"traceId": "t1", "baseImage": "ubuntu:latest",
            "files": [{"path": "app.txt", "bytes": 6, "text": "hello\n"}],
            "testCommand": "python -c \"print('ok')\""}
    res = sandbox_routes.handler("/baseline", body)
    assert res["tag"] == "mergeready-baseline-t1"
    assert res["imageId"] == "fake-t1"
    assert "createdAt" in res


def test_fake_branch_applies_diff():
    diff = _diff_one_line()
    baseline = sandbox_routes.handler("/baseline", {
        "traceId": "t2", "baseImage": "ubuntu:latest",
        "files": [{"path": "app.txt", "bytes": 6, "text": "hello\n"}],
        "testCommand": "python -c \"print('ok')\""})
    parent_tag = baseline["tag"]
    res = sandbox_routes.handler("/branch", {
        "traceId": "t2", "stepId": "s1", "parentTag": parent_tag,
        "file": "app.txt", "unifiedDiff": diff,
        "testCommand": "python -c \"print('ok')\"", "timeoutSeconds": 60})
    assert res["exitCode"] == 0
    assert res["branchTag"] == "mergeready-t2-s1"
    assert len(res["verifiedSha"]) == 64
    assert res["verifiedSha"] == hashlib.sha256(diff.encode("utf-8")).hexdigest()
    assert res["rolledBack"] is False


def test_fake_rollback_parent_intact():
    baseline = sandbox_routes.handler("/baseline", {
        "traceId": "t3", "baseImage": "ubuntu:latest",
        "files": [{"path": "app.txt", "bytes": 6, "text": "hello\n"}],
        "testCommand": "python -c \"print('ok')\""})
    parent_tag = baseline["tag"]
    branch = sandbox_routes.handler("/branch", {
        "traceId": "t3", "stepId": "s9", "parentTag": parent_tag,
        "file": "app.txt", "unifiedDiff": _diff_one_line(),
        "testCommand": "python -c \"print('ok')\"", "timeoutSeconds": 60})
    branch_tag = branch["branchTag"]
    res = sandbox_routes.handler("/rollback", {"branchTag": branch_tag, "parentTag": parent_tag})
    assert res["tag"] == parent_tag
    m = sandbox_routes._fake_load()
    assert parent_tag in m
    assert branch_tag not in m
