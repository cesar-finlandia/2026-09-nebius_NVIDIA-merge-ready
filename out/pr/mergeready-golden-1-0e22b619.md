# Add arithmetic helpers (python) (Merge-Ready, 2/2 steps verified)

Branch: `mergeready/golden-1-0e22b619`

## Ticket
- id: golden-1
- title: Add arithmetic helpers (python)
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
| mergeready-0e22b619-1582-41fe-a069-c61d7409127f-step-1 | mergeready-baseline-0e22b619-1582-41fe-a069-c61d7409127f | 0 | 452 | false | 8c7269c5fa62 |
| mergeready-0e22b619-1582-41fe-a069-c61d7409127f-step-2 | mergeready-baseline-0e22b619-1582-41fe-a069-c61d7409127f | 0 | 438 | false | 65420d5628cd |

All branches green — no failure logs.

## Grounding
Query: example ticket python migration documentation OR migration guide OR breaking changes (tavily, 2026-09-04T00:00:00.000Z)
- [Example Doc](https://example.com/docs) — Example snippet for migration guide.
- [Example Migration Guide](https://example.com/migration) — Second example snippet for breaking changes.

## Receipt
## Cost receipt
trace `0e22b619-1582-41fe-a069-c61d7409127f` — 4 calls, 400 prompt + 200 completion tokens.

| role | model | prompt | completion | cost |
|---|---|---|---|---|
| total | — | 400 | 200 | est. $0.00096 |
| sandbox | — | — | — | 0 min / est. $0 |

### Downgrades
No downgrades — full-tier run.

grounding: tavily query="example ticket python migration documentation OR migration guide OR breaking changes" citations=2 urls=https://example.com/docs,https://example.com/migration

---
Planned with Nemotron 3 Ultra and drafted with Nemotron 3 Nano via Nebius Token Factory; every diff executed in Nebius Token Factory Sandboxes with rollback on red builds.
