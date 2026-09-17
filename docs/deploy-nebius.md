# Deploy runbook — Merge-Ready on Nebius AI Cloud Serverless Endpoints

> Files only (DP-API W7). No deploy has been run from this document yet; the
> public URL is unwritten until the smoke gate below goes green.

## 0. Prerequisites

1. A Nebius AI Cloud project with billing enabled and enough credits for one
   always-on container through judging.
2. A container registry you can push to (Nebius registry or Docker Hub).
3. These secrets ready (never committed — see `docs/submission-checklist.md`):
   `NEBIUS_API_KEY`, `TAVILY_API_KEY`, `CONTREE_PROFILE`, and `GITHUB_TOKEN`
   only when `MERGEREADY_PR_MODE=live`.

## 1. Create the Serverless Endpoint

1. Create a Serverless Endpoint from your container image (step 3).
2. Expose container port **8080** (`docker/start.sh` listens on `$PORT`,
   default 8080).
3. Set **min instances 1** (never scale-to-zero: a cold start blanks the
   console and breaches NFR-07; the UI shows its connecting state until the
   first envelope).
4. Configure the environment (DP-API §6 — full table):

   | Key | Value |
   |---|---|
   | `NEBIUS_API_KEY` | live Token Factory auth (required in `live`) |
   | `NEBIUS_BASE_URL` | `https://api.tokenfactory.nebius.com/v1/` |
   | `TAVILY_API_KEY` | live grounding auth (required in `live`) |
   | `CONTREE_PROFILE` | sandbox profile selector (required in `live`) |
   | `MERGEREADY_MODE` | `live` |
   | `MERGEREADY_SIDECAR_URL` | `http://127.0.0.1:8787` (in-container sidecar) |
   | `MERGEREADY_MAX_STEPS` | `6` |
   | `MERGEREADY_BUDGET_USD` | `50` |
   | `MERGEREADY_RUN_BUDGET_USD` | `0.75` |
   | `MERGEREADY_JOBS_THRESHOLD` | `4` |
   | `MERGEREADY_PR_MODE` | `dry` (use `live` only with `GITHUB_TOKEN`) |
   | `GITHUB_TOKEN` | PR publish auth (required iff `MERGEREADY_PR_MODE=live`) |
   | `TRANSPORT` | chassis default (unset) |
   | `THEME` | chassis default (unset) |
   | `API_BASE` | chassis default (unset) |
   | `DEPLOY_PROVIDER` | chassis default (unset — secondary mirror only, see §5) |

## 2. Build and push the container

1. `docker build -t <registry>/mergeready:latest .` (Node 20 + Python 3.11,
   `pip install contree_sdk`, `npm run build:ui`, entry `sh docker/start.sh`).
2. `docker push <registry>/mergeready:latest`.

## 3. Deploy and verify

1. Point the endpoint at the pushed image and wait for healthy.
2. Run `npm run deploy:verify`.
3. Run `curl -fsS $DEMO_URL/healthz | jq -e '.ok == true'` with
   `DEMO_URL=<endpoint url>`.
4. Gate the URL on the browser smoke suite (DP-E2E-BROWSER-TESTING §5 A5):
   `BASE_URL=<endpoint url> npx playwright test -c e2e/playwright.config.ts smoke`
   must print `smoke-ok <url> <marker> <n>`. On red the deploy fails — the URL
   is not recorded anywhere.
5. Write the green public URL into `docs/submission-checklist.md`.

## 4. Live-and-free rule

The app is live and free through judging: no login, no paywall. If auth is
unavoidable, put credentials in the Devpost form field — never in the repo.

## 5. Provider rule

The primary graded URL is the Nebius Serverless Endpoint. The chassis adapter
(`DEPLOY_PROVIDER`, `scripts/deploy.ts`) is a SECONDARY mirror only.

## 6. Cold-start rule

Min instances 1. `GET /stream` sends a `started` envelope immediately on
connect plus 15 s heartbeats; the static shell renders its connecting state
until the first envelope arrives.
