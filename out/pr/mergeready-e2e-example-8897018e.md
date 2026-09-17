# Fix flaky checkout total (Merge-Ready, 0/2 steps verified)

Branch: `mergeready/e2e-example-8897018e`

## Ticket
- id: e2e-example
- title: Fix flaky checkout total
- link: https://example.com/mergeready-demo.git @ `main`

## Plan
Add sub() and mul() helpers to calc.py.

| step | file | intent | status | reason |
|---|---|---|---|---|
| step-1 | calc.py | Add sub(a, b) helper | rejected | budget-exhausted |
| step-2 | calc.py | Add mul(a, b) helper | rejected | budget-exhausted |

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
trace `8897018e-f253-4612-baa2-dc0904c38ec6` — 1 calls, 100 prompt + 50 completion tokens.

| role | model | prompt | completion | cost |
|---|---|---|---|---|
| total | — | 100 | 50 | est. $0.00024 |
| sandbox | — | — | — | 0 min / est. $0 |

### Downgrades
No downgrades — full-tier run.

grounding: tavily query="example ticket python migration documentation OR migration guide OR breaking changes" citations=2 urls=https://example.com/docs,https://example.com/migration

---
Planned with Nemotron 3 Ultra and drafted with Nemotron 3 Nano via Nebius Token Factory; every diff executed in Nebius Token Factory Sandboxes with rollback on red builds.
