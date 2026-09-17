# E2E browser suite (DP-E2E-BROWSER-TESTING, C-30)

Real-browser proof of every use case, driven by Playwright against the app
served by `createServer` (static `dist/` + SSE). Replay mode needs no
credentials and no network; each worker fixture boots its own sidecar (fake
adapter) + API over `examples/mergeready/fixture-repo` with a seeded TF golden
cache, and pins the ticket id to `e2e-example` via `**/runs` interception.

## Run

```sh
npx playwright test -c e2e/playwright.config.ts
```

One scenario (example: the harness validator):

```sh
npx playwright test -c e2e/playwright.config.ts uc06
```

Smoke suite against a deployed URL (DP-API deploy gate, DP-SCRIPT fact harvest,
DP-LIVE-RUN-AND-VIDEO health gate — the only suite re-run remotely):

```sh
BASE_URL=<endpoint url> npx playwright test -c e2e/playwright.config.ts smoke
```

Rules: `retries: 0`, `workers: 1`, no `waitForTimeout` — scenarios wait on
`waitForStep` (polls `GET /events`) or DOM conditions. Evidence lands in
`e2e/artifacts/` (ignored). `BASE_URL` set means: drive remote, start nothing.
