# Add arithmetic helpers (python) (Merge-Ready, 0/2 steps verified)

Branch: `mergeready/golden-1-622d7c36`

## Ticket
- id: golden-1
- title: Add arithmetic helpers (python)
- link: https://example.com/mergeready-demo.git @ `main`

## Plan
Add sub() and mul() helpers to calc.py.

| step | file | intent | status | reason |
|---|---|---|---|---|
| step-1 | calc.py | Add sub(a, b) helper | rejected | exit-code:2 |
| step-2 | calc.py | Add mul(a, b) helper | rejected | exit-code:2 |

## Verification
| branch | parent | exit | duration_ms | rolled_back | sha |
|---|---|---|---|---|---|
| mergeready-622d7c36-58a4-44bc-9795-df9a810f83d4-step-1 | mergeready-baseline-622d7c36-58a4-44bc-9795-df9a810f83d4 | 2 | 688 | true | 8956a7afa4de |
| mergeready-622d7c36-58a4-44bc-9795-df9a810f83d4-step-2 | mergeready-baseline-622d7c36-58a4-44bc-9795-df9a810f83d4 | 2 | 608 | true | deecaac9096c |

<details><summary>mergeready-622d7c36-58a4-44bc-9795-df9a810f83d4-step-1 log (exit 2)</summary>

```

=================================== ERRORS ====================================
________________________ ERROR collecting test_calc.py ________________________
..\..\..\Roaming\uv\python\cpython-3.12.13-windows-x86_64-none\Lib\site-packages\_pytest\python.py:493: in importtestmodule
    mod = import_path(
..\..\..\Roaming\uv\python\cpython-3.12.13-windows-x86_64-none\Lib\site-packages\_pytest\pathlib.py:587: in import_path
    importlib.import_module(module_name)
..\..\..\Roaming\uv\python\cpython-3.12.13-windows-x86_64-none\Lib\importlib\__init__.py:90: in import_module
    return _bootstrap._gcd_import(name[level:], package, level)
<frozen importlib._bootstrap>:1387: in _gcd_import
    ???
<frozen importlib._bootstrap>:1360: in _find_and_load
    ???
<frozen importlib._bootstrap>:1331: in _find_and_load_unlocked
    ???
<frozen importlib._bootstrap>:935: in _load_unlocked
    ???
..\..\..\Roaming\uv\python\cpython-3.12.13-windows-x86_64-none\Lib\site-packages\_pytest\assertion\rewrite.py:184: in exec_module
    exec(co, module.__dict__)
test_calc.py:1: in <module>
```
</details>

<details><summary>mergeready-622d7c36-58a4-44bc-9795-df9a810f83d4-step-2 log (exit 2)</summary>

```

=================================== ERRORS ====================================
________________________ ERROR collecting test_calc.py ________________________
..\..\..\Roaming\uv\python\cpython-3.12.13-windows-x86_64-none\Lib\site-packages\_pytest\python.py:493: in importtestmodule
    mod = import_path(
..\..\..\Roaming\uv\python\cpython-3.12.13-windows-x86_64-none\Lib\site-packages\_pytest\pathlib.py:587: in import_path
    importlib.import_module(module_name)
..\..\..\Roaming\uv\python\cpython-3.12.13-windows-x86_64-none\Lib\importlib\__init__.py:90: in import_module
    return _bootstrap._gcd_import(name[level:], package, level)
<frozen importlib._bootstrap>:1387: in _gcd_import
    ???
<frozen importlib._bootstrap>:1360: in _find_and_load
    ???
<frozen importlib._bootstrap>:1331: in _find_and_load_unlocked
    ???
<frozen importlib._bootstrap>:935: in _load_unlocked
    ???
..\..\..\Roaming\uv\python\cpython-3.12.13-windows-x86_64-none\Lib\site-packages\_pytest\assertion\rewrite.py:184: in exec_module
    exec(co, module.__dict__)
test_calc.py:1: in <module>
```
</details>

## Grounding
Query: example ticket python migration documentation OR migration guide OR breaking changes (tavily, 2026-09-04T00:00:00.000Z)
- [Example Doc](https://example.com/docs) — Example snippet for migration guide.
- [Example Migration Guide](https://example.com/migration) — Second example snippet for breaking changes.

## Receipt
## Cost receipt
trace `622d7c36-58a4-44bc-9795-df9a810f83d4` — 0 calls, 0 prompt + 0 completion tokens.

| role | model | prompt | completion | cost |
|---|---|---|---|---|
| total | — | 0 | 0 | est. $0 |
| sandbox | — | — | — | 0 min / est. $0 |

### Downgrades
No downgrades — full-tier run.

grounding: tavily query="example ticket python migration documentation OR migration guide OR breaking changes" citations=2 urls=https://example.com/docs,https://example.com/migration

---
Planned with Nemotron 3 Ultra and drafted with Nemotron 3 Nano via Nebius Token Factory; every diff executed in Nebius Token Factory Sandboxes with rollback on red builds.
