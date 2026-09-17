"""Sandbox routes: /sandbox/baseline, /sandbox/branch, /sandbox/rollback.

Adapters: sdk | cli | fake (default sdk; MERGEREADY_MODE==replay forces fake).
Probed names: see docs/sandbox-probe.txt ADAPTATION (SDK missing offline,
so assumed baseline images.use()/run(tag, disposable) is used).
"""
import datetime
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import time

STDOUT_LIMIT = 20000


def _utc_now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")


_FAKE_MAP_FILE = os.path.join(tempfile.gettempdir(), "mergeready_fake_map.json")
_FAKE_CACHE = None


def _adapter_name():
    if os.environ.get("MERGEREADY_MODE") == "replay":
        return "fake"
    name = os.environ.get("SANDBOX_ADAPTER", "sdk")
    if name not in ("sdk", "cli", "fake"):
        return "sdk"
    return name


def _fake_load():
    global _FAKE_CACHE
    if _FAKE_CACHE is not None:
        return _FAKE_CACHE
    try:
        with open(_FAKE_MAP_FILE, "r", encoding="utf-8") as f:
            _FAKE_CACHE = json.load(f)
    except Exception:
        _FAKE_CACHE = {}
    return _FAKE_CACHE


def _fake_save():
    try:
        with open(_FAKE_MAP_FILE, "w", encoding="utf-8") as f:
            json.dump(_fake_load(), f)
    except Exception:
        pass


def _truncate(s, limit=STDOUT_LIMIT):
    if s is None:
        return ""
    if not isinstance(s, str):
        s = str(s)
    return s[:limit]


def _baseline_fields(body):
    if isinstance(body.get("repoSnapshot"), dict):
        snap = body["repoSnapshot"]
        return (
            body.get("traceId", snap.get("traceId", "")),
            snap.get("baseImage", body.get("baseImage", "")),
            snap.get("files", body.get("files", [])),
            snap.get("testCommand", body.get("testCommand", "")),
        )
    return (
        body.get("traceId", ""),
        body.get("baseImage", ""),
        body.get("files", []),
        body.get("testCommand", ""),
    )


def _baseline_fake(trace_id, files):
    tag = "mergeready-baseline-%s" % trace_id
    workdir = tempfile.mkdtemp(prefix="mergeready-baseline-")
    for entry in files or []:
        if not isinstance(entry, dict):
            continue
        rel = entry.get("path", "")
        text = entry.get("text", "")
        if not rel:
            continue
        dest = os.path.join(workdir, rel)
        os.makedirs(os.path.dirname(dest) or workdir, exist_ok=True)
        with open(dest, "w", encoding="utf-8") as f:
            f.write(text if isinstance(text, str) else str(text))
    image_id = "fake-%s" % trace_id
    created = _utc_now()
    m = _fake_load()
    m[tag] = {"imageId": image_id, "createdAt": created, "dir": workdir}
    _fake_save()
    return {"tag": tag, "imageId": image_id, "createdAt": created}


def _baseline_sdk(trace_id, base_image, files, test_command):
    # Lazy import only; probed names substituted here if docs/sandbox-probe.txt differs.
    # Assumed baseline: images.use(baseImage) / run(npm install) / tag(disposable=False).
    try:
        from contree_client.httpx import ContreeAsyncClient  # type: ignore
    except Exception:
        from contree_sdk import ContreeAsyncClient  # type: ignore  # noqa
    import asyncio

    async def _run():
        client = ContreeAsyncClient.from_profile()
        base = await client.images.use(base_image)
        for entry in files or []:
            await base.upload(entry.get("path", ""), (entry.get("text", "") or "").encode("utf-8"))
        await base.run(shell="npm install", tag="mergeready-baseline-%s" % trace_id, disposable=False)
        tag = "mergeready-baseline-%s" % trace_id
        handle = await client.images.use(tag, strict=True)
        image_id = str(getattr(handle, "image_id", getattr(handle, "id", tag)))
        return {"tag": tag, "imageId": image_id, "createdAt": _utc_now()}
    return asyncio.run(_run())


def _baseline_cli(trace_id, base_image, files, test_command):
    tag = "mergeready-baseline-%s" % trace_id
    for entry in files or []:
        rel = (entry.get("path", "") if isinstance(entry, dict) else "")
        text = (entry.get("text", "") if isinstance(entry, dict) else "")
        subprocess.run(["contree", "images", "use", base_image, "--upload", "%s" % rel],
                       input=(text or "").encode("utf-8"), check=True, timeout=300)
    subprocess.run(["contree", "run", "--image", base_image, "--shell", "npm install",
                    "--tag", tag, "--disposable", "False"], check=True, timeout=600)
    out = subprocess.run(["contree", "images", "inspect", tag], capture_output=True, text=True, timeout=60)
    image_id = out.stdout.strip() or tag
    return {"tag": tag, "imageId": image_id, "createdAt": _utc_now()}


def _baseline(body):
    trace_id, base_image, files, test_command = _baseline_fields(body)
    adapter = _adapter_name()
    if adapter == "fake":
        return _baseline_fake(trace_id, files)
    if adapter == "cli":
        return _baseline_cli(trace_id, base_image, files, test_command)
    return _baseline_sdk(trace_id, base_image, files, test_command)


def _timeout_seconds(body):
    try:
        v = body.get("timeoutSeconds", None)
        if v is None:
            v = int(os.environ.get("SANDBOX_TEST_TIMEOUT_S", "300"))
        return int(v)
    except Exception:
        return 300


def _fork_fake_dir(parent_tag):
    m = _fake_load()
    entry = m.get(parent_tag)
    branch_dir = tempfile.mkdtemp(prefix="mergeready-branch-")
    if entry and entry.get("dir") and os.path.isdir(entry["dir"]):
        for name in os.listdir(entry["dir"]):
            s = os.path.join(entry["dir"], name)
            d = os.path.join(branch_dir, name)
            try:
                if os.path.isdir(s):
                    shutil.copytree(s, d)
                else:
                    shutil.copy2(s, d)
            except Exception:
                pass
    return branch_dir


def _run_test_command(test_command, cwd, timeout_s):
    start = time.monotonic()
    try:
        proc = subprocess.run(test_command, shell=True, cwd=cwd, capture_output=True,
                              text=True, timeout=timeout_s)
        end = time.monotonic()
        return proc.returncode, proc.stdout or "", proc.stderr or "", int((end - start) * 1000)
    except subprocess.TimeoutExpired as e:
        end = time.monotonic()
        out = e.stdout.decode("utf-8", "replace") if isinstance(e.stdout, bytes) else (e.stdout or "")
        err = e.stderr.decode("utf-8", "replace") if isinstance(e.stderr, bytes) else (e.stderr or "")
        return 124, out, err, int((end - start) * 1000)


def _git_apply(branch_dir, diff_text):
    patch_path = os.path.join(branch_dir, ".mergeready-patch.diff")
    with open(patch_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(diff_text)
    try:
        tmp_copy = os.path.join(tempfile.gettempdir(), "patch.diff")
        try:
            shutil.copyfile(patch_path, tmp_copy)
        except Exception:
            pass
    except Exception:
        pass
    check = subprocess.run(["git", "apply", "--check", patch_path], cwd=branch_dir,
                           capture_output=True, text=True, timeout=60)
    if check.returncode != 0:
        return False, check.returncode, check.stdout or "", check.stderr or ""
    applied = subprocess.run(["git", "apply", patch_path], cwd=branch_dir,
                             capture_output=True, text=True, timeout=60)
    if applied.returncode != 0:
        return False, applied.returncode, applied.stdout or "", applied.stderr or ""
    return True, 0, "", ""


def _branch_fake(body, verified_sha, branch_tag, parent_tag):
    unified_diff = body.get("unifiedDiff", "") or ""
    test_command = body.get("testCommand", "") or "true"
    timeout_s = _timeout_seconds(body)
    branch_dir = _fork_fake_dir(parent_tag)
    ok, code, out, err = _git_apply(branch_dir, unified_diff)
    if not ok:
        shutil.rmtree(branch_dir, ignore_errors=True)
        return {"branchTag": branch_tag, "parentTag": parent_tag, "exitCode": int(code),
                "stdout": _truncate(out), "stderr": _truncate(err),
                "durationMs": 0, "verifiedSha": verified_sha, "rolledBack": True}
    exit_code, stdout, stderr, duration_ms = _run_test_command(test_command, branch_dir, timeout_s)
    if exit_code == 0:
        m = _fake_load()
        trace_id = body.get("traceId", "")
        step_id = body.get("stepId", "")
        m[branch_tag] = {"imageId": "fake-%s-%s" % (trace_id, step_id),
                         "createdAt": _utc_now(), "dir": branch_dir}
        _fake_save()
        rolled = False
    else:
        shutil.rmtree(branch_dir, ignore_errors=True)
        rolled = True
    return {"branchTag": branch_tag, "parentTag": parent_tag, "exitCode": int(exit_code),
            "stdout": _truncate(stdout), "stderr": _truncate(stderr),
            "durationMs": int(duration_ms), "verifiedSha": verified_sha, "rolledBack": rolled}


def _branch_sdk(body, verified_sha, branch_tag, parent_tag):
    try:
        from contree_client.httpx import ContreeAsyncClient  # type: ignore
    except Exception:
        from contree_sdk import ContreeAsyncClient  # type: ignore  # noqa
    import asyncio
    unified_diff = body.get("unifiedDiff", "") or ""
    test_command = body.get("testCommand", "") or "true"
    timeout_s = _timeout_seconds(body)

    async def _run():
        client = ContreeAsyncClient.from_profile()
        branch = await client.images.use(parent_tag, strict=True)
        await branch.write("/tmp/patch.diff", unified_diff.encode("utf-8"))
        check = await branch.run(shell="git apply --check /tmp/patch.diff")
        if getattr(check, "exit_code", getattr(check, "exitCode", 1)) != 0:
            return {"branchTag": branch_tag, "parentTag": parent_tag,
                    "exitCode": int(getattr(check, "exit_code", 1)),
                    "stdout": _truncate(getattr(check, "stdout", "")),
                    "stderr": _truncate(getattr(check, "stderr", "")),
                    "durationMs": 0, "verifiedSha": verified_sha, "rolledBack": True}
        await branch.run(shell="git apply /tmp/patch.diff")
        start = time.monotonic()
        res = await branch.run(shell=test_command, timeout=timeout_s)
        end = time.monotonic()
        code = int(getattr(res, "exit_code", getattr(res, "exitCode", 1)))
        if code == 0:
            await branch.tag(branch_tag, disposable=False)
        return {"branchTag": branch_tag, "parentTag": parent_tag, "exitCode": code,
                "stdout": _truncate(getattr(res, "stdout", "")),
                "stderr": _truncate(getattr(res, "stderr", "")),
                "durationMs": int((end - start) * 1000), "verifiedSha": verified_sha,
                "rolledBack": (code != 0)}
    return asyncio.run(_run())


def _branch_cli(body, verified_sha, branch_tag, parent_tag):
    unified_diff = body.get("unifiedDiff", "") or ""
    test_command = body.get("testCommand", "") or "true"
    timeout_s = _timeout_seconds(body)
    subprocess.run(["contree", "images", "fork", parent_tag, branch_tag], check=True, timeout=300)
    with tempfile.NamedTemporaryFile("w", suffix=".diff", delete=False, encoding="utf-8") as f:
        f.write(unified_diff)
        patch = f.name
    check = subprocess.run(["contree", "run", "--image", branch_tag, "--shell",
                            "git apply --check /tmp/patch.diff"],
                           capture_output=True, text=True, timeout=60)
    if check.returncode != 0:
        return {"branchTag": branch_tag, "parentTag": parent_tag, "exitCode": int(check.returncode),
                "stdout": _truncate(check.stdout), "stderr": _truncate(check.stderr),
                "durationMs": 0, "verifiedSha": verified_sha, "rolledBack": True}
    subprocess.run(["contree", "run", "--image", branch_tag, "--shell", "git apply /tmp/patch.diff"],
                   check=True, timeout=120)
    start = time.monotonic()
    try:
        proc = subprocess.run(["contree", "run", "--image", branch_tag, "--shell", test_command],
                              capture_output=True, text=True, timeout=timeout_s)
        end = time.monotonic()
        code, out, err = proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired as e:
        end = time.monotonic()
        code, out, err = 124, str(e.stdout or ""), str(e.stderr or "")
    duration_ms = int((end - start) * 1000)
    if code == 0:
        subprocess.run(["contree", "images", "tag", branch_tag, "--disposable", "False"],
                       check=True, timeout=120)
    return {"branchTag": branch_tag, "parentTag": parent_tag, "exitCode": int(code),
            "stdout": _truncate(out), "stderr": _truncate(err),
            "durationMs": duration_ms, "verifiedSha": verified_sha, "rolledBack": (code != 0)}


def _branch(body):
    trace_id = body.get("traceId", "")
    step_id = body.get("stepId", "")
    parent_tag = body.get("parentTag", "")
    unified_diff = body.get("unifiedDiff", "") or ""
    verified_sha = hashlib.sha256(unified_diff.encode("utf-8")).hexdigest()
    branch_tag = "mergeready-%s-%s" % (trace_id, step_id)
    adapter = _adapter_name()
    if adapter == "fake":
        return _branch_fake(body, verified_sha, branch_tag, parent_tag)
    if adapter == "cli":
        return _branch_cli(body, verified_sha, branch_tag, parent_tag)
    return _branch_sdk(body, verified_sha, branch_tag, parent_tag)


def _rollback_fake(branch_tag, parent_tag):
    m = _fake_load()
    entry = m.pop(branch_tag, None)
    if entry and entry.get("dir"):
        shutil.rmtree(entry["dir"], ignore_errors=True)
    _fake_save()
    parent = _fake_load().get(parent_tag)
    if parent:
        return {"tag": parent_tag, "imageId": parent.get("imageId", parent_tag),
                "createdAt": parent.get("createdAt", _utc_now())}
    return {"tag": parent_tag, "imageId": parent_tag, "createdAt": _utc_now()}


def _rollback_sdk(branch_tag, parent_tag):
    try:
        from contree_client.httpx import ContreeAsyncClient  # type: ignore
    except Exception:
        from contree_sdk import ContreeAsyncClient  # type: ignore  # noqa
    import asyncio

    async def _run():
        client = ContreeAsyncClient.from_profile()
        try:
            await client.images.delete(branch_tag)
        except Exception:
            pass
        parent = await client.images.use(parent_tag, strict=True)
        image_id = str(getattr(parent, "image_id", getattr(parent, "id", parent_tag)))
        return {"tag": parent_tag, "imageId": image_id, "createdAt": _utc_now()}
    return asyncio.run(_run())


def _rollback_cli(branch_tag, parent_tag):
    subprocess.run(["contree", "images", "delete", branch_tag], check=False, timeout=120)
    out = subprocess.run(["contree", "images", "inspect", parent_tag],
                         capture_output=True, text=True, timeout=60)
    image_id = out.stdout.strip() or parent_tag
    return {"tag": parent_tag, "imageId": image_id, "createdAt": _utc_now()}


def _rollback(body):
    branch_tag = body.get("branchTag", "")
    parent_tag = body.get("parentTag", "")
    adapter = _adapter_name()
    if adapter == "fake":
        return _rollback_fake(branch_tag, parent_tag)
    if adapter == "cli":
        return _rollback_cli(branch_tag, parent_tag)
    return _rollback_sdk(branch_tag, parent_tag)


def handler(path, body):
    try:
        if not isinstance(body, dict):
            return {"error": {"kind": "BadRequest", "message": "invalid body"}}
        if path == "/baseline":
            return _baseline(body)
        if path == "/branch":
            return _branch(body)
        if path == "/rollback":
            return _rollback(body)
        return {"error": {"kind": "NotFound", "message": "unknown path %s" % path}}
    except Exception as e:
        return {"error": {"kind": type(e).__name__, "message": str(e)[:500]}}


try:
    from .server import register_router as _register_router  # type: ignore
    _register_router("/sandbox", handler)
except Exception:
    try:
        import pathlib as _pathlib
        import importlib.util as _ilu
        _srv = _pathlib.Path(__file__).with_name("server.py")
        _spec = _ilu.spec_from_file_location("mergeready_sidecar_server", str(_srv))
        if _spec and _spec.loader:
            _mod = _ilu.module_from_spec(_spec)
            _spec.loader.exec_module(_mod)
            if hasattr(_mod, "register_router"):
                _mod.register_router("/sandbox", handler)
    except Exception:
        pass
