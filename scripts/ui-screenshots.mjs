// SPDX-License-Identifier: Apache-2.0
// DP-UI WU-UI-09 (accessibility + responsive audit) and WU-UI-10 (20-file
// screenshot set: per-screen light/dark + craft set + brandmark contact sheet).
// Drives the real product in replay mode with the ticket id pinned to
// e2e-example. Usage:
//   MERGEREADY_MODE=replay node scripts/ui-screenshots.mjs --audit
//   MERGEREADY_MODE=replay node scripts/ui-screenshots.mjs
// Screenshots land in design_documents/ui-screenshots/ (ships, never ignored).
// Set GOLDEN_CACHE_DIR_REUSE to skip re-seeding (saves ~40s).
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";

function killTree(proc) {
  try {
    if (proc && typeof proc.pid === "number") {
      spawnSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
    }
  } catch { /* best effort */ }
  try { proc.kill(); } catch { /* already dead */ }
}

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
  const reuse = process.env["GOLDEN_CACHE_DIR_REUSE"];
  if (reuse) return reuse;
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
        // Repo root (NOT the fixture repo): App.tsx sends
        // snapshotDir="examples/mergeready/fixture-repo", which must resolve to
        // the real fixture files — the same snapshot the seed used — for the
        // planner golden-cache keys to hit and the matrix to fill.
        API_CWD: ".",
      },
      stdio: "ignore",
      shell: true,
    }),
  );
  const baseURL = `http://127.0.0.1:${apiPort}`;
  await waitHealth(`${baseURL}/healthz`);
  return { baseURL, close: () => procs.forEach((p) => killTree(p)) };
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
  const shotEl = async (page, selector, name) => {
    const p = join(SHOTS, name);
    await page.locator(selector).first().screenshot({ path: p });
    saved.push(p);
    console.log(p);
  };
  const { default: def, tiny, degraded } = servers;

  // Group A — idle page: idle pair, invalid form, app bar pair, explainer open.
  const groupA = (async () => {
    const { page, close } = await newPage(browser, def, { width: 1440, height: 900, theme: "dark" });
    await page.goto(`${def}/`);
    await page.getByRole("button", { name: "Start run" }).waitFor();
    await shot(page, "01-idle-dark.png");
    await shotEl(page, ".mr-appbar", "15-appbar-dark.png");
    await page.getByRole("switch").click();
    await shot(page, "02-idle-light.png");
    await shotEl(page, ".mr-appbar", "16-appbar-light.png");
    await page.getByRole("button", { name: "How Merge-Ready works" }).click();
    await page.locator("[data-app-explainer]").waitFor({ timeout: 15000 });
    await shot(page, "17-explainer-open.png");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Start run" }).click();
    await page.getByText("Ticket title is required.").waitFor({ timeout: 15000 });
    await shot(page, "12-invalid-form.png");
    await close();
  })();

  // Group B — running pair + PR + ledger (dark), PR (light).
  const groupB = (async () => {
    for (const [theme, runShot, prShot, ledgerShot] of [
      ["dark", "03-running-dark.png", "07-pr-dark.png", "09-ledger-dark.png"],
      ["light", "04-running-light.png", "08-pr-light.png", null],
    ]) {
      const { page, close } = await newPage(browser, def, { width: 1440, height: 900, theme });
      const traceId = await startRun(page, def);
      const line = page.getByTestId("work-indicator-text");
      await line.waitFor({ timeout: 30000 });
      if ((((await line.textContent()) ?? "").trim().length) === 0) fail("empty WorkIndicator text");
      await shot(page, runShot);
      await waitForStep(def, traceId, "pr");
      await page.getByRole("region", { name: "Pull request" }).scrollIntoViewIfNeeded();
      await shot(page, prShot);
      if (ledgerShot) {
        await page.getByRole("region", { name: "Ledger" }).scrollIntoViewIfNeeded();
        await shot(page, ledgerShot);
      }
      await close();
    }
  })();

  // Group C — matrix pair at 1920x1080 + help popover + metric widest.
  const groupC = (async () => {
    for (const [theme, name] of [["dark", "05-matrix-dark.png"], ["light", "06-matrix-light.png"]]) {
      const { page, close } = await newPage(browser, def, { width: 1920, height: 1080, theme });
      const traceId = await startRun(page, def);
      await waitForStep(def, traceId, "pr");
      const matrix = page.getByRole("table", { name: "Sandbox matrix" });
      await matrix.getByText("rolled back").first().waitFor({ timeout: 30000 });
      await matrix.getByText("pass").first().waitFor({ timeout: 30000 });
      await matrix.scrollIntoViewIfNeeded();
      await shot(page, name);
      if (theme === "light") {
        await page.locator("[data-help-for]").first().click();
        await page.locator(".mr-help-pop").waitFor({ timeout: 15000 });
        await shot(page, "18-help-popover.png");
        await page.keyboard.press("Escape");
        await page.evaluate(() => {
          document.querySelectorAll(".metric__value").forEach((el) => {
            const t = el.textContent || "";
            if (t.includes("/")) el.textContent = "999 999 / 999 999";
            else if (t.includes("$")) el.textContent = "$1 284.6012";
            else if (/^\d/.test(t.trim())) el.textContent = "1 284.0s";
          });
        });
        const wrapped = await page.evaluate(() =>
          Array.from(document.querySelectorAll(".metric__value")).filter(
            (el) => el.getClientRects().length > 1).length);
        if (wrapped !== 0) fail(`${wrapped} metric values wrap at widest plausible value`);
        await page.getByRole("region", { name: "Ledger" }).scrollIntoViewIfNeeded();
        await shot(page, "19-metric-widest.png");
      }
      await close();
    }
  })();

  // Group D — tiny-budget ledger + degraded banner (independent servers).
  const groupD = (async () => {
    const { page: tp, close: tclose } = await newPage(browser, tiny, { width: 1440, height: 900, theme: "dark" });
    const tTrace = await startRun(tp, tiny);
    await waitForStep(tiny, tTrace, "pr");
    await tp.getByText(/downgraded/).first().waitFor({ timeout: 30000 });
    await tp.getByRole("region", { name: "Ledger" }).scrollIntoViewIfNeeded();
    await shot(tp, "10-ledger-tiny-budget.png");
    await tclose();
    const { page: dp, close: dclose } = await newPage(browser, degraded, { width: 1440, height: 900, theme: "dark" });
    const dTrace = await startRun(dp, degraded);
    await waitForStep(degraded, dTrace, "pr");
    await dp.getByText("Running in degraded mode").waitFor({ timeout: 60000 });
    await shot(dp, "11-degraded.png");
    await dclose();
  })();

  // Group E — mobile pair + brandmark contact sheet (no runs).
  const groupE = (async () => {
    for (const [theme, name] of [["dark", "13-mobile-dark.png"], ["light", "14-mobile-light.png"]]) {
      const { page, close } = await newPage(browser, def, { width: 390, height: 844, theme });
      await page.goto(`${def}/`);
      await page.getByRole("button", { name: "Start run" }).waitFor();
      await shot(page, name);
      await close();
    }
    const { page, close } = await newPage(browser, def, { width: 900, height: 420, theme: "light" });
    const mark = readFileSync(join(ROOT, "public", "brand", "mark.svg"), "utf8")
      .replace(/<svg[^>]*>/, "")
      .replace(/<\/svg>\s*$/, "");
    const cells = [16, 24, 32, 64, 128].map((s) =>
      `<div style="display:flex;flex-direction:column;align-items:center;gap:8px">` +
      `<svg width="${s}" height="${s}" viewBox="0 0 32 32" fill="none" style="color:#5B4BD6">${mark}</svg>` +
      `<span style="font:12px sans-serif;color:#59626E">${s}px</span></div>`).join("");
    await page.setContent(
      `<html><body style="margin:0;background:#F6F7F9"><div style="display:flex;gap:48px;align-items:flex-end;padding:48px">` +
      cells + `</div></body></html>`);
    await page.locator("div").first().screenshot({ path: join(SHOTS, "20-mark-contact.png") });
    saved.push(join(SHOTS, "20-mark-contact.png"));
    console.log(join(SHOTS, "20-mark-contact.png"));
    await close();
  })();

  await Promise.all([groupA, groupB, groupC, groupD, groupE]);
  console.log("screenshots: 20 files");
  if (saved.length !== 20) fail(`expected 20 files, saved ${saved.length}`);
}

const goldenDir = seedGolden();
const closers = [];
const servers = {};
try {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch();
  closers.push(() => browser.close());
  const keys = AUDIT ? ["default"] : ["default", "tiny", "degraded"];
  const variants = { default: "default", tiny: "tiny-budget", degraded: "degraded" };
  await Promise.all(keys.map(async (key) => {
    const s = await boot(goldenDir, variants[key]);
    closers.push(s.close);
    servers[key] = s.baseURL;
  }));
  if (AUDIT) await runAudit(browser, servers);
  else await capture(browser, servers);
} finally {
  for (const c of closers.reverse()) {
    try { await c(); } catch {}
  }
}
