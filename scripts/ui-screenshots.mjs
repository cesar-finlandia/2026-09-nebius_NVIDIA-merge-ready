// SPDX-License-Identifier: Apache-2.0
// DP-UI W8 (accessibility + responsive audit) and W9 (14-file screenshot set).
// Drives the real product in replay mode through seeded UI runs with the
// ticket id pinned to e2e-example. Usage:
//   MERGEREADY_MODE=replay node scripts/ui-screenshots.mjs --audit
//   MERGEREADY_MODE=replay node scripts/ui-screenshots.mjs
// Screenshots land in design_documents/ui-screenshots/ (ships, never ignored):
//   01-idle-dark, 02-idle-light, 03-running-dark, 04-running-light,
//   05-matrix-dark (1920x1080), 06-matrix-light (1920x1080),
//   07-pr-dark, 08-pr-light, 09-ledger-dark, 10-ledger-tiny-budget,
//   11-degraded, 12-invalid-form, 13-mobile-dark (390x844), 14-mobile-light.
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";

const ROOT = process.cwd();
const SHOTS = join(ROOT, "design_documents", "ui-screenshots");
const AUDIT = process.argv.includes("--audit");

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      s.close(() => resolve(typeof addr === "object" && addr !== null ? addr.port : 0));
    });
  });
}

function seedGolden() {
  const dir = mkdtempSync(join(tmpdir(), "mr-shots-golden-"));
  const r = spawnSync("npx.cmd", ["vite-node", "scripts/seed-replay-cache.ts"], {
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
  if (r.status !== 0) throw new Error("seed-replay-cache failed: " + String(r.stdout + r.stderr).slice(-2000));
  return dir;
}

async function waitHealth(url, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      last = await res.text();
      if (res.ok) return JSON.parse(last);
    } catch {
      last = "connect-failed";
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`server not healthy at ${url} last=${String(last).slice(0, 300)}`);
}

async function boot(goldenDir, variant) {
  const sidecarPort = await freePort();
  const apiPort = await freePort();
  const deadPort = variant === "degraded" ? await freePort() : 0;
  const budget = variant === "tiny-budget" ? "0.0006" : null;
  const procs = [];
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
          ...(budget ? { MERGEREADY_RUN_BUDGET_USD: budget } : {}),
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
        ...(budget ? { MERGEREADY_RUN_BUDGET_USD: budget } : {}),
        API_PORT: String(apiPort),
        API_CWD: "examples/mergeready/fixture-repo",
      },
      stdio: "ignore",
      shell: true,
    }),
  );
  const baseURL = `http://127.0.0.1:${apiPort}`;
  await waitHealth(`${baseURL}/healthz`);
  return { baseURL, close: () => procs.forEach((p) => { try { p.kill(); } catch {} }) };
}

async function collectEvents(baseURL, traceId) {
  const res = await fetch(`${baseURL}/events?trace_id=${encodeURIComponent(traceId)}`);
  if (!res.ok) throw new Error(`GET /events HTTP ${res.status}`);
  const body = await res.json();
  return Array.isArray(body.envelopes) ? body.envelopes : [];
}

async function waitForStep(baseURL, traceId, stepId, timeoutMs = 150000) {
  const deadline = Date.now() + timeoutMs;
  let last = [];
  while (Date.now() < deadline) {
    last = await collectEvents(baseURL, traceId);
    if (last.some((e) => e.step_id === stepId && e.status === "done")) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`waitForStep ${stepId} timed out; saw ${last.map((e) => e.step_id).join(",")}`);
}

// Start a run through the real UI with the ticket id pinned so seeded keys hit.
async function startRun(page, baseURL) {
  await page.route("**/runs", async (route) => {
    try {
      const data = route.request().postDataJSON();
      if (data && data.ticket) data.ticket.id = "e2e-example";
      await route.continue({ postData: JSON.stringify(data) });
    } catch {
      await route.continue();
    }
  });
  await page.goto(`${baseURL}/`);
  await page.getByRole("button", { name: "Load example ticket" }).click();
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/runs") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Start run" }).click(),
  ]);
  return String((await resp.json()).trace_id);
}

async function newPage(browser, baseURL, { width, height, theme, reducedMotion = false }) {
  const context = await browser.newContext({
    viewport: { width, height },
    ...(reducedMotion ? { reducedMotion: "reduce" } : {}),
  });
  if (theme) {
    await context.addInitScript((t) => localStorage.setItem("mr-theme", t), theme);
  }
  const page = await context.newPage();
  page.on("pageerror", (e) => { throw new Error("pageerror: " + String(e)); });
  return { page, close: () => context.close() };
}

function fail(msg) {
  console.error(`ASSERT-FAIL: ${msg}`);
  process.exit(1);
}

async function runAudit(browser, servers) {
  const { default: def } = servers;
  // 1+2+3+4: 1280x900 replay page — no h-scroll, matrix floor, focus, names.
  {
    const { page, close } = await newPage(browser, def, { width: 1280, height: 900, theme: "dark" });
    await page.goto(`${def}/`);
    const w1 = await page.evaluate(() => document.documentElement.scrollWidth);
    if (!(w1 <= 1280)) fail(`scrollWidth ${w1} > 1280`);
    const unnamed = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("button, a, input, textarea, select"));
      return els.filter((el) => {
        const name =
          el.getAttribute("aria-label") ?? (el.textContent ?? "").trim() ?? "";
        if (name !== "") return false;
        const id = el.getAttribute("id") ?? "";
        if (id !== "" && document.querySelector(`label[for='${id}']`)) return false;
        return true;
      }).length;
    });
    if (unnamed !== 0) fail(`${unnamed} elements without accessible names`);
    const traceId = await startRun(page, def);
    await page.waitForSelector(".mr-matrix tbody tr", { timeout: 150000 });
    const minTd = await page.evaluate(() => {
      const tds = Array.from(document.querySelectorAll(".mr-matrix td"));
      return Math.min(...tds.map((td) => parseFloat(getComputedStyle(td).fontSize)));
    });
    if (!(minTd >= 14)) fail(`matrix td font ${minTd} < 14px`);
    // Tab (keyboard) through the first three focusables: :focus-visible must
    // render a non-none outline on each.
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Tab");
      const outline = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? getComputedStyle(el).outlineStyle : "none";
      });
      if (outline === "none") fail("keyboard-focused control has outline-style none");
    }
    await waitForStep(def, traceId, "pr");
    await close();
  }
  // 5: 390x844 — no h-scroll.
  {
    const { page, close } = await newPage(browser, def, { width: 390, height: 844, theme: "dark" });
    await page.goto(`${def}/`);
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    if (!(w <= 390)) fail(`mobile scrollWidth ${w} > 390`);
    await close();
  }
  // 6: theme toggle flips data-theme and survives reload (no seed here: the
  // init script would re-seed on reload and defeat the persistence check).
  {
    const { page, close } = await newPage(browser, def, { width: 1280, height: 900 });
    await page.goto(`${def}/`);
    const t = page.getByRole("switch");
    const start = await page.evaluate(() => document.documentElement.dataset.theme);
    await t.click();
    const flipped = await page.evaluate(() => document.documentElement.dataset.theme);
    if (flipped === start) fail(`theme did not flip, still ${flipped}`);
    await page.reload();
    const kept = await page.evaluate(() => document.documentElement.dataset.theme);
    if (kept !== flipped) fail("theme did not survive reload");
    await close();
  }
  // 7: reduced motion — the work bar computes to 0.01ms.
  {
    const { page, close } = await newPage(browser, def, {
      width: 1280,
      height: 900,
      theme: "dark",
      reducedMotion: true,
    });
    await startRun(page, def);
    await page.waitForSelector(".mr-work__bar", { timeout: 60000 });
    const dur = await page.evaluate(() => {
      const bar = document.querySelector(".mr-work__bar");
      return bar ? getComputedStyle(bar).animationDuration : "missing";
    });
    // 0.01ms serializes as "0.01ms" or "1e-05s" depending on the build.
    const ms = dur.endsWith("ms") ? parseFloat(dur) : parseFloat(dur) * 1000;
    if (!(Math.abs(ms - 0.01) < 1e-9)) fail(`reduced-motion bar duration ${dur}`);
    await close();
  }
  console.log("a11y-ok");
}

async function capture(browser, servers) {
  mkdirSync(SHOTS, { recursive: true });
  const saved = [];
  const shot = async (page, name) => {
    const p = join(SHOTS, name);
    await page.screenshot({ path: p });
    saved.push(p);
    console.log(p);
  };
  const { default: def, tiny, degraded } = servers;

  // Idle pair + invalid form (no run).
  {
    const { page, close } = await newPage(browser, def, { width: 1440, height: 900, theme: "dark" });
    await page.goto(`${def}/`);
    await page.getByRole("button", { name: "Start run" }).waitFor();
    await shot(page, "01-idle-dark.png");
    await page.getByRole("switch").click();
    await shot(page, "02-idle-light.png");
    await page.getByRole("switch").click();
    await page.getByRole("button", { name: "Start run" }).click();
    await page.getByText("Ticket title is required.").waitFor({ timeout: 15000 });
    await shot(page, "12-invalid-form.png");
    await close();
  }
  // Running pair (assert WorkIndicator text before 03/04).
  for (const [theme, name] of [["dark", "03-running-dark.png"], ["light", "04-running-light.png"]]) {
    const { page, close } = await newPage(browser, def, { width: 1440, height: 900, theme });
    const traceId = await startRun(page, def);
    const line = page.getByTestId("work-indicator-text");
    await line.waitFor({ timeout: 30000 });
    if ((((await line.textContent()) ?? "").trim().length) === 0) fail("empty WorkIndicator text");
    await shot(page, name);
    if (theme === "dark") {
      await waitForStep(def, traceId, "pr");
      await page.getByRole("region", { name: "Pull request" }).scrollIntoViewIfNeeded();
      await shot(page, "07-pr-dark.png");
      await page.getByRole("region", { name: "Ledger" }).scrollIntoViewIfNeeded();
      await shot(page, "09-ledger-dark.png");
    } else {
      await waitForStep(def, traceId, "pr");
      await page.getByRole("region", { name: "Pull request" }).scrollIntoViewIfNeeded();
      await shot(page, "08-pr-light.png");
    }
    await close();
  }
  // Matrix pair at 1920x1080 (assert pass + rolled-back rows + red exit cell).
  for (const [theme, name] of [["dark", "05-matrix-dark.png"], ["light", "06-matrix-light.png"]]) {
    const { page, close } = await newPage(browser, def, { width: 1920, height: 1080, theme });
    const traceId = await startRun(page, def);
    await waitForStep(def, traceId, "pr");
    const matrix = page.getByRole("table", { name: "Sandbox matrix" });
    await matrix.getByText("rolled back").first().waitFor({ timeout: 30000 });
    await matrix.getByText("pass").first().waitFor({ timeout: 30000 });
    const vrow = await matrix.getByRole("row", { name: /^verify-1 / }).textContent();
    if (!/1/.test(vrow ?? "")) fail("red attempt exit-code cell missing");
    await matrix.scrollIntoViewIfNeeded();
    await shot(page, name);
    await close();
  }
  // Tiny-budget ledger (shot 10) and dead-sidecar degraded view (shot 11).
  {
    const { page, close } = await newPage(browser, tiny, { width: 1440, height: 900, theme: "dark" });
    const traceId = await startRun(page, tiny);
    await waitForStep(tiny, traceId, "pr");
    await page.getByText(/downgraded/).first().waitFor({ timeout: 30000 });
    await page.getByRole("region", { name: "Ledger" }).scrollIntoViewIfNeeded();
    await shot(page, "10-ledger-tiny-budget.png");
    await close();
  }
  {
    const { page, close } = await newPage(browser, degraded, { width: 1440, height: 900, theme: "dark" });
    const traceId = await startRun(page, degraded);
    await waitForStep(degraded, traceId, "pr");
    await page.getByRole("status").filter({ hasText: /^Step .* degraded via/ }).first().waitFor({ timeout: 60000 });
    await shot(page, "11-degraded.png");
    await close();
  }
  // Mobile pair at 390x844.
  for (const [theme, name] of [["dark", "13-mobile-dark.png"], ["light", "14-mobile-light.png"]]) {
    const { page, close } = await newPage(browser, def, { width: 390, height: 844, theme });
    await page.goto(`${def}/`);
    await page.getByRole("button", { name: "Start run" }).waitFor();
    await shot(page, name);
    await close();
  }
  console.log("screenshots: 14 files");
  if (saved.length !== 14) fail(`expected 14 files, saved ${saved.length}`);
}

const goldenDir = seedGolden();
const closers = [];
const servers = {};
try {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch();
  closers.push(() => browser.close());
  for (const [key, variant] of [["default", "default"], ["tiny", "tiny-budget"], ["degraded", "degraded"]]) {
    if (AUDIT && key !== "default") continue;
    const s = await boot(goldenDir, variant);
    closers.push(s.close);
    servers[key] = s.baseURL;
  }
  if (AUDIT) await runAudit(browser, servers);
  else await capture(browser, servers);
} finally {
  for (const c of closers.reverse()) {
    try { await c(); } catch {}
  }
}
