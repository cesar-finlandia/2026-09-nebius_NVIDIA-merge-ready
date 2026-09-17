# SPDX-License-Identifier: Apache-2.0
"""Receipt math + triggered-downgrade tests (DP-LEDGER W6)."""
import src.mergeready.sidecar.cost_routes as cost_routes
from src.cost import get_default_store


def _reset():
    get_default_store().reset()
    cost_routes._DOWNGRADE_LOG.clear()
    cost_routes._CURRENT_TIER.clear()


def test_summary_math():
    _reset()
    e1 = {"traceId": "t1", "role": "planner", "modelId": "unit-ultra-test", "promptTokens": 100000, "completionTokens": 50000, "latencyMs": 10}
    e2 = {"traceId": "t1", "role": "planner", "modelId": "unit-ultra-test", "promptTokens": 200000, "completionTokens": 0, "latencyMs": 5}
    assert cost_routes.handler("POST /cost/record", e1)["_status"] == 200
    assert cost_routes.handler("POST /cost/record", e2)["_status"] == 200
    res = cost_routes.handler("GET /cost/summary?trace_id=t1", {})
    assert res["calls"] == 2
    expected = round(100000 / 1e6 * 3.0 + 50000 / 1e6 * 6.0 + 200000 / 1e6 * 3.0, 6)
    assert res["usd"] == expected
    assert res["promptTokens"] == 300000
    assert res["completionTokens"] == 50000


def test_triggered_downgrade():
    d = cost_routes.decide_tier("planner", 0.5, 1.0, 0.75, 50.0, "ultra")
    assert d["tier"] == "super"
    assert d["reason"] == "run>=60% of MERGEREADY_RUN_BUDGET_USD or window>=70% of MERGEREADY_BUDGET_USD"


def test_invalid_body():
    res = cost_routes.handler("POST /cost/record", {"traceId": "t9"})
    assert res["_status"] == 400
    assert res["ok"] is False
    assert res["error"] == "invalid UsageEvent"
