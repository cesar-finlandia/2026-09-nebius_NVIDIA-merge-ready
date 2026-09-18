// SPDX-License-Identifier: Apache-2.0
// Harness fixture per DP-E2E-BROWSER-TESTING §5 A1: ephemeral replay servers
// (sidecar fake + API over the fixture repo + seeded TF golden cache), the
// console gate, the dark-theme seed, and the ticket-id pin. No waitForTimeout.
import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";

export const CONSOLE_ALLOWLIST: RegExp[] = [
  /ResizeObserver loop completed with undelivered notifications/, // browser-internal, no product cause
  /Failed to load resource: .*\/favicon\.ico/, // no favicon is shipped
];

export interface AppFixture {
  baseURL: string; // an ephemeral local server, or process.env.BASE_URL when set
  consoleErrors: string[]; // page console.error + pageerror, allowlist-filtered
  mode: "live" | "replay";
}

export type ServerVariant = "default" | "tiny-budget" | "degraded" | "refused";

// Per-variant run budget. The sidecar reads MERGEREADY_RUN_BUDGET_USD from its
// OWN env (cost_routes._budgets), so the budget must be set on BOTH the
// sidecar and the API envs — setting it on the API alone never flips policy.
// tiny-budget (0.0006): full 26-envelope run, redrafter ultra→nano (uc05).
// refused (0.000001): planner spend alone exceeds the cap, both steps rejected
// before any draft — the real no-green run (uc03).
function budgetFor(variant: ServerVariant): string | null {
  if (variant === "tiny-budget") return "0.0006";
  if (variant === "refused") return "0.000001";
  return null;
}

export interface ServerHandle {
  baseURL: string;
  variant: ServerVariant;
  remote: boolean;
}

const ROOT = process.cwd();
const REMOTE = process.env["BASE_URL"] ?? "";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      const port = typeof addr === "object" && addr !== null ? addr.port : 0;
      s.close(() => resolve(port));
    });
  });
}

let sharedGoldenDir: string | null = null;

function ensureSeeded(): string {
  if (sharedGoldenDir) return sharedGoldenDir;
  const dir = mkdtempSync(join(tmpdir(), "mr-e2e-golden-"));
  const seed = spawnSync("npx.cmd", ["vite-node", "scripts/seed-replay-cache.ts"], {
    cwd: ROOT,
    env: {
      ...process.env,
      GOLDEN_CACHE_DIR: dir,
      SNAPSHOT_DIR: "examples/mergeready/fixture-repo",
      TICKET_ID: "e2e-example",
      MERGEREADY_MODE: "replay",
    },
    encoding: "utf8",
    timeout: 240000,
    shell: true,
  });
  if (seed.status !== 0) {
    throw new Error("seed-replay-cache failed: " + String(seed.stdout + seed.stderr).slice(-2000));
  }
  sharedGoldenDir = dir;
  return dir;
}

async function waitHealth(url: string): Promise<Record<string, unknown>> {
  const deadline = Date.now() + 90000;
  let last = "";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      last = await res.text();
      if (res.ok) return JSON.parse(last) as Record<string, unknown>;
    } catch {
      last = "connect-failed";
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`server not healthy in 90s at ${url} last=${last.slice(0, 500)}`);
}

async function launchServer(variant: ServerVariant): Promise<{ handle: ServerHandle; procs: ChildProcess[] }> {
  if (REMOTE !== "") {
    return { handle: { baseURL: REMOTE, variant, remote: true }, procs: [] };
  }
  const goldenDir = ensureSeeded();
  const sidecarPort = await freePort();
  const apiPort = await freePort();
  const deadPort = variant === "degraded" ? await freePort() : 0;
  const procs: ChildProcess[] = [];
  if (variant !== "degraded") {
    const budget = budgetFor(variant);
    const scEnv = {
      ...process.env,
      MERGEREADY_MODE: "replay",
      MERGEREADY_SIDECAR_URL: `http://127.0.0.1:${sidecarPort}`,
      SANDBOX_ADAPTER: "fake",
      GOLDEN_CACHE_DIR: goldenDir,
      // fix-log F5/F8: the sidecar owns policy budgets, so the value goes
      // here AND on the API env below.
      ...(budget !== null ? { MERGEREADY_RUN_BUDGET_USD: budget } : {}),
    };
    procs.push(spawn("python", ["-m", "src.mergeready.sidecar"], { cwd: ROOT, env: scEnv, stdio: "ignore" }));
  }
  const apiBudget = budgetFor(variant);
  const apiEnv = {
    ...process.env,
    MERGEREADY_MODE: "replay",
    MERGEREADY_SIDECAR_URL:
      variant === "degraded" ? `http://127.0.0.1:${deadPort}` : `http://127.0.0.1:${sidecarPort}`,
    SANDBOX_ADAPTER: "fake",
    GOLDEN_CACHE_DIR: goldenDir,
    ...(apiBudget !== null ? { MERGEREADY_RUN_BUDGET_USD: apiBudget } : {}),
    API_PORT: String(apiPort),
    API_CWD: "examples/mergeready/fixture-repo",
  };
  procs.push(
    spawn("npx.cmd", ["vite-node", "scripts/serve-api.ts"], {
      cwd: ROOT,
      env: apiEnv,
      stdio: "ignore",
      shell: true,
    }),
  );
  const baseURL = `http://127.0.0.1:${apiPort}`;
  const health = await waitHealth(`${baseURL}/health`);
  if (health["mode"] !== "replay") throw new Error("expected replay mode, got " + JSON.stringify(health));
  return { handle: { baseURL, variant, remote: false }, procs };
}

async function serverWorkerFixture(
  variant: ServerVariant,
  use: (handle: ServerHandle) => Promise<void>,
): Promise<void> {
  const { handle, procs } = await launchServer(variant);
  try {
    await use(handle);
  } finally {
    for (const p of procs) {
      try {
        p.kill();
      } catch {
        // already gone
      }
    }
  }
}

// Standalone boot for suites that own their lifecycle (smoke.spec.ts,
// scripts/ui-screenshots.mjs via a tiny driver): always local, never REMOTE.
export async function bootLocal(variant: ServerVariant): Promise<{ baseURL: string; close: () => void }> {
  const goldenDir = ensureSeeded();
  const sidecarPort = await freePort();
  const apiPort = await freePort();
  const deadPort = variant === "degraded" ? await freePort() : 0;
  const procs: ChildProcess[] = [];
  const budget = budgetFor(variant);
  if (variant !== "degraded") {
    procs.push(
      spawn("python", ["-m", "src.mergeready.sidecar"], {
        cwd: ROOT,
        env: {
          ...process.env,
          MERGEREADY_MODE: "replay",
          MERGEREADY_SIDECAR_URL: `http://127.0.0.1:${sidecarPort}`,
          SANDBOX_ADAPTER: "fake",
          GOLDEN_CACHE_DIR: goldenDir,
          ...(budget !== null ? { MERGEREADY_RUN_BUDGET_USD: budget } : {}),
        },
        stdio: "ignore",
      }),
    );
  }
  procs.push(
    spawn("npx.cmd", ["vite-node", "scripts/serve-api.ts"], {
      cwd: ROOT,
      env: {
        ...process.env,
        MERGEREADY_MODE: "replay",
        MERGEREADY_SIDECAR_URL:
          variant === "degraded" ? `http://127.0.0.1:${deadPort}` : `http://127.0.0.1:${sidecarPort}`,
        SANDBOX_ADAPTER: "fake",
        GOLDEN_CACHE_DIR: goldenDir,
        ...(budget !== null ? { MERGEREADY_RUN_BUDGET_USD: budget } : {}),
        API_PORT: String(apiPort),
        API_CWD: "examples/mergeready/fixture-repo",
      },
      stdio: "ignore",
      shell: true,
    }),
  );
  const baseURL = `http://127.0.0.1:${apiPort}`;
  await waitHealth(`${baseURL}/health`);
  return {
    baseURL,
    close() {
      for (const p of procs) {
        try {
          p.kill();
        } catch {
          // already gone
        }
      }
    },
  };
}

export const test = base.extend<{
  consoleErrors: string[];
  defaultServer: ServerHandle;
  tinyServer: ServerHandle;
  degradedServer: ServerHandle;
  refusedServer: ServerHandle;
  _consoleGate: void;
}>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      const anyErr = err as Error | null;
      errors.push(String((anyErr && anyErr.stack) || err));
    });
    await use(errors);
  },
  defaultServer: [async ({}, use) => serverWorkerFixture("default", use), { scope: "worker" }],
  tinyServer: [async ({}, use) => serverWorkerFixture("tiny-budget", use), { scope: "worker" }],
  degradedServer: [async ({}, use) => serverWorkerFixture("degraded", use), { scope: "worker" }],
  refusedServer: [async ({}, use) => serverWorkerFixture("refused", use), { scope: "worker" }],
  // Console gate (A1.5): runs after every scenario using this object.
  _consoleGate: [
    async ({ consoleErrors }, use, testInfo) => {
      await use();
      const bad = consoleErrors.filter((m) => !CONSOLE_ALLOWLIST.some((re) => re.test(m)));
      expect(bad, `unexpected console errors in ${testInfo.title}`).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

// Pin the ticket id (App mints a random id per Start click) so the seeded
// golden cache hits, load the example, and start the run. Returns trace_id.
export async function runExampleTicket(
  page: Page,
  server: ServerHandle,
  opts?: { theme?: "dark" | null },
): Promise<string> {
  // Explicit null means "do not seed" (uc11 owns the toggle); only an
  // omitted option defaults to dark. `?? "dark"` would defeat null.
  const theme = opts?.theme === undefined ? "dark" : opts.theme;
  if (theme !== null) {
    await page.addInitScript(() => localStorage.setItem("mr-theme", "dark"));
  }
  await page.route("**/runs", async (route) => {
    try {
      const data = route.request().postDataJSON() as { ticket?: { id?: string } } | null;
      if (data && data.ticket) data.ticket.id = "e2e-example";
      await route.continue({ postData: JSON.stringify(data) });
    } catch {
      await route.continue();
    }
  });
  await page.goto(`${server.baseURL}/`);
  await expect(page.getByRole("button", { name: "Start run" })).toBeVisible();
  await page.getByRole("button", { name: "Load example ticket" }).click();
  for (const name of ["Ticket title", "Ticket body", "Repo URL", "Base branch"]) {
    await expect(page.getByLabel(name)).not.toHaveValue("");
  }
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/runs") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Start run" }).click(),
  ]);
  const body = (await resp.json()) as { trace_id?: unknown };
  expect(typeof body.trace_id, "POST /runs returns trace_id").toBe("string");
  return body.trace_id as string;
}
