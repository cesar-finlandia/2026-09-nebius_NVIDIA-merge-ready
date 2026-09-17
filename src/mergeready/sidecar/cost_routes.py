# SPDX-License-Identifier: Apache-2.0
"""Cost metering sidecar routes (C-16, DP-LEDGER W4)."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

PRICING_PATH = Path(__file__).resolve().parents[3] / "config" / "mergeready-pricing.json"

_PRICING_CACHE = None


def load_pricing():
    """Read config/mergeready-pricing.json (cached). Never throws."""
    global _PRICING_CACHE
    if _PRICING_CACHE is not None:
        return _PRICING_CACHE
    try:
        import json

        with open(str(PRICING_PATH), "r", encoding="utf-8") as fh:
            _PRICING_CACHE = json.load(fh)
    except Exception:
        _PRICING_CACHE = {
            "tiers": {
                "ultra": {"input_usd_per_mtok": 3.0, "output_usd_per_mtok": 6.0},
                "super": {"input_usd_per_mtok": 1.2, "output_usd_per_mtok": 2.4},
                "nano": {"input_usd_per_mtok": 0.3, "output_usd_per_mtok": 0.6},
            },
            "sandbox_usd_per_minute": 0.05,
            "tier_by_role_default": {"planner": "ultra", "drafter": "nano", "redrafter": "ultra"},
        }
    return _PRICING_CACHE


def decide_tier(role, run_usd, window_usd, run_budget, window_budget, current_tier):
    """Pure downgrade ladder mirroring A5.1 literally. Never throws."""
    try:
        for v in (run_usd, window_usd, run_budget, window_budget):
            if not isinstance(v, (int, float)) or isinstance(v, bool):
                return {"tier": "nano", "hardStop": False, "reason": "invalid spend input"}
            try:
                import math

                if not math.isfinite(float(v)):
                    return {"tier": "nano", "hardStop": False, "reason": "invalid spend input"}
            except Exception:
                return {"tier": "nano", "hardStop": False, "reason": "invalid spend input"}
        if role == "drafter":
            return {"tier": "nano", "hardStop": False, "reason": None}
        if float(window_usd) >= float(window_budget):
            return {
                "tier": "nano",
                "hardStop": True,
                "reason": "window budget exhausted: windowUsd >= MERGEREADY_BUDGET_USD",
            }
        if float(run_usd) >= 0.9 * float(run_budget) or float(window_usd) >= 0.9 * float(window_budget):
            return {
                "tier": "nano",
                "hardStop": False,
                "reason": "run>=90% of MERGEREADY_RUN_BUDGET_USD or window>=90% of MERGEREADY_BUDGET_USD",
            }
        if float(run_usd) >= 0.6 * float(run_budget) or float(window_usd) >= 0.7 * float(window_budget):
            return {
                "tier": "super",
                "hardStop": False,
                "reason": "run>=60% of MERGEREADY_RUN_BUDGET_USD or window>=70% of MERGEREADY_BUDGET_USD",
            }
        return {"tier": "ultra", "hardStop": False, "reason": None}
    except Exception:
        return {"tier": "nano", "hardStop": False, "reason": "invalid spend input"}


_VALID_ROLES = ("planner", "drafter", "redrafter")

_DOWNGRADE_LOG: dict = {}
_CURRENT_TIER: dict = {}


def _role_default(role):
    try:
        defaults = load_pricing().get("tier_by_role_default") or {}
        tier = defaults.get(role)
        if tier in ("ultra", "super", "nano"):
            return tier
    except Exception:
        pass
    return {"planner": "ultra", "drafter": "nano", "redrafter": "ultra"}.get(role, "ultra")


def _tier_for_model(model_id):
    """Resolve tier by model-id substring map (ultra/super/nano); never hardcodes full ids."""
    try:
        text = str(model_id or "").lower()
        if "ultra" in text:
            return "ultra"
        if "super" in text:
            return "super"
        if "nano" in text:
            return "nano"
    except Exception:
        pass
    return "nano"


def _event_usd(prompt_tokens, completion_tokens, tier, sandbox_seconds):
    """Pricing multiplication only (no bespoke meter)."""
    pricing = load_pricing()
    tiers = pricing.get("tiers") or {}
    rates = tiers.get(tier) or tiers.get("nano") or {}
    try:
        in_rate = float(rates.get("input_usd_per_mtok", 0))
    except Exception:
        in_rate = 0.0
    try:
        out_rate = float(rates.get("output_usd_per_mtok", 0))
    except Exception:
        out_rate = 0.0
    try:
        sandbox_rate = float(pricing.get("sandbox_usd_per_minute", 0.05))
    except Exception:
        sandbox_rate = 0.05
    try:
        pt = float(prompt_tokens or 0)
    except Exception:
        pt = 0.0
    try:
        ct = float(completion_tokens or 0)
    except Exception:
        ct = 0.0
    try:
        sb = float(sandbox_seconds or 0)
    except Exception:
        sb = 0.0
    return pt / 1e6 * in_rate + ct / 1e6 * out_rate + sandbox_rate * sb / 60.0


def _budgets():
    import os

    try:
        run_b = float(os.environ.get("MERGEREADY_RUN_BUDGET_USD", "0.75"))
    except Exception:
        run_b = 0.75
    try:
        win_b = float(os.environ.get("MERGEREADY_BUDGET_USD", "50"))
    except Exception:
        win_b = 50.0
    return run_b, win_b


def _store():
    try:
        from src.cost import get_default_store
    except ImportError:
        from cost import get_default_store  # type: ignore

    return get_default_store()


def _record_usd(rec):
    try:
        tier = str(rec.get("tier") or _tier_for_model(rec.get("model_id", "")))
        if tier not in ("ultra", "super", "nano"):
            tier = _tier_for_model(rec.get("model_id", ""))
        return _event_usd(rec.get("prompt_tokens", 0), rec.get("completion_tokens", 0), tier, rec.get("sandbox_seconds", 0))
    except Exception:
        return 0.0


def _all_ledger_rows():
    try:
        rows = _store().get_all() or []
    except Exception:
        return []
    return [r for r in rows if isinstance(r, dict) and r.get("trace_id") is not None]


def _sums_for(trace_id):
    rows = [r for r in _all_ledger_rows() if str(r.get("trace_id")) == str(trace_id)]
    prompt = sum(int(r.get("prompt_tokens") or 0) for r in rows)
    completion = sum(int(r.get("completion_tokens") or 0) for r in rows)
    sandbox = sum(float(r.get("sandbox_seconds") or 0) for r in rows)
    usd = sum(_record_usd(r) for r in rows)
    return rows, prompt, completion, sandbox, usd


def _window_usd():
    return sum(_record_usd(r) for r in _all_ledger_rows())


def _validate_record_body(body):
    if not isinstance(body, dict):
        return None
    trace_id = body.get("traceId", body.get("trace_id", ""))
    role = body.get("role", "")
    model_id = body.get("modelId", body.get("model_id", ""))
    prompt_tokens = body.get("promptTokens", body.get("prompt_tokens"))
    completion_tokens = body.get("completionTokens", body.get("completion_tokens"))
    latency_ms = body.get("latencyMs", body.get("latency_ms"))
    sandbox_seconds = body.get("sandboxSeconds", body.get("sandbox_seconds", 0.0))
    if not trace_id or not isinstance(trace_id, str):
        return None
    if role not in _VALID_ROLES:
        return None
    if not model_id or not isinstance(model_id, str):
        return None
    for v in (prompt_tokens, completion_tokens, latency_ms):
        if isinstance(v, bool) or not isinstance(v, (int, float)):
            return None
    try:
        sb = float(sandbox_seconds or 0)
    except Exception:
        return None
    return {
        "trace_id": str(trace_id),
        "role": str(role),
        "model_id": str(model_id),
        "prompt_tokens": int(prompt_tokens),
        "completion_tokens": int(completion_tokens),
        "latency_ms": int(latency_ms),
        "sandbox_seconds": float(sb),
    }


def _do_record(body):
    try:
        parsed = _validate_record_body(body)
        if parsed is None:
            return {"ok": False, "error": "invalid UsageEvent", "_status": 400}
        tier = _tier_for_model(parsed["model_id"])
        usd = _event_usd(parsed["prompt_tokens"], parsed["completion_tokens"], tier, parsed["sandbox_seconds"])

        def _append():
            import time
            import uuid

            store = _store()
            record = {
                "id": str(uuid.uuid4()),
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "provider": "tokenfactory",
                "label": "record",
                "model_profile": tier,
                "input_tokens": int(parsed["prompt_tokens"]),
                "output_tokens": int(parsed["completion_tokens"]),
                "total_tokens": int(parsed["prompt_tokens"]) + int(parsed["completion_tokens"]),
                "request_count": 1,
                "estimated_cost_usd": round(float(usd), 6),
                "unmetered": False,
                "unmetered_reason": "",
                "raw_usage_ref": None,
                "trace_id": parsed["trace_id"],
                "role": parsed["role"],
                "model_id": parsed["model_id"],
                "prompt_tokens": int(parsed["prompt_tokens"]),
                "completion_tokens": int(parsed["completion_tokens"]),
                "latency_ms": int(parsed["latency_ms"]),
                "sandbox_seconds": float(parsed["sandbox_seconds"]),
                "tier": tier,
            }
            store.append(record)
            return True

        try:
            try:
                from src.cost import with_cost_guardrail
            except ImportError:
                from cost import with_cost_guardrail  # type: ignore

            guarded = with_cost_guardrail(_append, {"provider": "tokenfactory", "label": "record"})
            guarded()
        except Exception:
            _append()
        return {"ok": True, "_status": 200}
    except Exception:
        return {"ok": False, "error": "record_failed", "_status": 500}


def _do_summary(query, body):
    try:
        trace_id = query.get("trace_id", "")
        if not trace_id and isinstance(body, dict):
            trace_id = body.get("traceId", body.get("trace_id", ""))
        if not trace_id or not isinstance(trace_id, str):
            return {"error": "missing trace_id", "_status": 400}
        rows, prompt, completion, sandbox, usd = _sums_for(trace_id)
        downgrades = []
        for entry in list(_DOWNGRADE_LOG.get(str(trace_id), [])):
            downgrades.append({"role": entry["role"], "from": entry["from"], "to": entry["to"], "reason": entry["reason"]})
        return {
            "traceId": str(trace_id),
            "calls": len(rows),
            "promptTokens": int(prompt),
            "completionTokens": int(completion),
            "usd": round(float(usd), 6),
            "sandboxSeconds": float(sandbox),
            "downgrades": downgrades,
            "_status": 200,
        }
    except Exception:
        return {"error": "summary_failed", "_status": 500}


def _do_policy(query, body):
    try:
        role = query.get("role", "")
        if not role and isinstance(body, dict):
            role = body.get("role", "")
        trace_id = query.get("trace_id", query.get("traceId", ""))
        if not trace_id and isinstance(body, dict):
            trace_id = body.get("traceId", body.get("trace_id", ""))
        if role not in _VALID_ROLES:
            return {"error": "invalid role", "_status": 400}
        run_budget, window_budget = _budgets()
        if trace_id:
            _, _, _, _, run_usd = _sums_for(str(trace_id))
        else:
            run_usd = 0.0
        window_usd = _window_usd()
        key = (str(trace_id or ""), str(role))
        current_tier = _CURRENT_TIER.get(key) or _role_default(role)
        decision = decide_tier(role, float(run_usd), float(window_usd), float(run_budget), float(window_budget), str(current_tier))
        new_tier = str(decision.get("tier"))
        if new_tier != current_tier:
            reason = decision.get("reason") or ""
            _CURRENT_TIER[key] = new_tier
            if trace_id:
                _DOWNGRADE_LOG.setdefault(str(trace_id), []).append(
                    {"role": role, "from": current_tier, "to": new_tier, "reason": reason}
                )
        else:
            _CURRENT_TIER[key] = current_tier
        return {"tier": new_tier, "hardStop": bool(decision.get("hardStop", False)), "_status": 200}
    except Exception:
        try:
            role = (body or {}).get("role", "planner") if isinstance(body, dict) else "planner"
            if role not in _VALID_ROLES:
                role = "planner"
        except Exception:
            role = "planner"
        return {"tier": _role_default(role), "hardStop": False, "_status": 200, "_headers": {"X-Degraded": "true"}}


def _parse_method_path(method_path):
    """Split 'METHOD /cost/path?query' into (method, path, query). Also accepts bare '/path?query'."""
    from urllib.parse import parse_qs, urlsplit

    raw = str(method_path or "")
    method = ""
    target = raw
    parts = raw.split(None, 1)
    if len(parts) == 2 and parts[0].upper() in ("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"):
        method = parts[0].upper()
        target = parts[1].strip()
    if "://" in target:
        try:
            target = urlsplit(target).path + ("?" + urlsplit(target).query if urlsplit(target).query else "")
        except Exception:
            pass
    path = target.split("?", 1)[0].strip() or "/"
    qs = target.split("?", 1)[1] if "?" in target else ""
    query: dict = {}
    try:
        for k, v in parse_qs(qs, keep_blank_values=True).items():
            query[k] = v[0] if v else ""
    except Exception:
        query = {}
    norm = path
    if norm.startswith("/cost"):
        norm = norm[len("/cost"):] or "/"
    if not norm.startswith("/"):
        norm = "/" + norm
    return method, norm, query


def handler(method_path, body=None):
    """Dispatch POST /cost/record, GET /cost/summary, GET /cost/policy. Never raises."""
    try:
        if body is None:
            body = {}
        if not isinstance(body, dict):
            return {"ok": False, "error": "invalid UsageEvent", "_status": 400}
        method, path, query = _parse_method_path(method_path)
        if path in ("/record", "/cost/record") or (method == "POST" and path == "/"):
            return _do_record(body)
        if path == "/summary":
            return _do_summary(query, body)
        if path == "/policy":
            return _do_policy(query, body)
        if path == "/" and method in ("", "GET"):
            return {"error": "not found", "_status": 404}
        return {"error": "not found", "_status": 404}
    except Exception:
        return {"ok": False, "error": "record_failed", "_status": 500}


try:
    from mergeready.sidecar.server import register_router as _register_router

    _register_router("/cost", handler)
except Exception:
    try:
        from .server import register_router as _register_router2  # type: ignore

        _register_router2("/cost", handler)
    except Exception:
        pass


@dataclass(frozen=True)
class UsageEvent:
    trace_id: str
    role: str
    model_id: str
    prompt_tokens: int
    completion_tokens: int
    latency_ms: int
    sandbox_seconds: float = 0.0


@dataclass(frozen=True)
class DowngradeEntry:
    role: str
    from_tier: str
    to_tier: str
    reason: str


@dataclass(frozen=True)
class CostReceipt:
    trace_id: str
    calls: int
    prompt_tokens: int
    completion_tokens: int
    usd: float
    sandbox_seconds: float
    downgrades: list = field(default_factory=list)
