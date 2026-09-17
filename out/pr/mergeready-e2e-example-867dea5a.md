# Fix flaky checkout total (Merge-Ready, 2/2 steps verified)

Branch: `mergeready/e2e-example-867dea5a`

## Ticket
- id: e2e-example
- title: Fix flaky checkout total
- link: https://example.com/mergeready-demo.git @ `main`

## Plan
Add sub() and mul() helpers to calc.py.

| step | file | intent | status | reason |
|---|---|---|---|---|
| step-1 | calc.py | Add sub(a, b) helper | accepted | — |
| step-2 | calc.py | Add mul(a, b) helper | accepted | — |
> Diff conflicts: Conflict: step step-2 also touches calc.py; kept later diff, dropped earlier diff for calc.py.

## Verification
| branch | parent | exit | duration_ms | rolled_back | sha |
|---|---|---|---|---|---|
| mergeready-867dea5a-7ce6-44f0-89c0-37d7e0c28aea-step-1 | mergeready-baseline-867dea5a-7ce6-44f0-89c0-37d7e0c28aea | 0 | 1218 | false | 8c7269c5fa62 |
| mergeready-867dea5a-7ce6-44f0-89c0-37d7e0c28aea-step-2 | mergeready-baseline-867dea5a-7ce6-44f0-89c0-37d7e0c28aea | 0 | 514 | false | 65420d5628cd |

All branches green — no failure logs.

## Grounding
Query: example ticket python migration documentation OR migration guide OR breaking changes (tavily, 2026-09-04T00:00:00.000Z)
- [Example Doc](https://example.com/docs) — Example snippet for migration guide.
- [Example Migration Guide](https://example.com/migration) — Second example snippet for breaking changes.

## Receipt
## Cost receipt
trace `867dea5a-7ce6-44f0-89c0-37d7e0c28aea` — 4 calls, 400 prompt + 200 completion tokens.

| role | model | prompt | completion | cost |
|---|---|---|---|---|
| planner | nvidia/nemotron-3-super-120b-a12b | 100 | 50 | est. $0.0004 |
| drafter | nvidia/nemotron-3-super-120b-a12b | 200 | 100 | est. $0.0001 |
| redrafter | nvidia/nemotron-3-super-120b-a12b | 100 | 50 | est. $0.0004 |
| total | — | 400 | 200 | est. $0.00096 |
| sandbox | — | — | — | 0 min / est. $0 |

### Downgrades
No downgrades — full-tier run.

## Plan
Add sub() and mul() helpers to calc.py.

| step | file | intent | status |
|---|---|---|---|
| step-1 | calc.py | Add sub(a, b) helper | accepted |
| step-2 | calc.py | Add mul(a, b) helper | accepted |

## Verification
| branch | exit | duration_ms | rolled_back | sha |
|---|---|---|---|---|
| mergeready-867dea5a-7ce6-44f0-89c0-37d7e0c28aea-step-1 | 0 | 1218 | false | 8c7269c5fa62 |
| mergeready-867dea5a-7ce6-44f0-89c0-37d7e0c28aea-step-2 | 0 | 514 | false | 65420d5628cd |

grounding: tavily query="example ticket python migration documentation OR migration guide OR breaking changes" citations=2 urls=https://example.com/docs,https://example.com/migration

---
Planned with Nemotron 3 Ultra and drafted with Nemotron 3 Nano via Nebius Token Factory; every diff executed in Nebius Token Factory Sandboxes with rollback on red builds.
