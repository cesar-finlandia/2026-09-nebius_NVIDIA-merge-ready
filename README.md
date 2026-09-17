# Merge-Ready — Licensed under Apache-2.0

Ticket-to-green-PR operator console for the Nebius x NVIDIA Global AI
Hackathon. Paste a ticket, and Merge-Ready plans the patch, drafts each diff,
executes it in a sandbox, rolls back red builds, re-drafts once, and composes
a pull request from green builds only.

## What it is

Merge-Ready drives the full ticket-to-PR loop: intake, ticket grounding,
baseline checkpoint, context packing, planning, draft, sandboxed verification,
re-draft on red, ledger receipt, PR composition.

The green-builds-only rule is absolute: only diffs whose sandboxed test run
goes green reach the pull request. A red build is rolled back with the
baseline tag untouched and re-drafted exactly once; a run where nothing goes
green proposes nothing.

## Quickstart

```sh
npm run dev
```

```sh
curl -X POST http://localhost:8787/runs -H 'content-type: application/json' \
  --data '{"ticket":{"id":"demo-1","title":"Fix flaky checkout total","body":"Cart total drops discount when coupon applied twice.","repoUrl":"https://example.com/mergeready-demo.git","branchBase":"main"},"repo":{"snapshotDir":"."}}'
```

## Environment

| Name | Type | Default | Effect |
|---|---|---|---|
| `NEBIUS_API_KEY` | string | empty | Live Token Factory calls; absent forces replay mode |
| `NEBIUS_BASE_URL` | string | `https://api.tokenfactory.nebius.com/v1/` | Base URL for chat completions |
| `TAVILY_API_KEY` | string | empty | Live grounding calls; absent yields degraded grounding |
| `CONTREE_PROFILE` | string | empty | Sandbox profile selector |
| `MERGEREADY_MODE` | string | `live` | `live` runs providers; `replay` serves `examples/mergeready/golden-run.json` |
| `MERGEREADY_SIDECAR_URL` | string | `http://127.0.0.1:8787` | Sidecar base URL |
| `MERGEREADY_MAX_STEPS` | number string | `6` | Cap on plan steps |
| `MERGEREADY_BUDGET_USD` | number string | `50` | Total budget cap |
| `MERGEREADY_RUN_BUDGET_USD` | number string | `0.75` | Per-run budget cap |
| `MERGEREADY_JOBS_THRESHOLD` | number string | `4` | Parallel branch threshold |
| `MERGEREADY_PR_MODE` | string | `dry` | `dry` never opens a live pull request; `live` requires `GITHUB_TOKEN` |
| `GITHUB_TOKEN` | string | empty | Required only when `MERGEREADY_PR_MODE` is `live` |

## Start the sidecar

```sh
python -m src.mergeready.sidecar
```

Override the URL the server probes with `MERGEREADY_SIDECAR_URL`
(default `http://127.0.0.1:8787`); a non-default value disables the local
spawn and the server boots degraded when the probe fails.

## Replay mode with no keys

```sh
MERGEREADY_MODE=replay npm run dev
```

Replays `examples/mergeready/golden-run.json` with zero network — visually
identical to a live run. Design evidence lives in
`design_documents/ui-screenshots/` (14 files, both themes, every state).

## Run the tests

```sh
npm test
npm run test:context
npx vitest run scripts/lint-mergeready.test.ts
npx playwright test -c e2e/playwright.config.ts
```

## License

Licensed under Apache-2.0 — see LICENSE.

## Mandatory technologies used

- Nebius Token Factory chat completions (planner on Ultra, drafter on Nano, fallback on Super)
- Token Factory Sandboxes (branch, test, rollback, re-draft)
- Nebius AI Cloud Serverless Endpoints (deploy target, min instances 1)
- NVIDIA Nemotron 3 models (planner on Ultra, drafter on Nano, fallback on Super)
