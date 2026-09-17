# Fix flaky checkout total (Merge-Ready, 0/1 steps verified)

Branch: `mergeready/e2e-example-435df0dd`

## Ticket
- id: e2e-example
- title: Fix flaky checkout total
- link: https://example.com/mergeready-demo.git @ `main`

## Plan
fallback: single step

| step | file | intent | status | reason |
|---|---|---|---|---|
| s1 | fallback.txt | Fix flaky checkout total | rejected | draft-degraded |

## Verification
| branch | parent | exit | duration_ms | rolled_back | sha |
|---|---|---|---|---|---|


All branches green — no failure logs.

## Grounding
Query: example ticket python migration documentation OR migration guide OR breaking changes (tavily, 2026-09-04T00:00:00.000Z)
- [Example Doc](https://example.com/docs) — Example snippet for migration guide.
- [Example Migration Guide](https://example.com/migration) — Second example snippet for breaking changes.

## Receipt
## Cost receipt
trace `435df0dd-e80c-44eb-be32-217245186917` — 0 calls, 0 prompt + 0 completion tokens.

| role | model | prompt | completion | cost |
|---|---|---|---|---|
| total | — | 0 | 0 | est. $0 |
| sandbox | — | — | — | 0 min / est. $0 |

### Downgrades
No downgrades — full-tier run.

grounding: tavily query="example ticket python migration documentation OR migration guide OR breaking changes" citations=2 urls=https://example.com/docs,https://example.com/migration

---
Planned with Nemotron 3 Ultra and drafted with Nemotron 3 Nano via Nebius Token Factory; every diff executed in Nebius Token Factory Sandboxes with rollback on red builds.
