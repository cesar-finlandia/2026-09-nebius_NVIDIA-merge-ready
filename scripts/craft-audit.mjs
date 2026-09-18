// SPDX-License-Identifier: Apache-2.0
// DP-UI WU-UI-03..07 + WU-UI-10: craft checks against the rendered page.
// Usage:
//   MERGEREADY_MODE=replay node scripts/craft-audit.mjs --checks surfaces,roles --url <base>
//   MERGEREADY_MODE=replay node scripts/craft-audit.mjs --checks metrics --url <base> --widest
//   MERGEREADY_MODE=replay node scripts/craft-audit.mjs --checks messages --url <base> --state degraded
//   MERGEREADY_MODE=replay node scripts/craft-audit.mjs --checks help --url <base>
//   MERGEREADY_MODE=replay node scripts/craft-audit.mjs --checks content,font --url <base>
//   MERGEREADY_MODE=replay node scripts/craft-audit.mjs --all --url <base>
// Boots its own replay servers when --url is unreachable, so the check is
// self-contained. Prints one summary line per check group and exits non-zero
// on any violation.
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const ALL = args.includes("--all");
const checksArg = args.includes("--checks") ? args[args.indexOf("--checks") + 1] ?? "" : "";
const CHECKS = new Set(ALL ? ["all"] : checksArg.split(",").map((s) => s.trim()).filter(Boolean));
const urlArg = args.includes("--url") ? args[args.indexOf("--url") + 1] : null;
const WIDEST = args.includes("--widest");

function killTree(proc) {
  // p.kill() alone orphans grandchildren on Windows (cmd wrapper dies,
  // vite-node/python live on) and the harness flags the run. Kill the tree.
  try {
    if (proc && typeof proc.pid === "number") {
      spawnSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
    }
  } catch { /* best effort */ }
  try { proc.kill(); } catch { /* already dead */ }
}

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
  // Reuse a pre-seeded dir when provided (saves ~40s per invocation).
  const reuse = process.env["GOLDEN_CACHE_DIR_REUSE"];
  if (reuse) return reuse;  const dir = mkdtempSync(join(tmpdir(), "mr-craft-golden-"));
  const r = spawnSync("npx.cmd", ["vite-node", "scripts/seed-replay-cache.ts"], {
    cwd: ROOT,
    env: { ...process.env, GOLDEN_CACHE_DIR: dir, SNAPSHOT_DIR: "examples/mergeready/fixture-repo", TICKET_ID: "e2e-example", MERGEREADY_MODE: "replay" },
    encoding: "utf8",
    timeout: 240000,
    shell: true,
  });
  if (r.status !== 0) throw new Error("seed-replay-cache failed: " + String(r.stdout + r.stderr).slice(-2000));
  return dir;
}

async function waitHealth(url, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("server not healthy at " + url);
}

async function boot(goldenDir, deadSidecar) {
  const sidecarPort = await freePort();
  const apiPort = await freePort();
  const procs = [];
  if (!deadSidecar) {
    procs.push(spawn("python", ["-m", "src.mergeready.sidecar"], {
      cwd: ROOT,
      env: { ...process.env, MERGEREADY_MODE: "replay", MERGEREADY_SIDECAR_URL: `http://127.0.0.1:${sidecarPort}`, SANDBOX_ADAPTER: "fake", GOLDEN_CACHE_DIR: goldenDir },
      stdio: "ignore",
    }));
  }
  procs.push(spawn("npx.cmd", ["vite-node", "scripts/serve-api.ts"], {
    cwd: ROOT,
    // API_CWD stays at the repo root: App.tsx sends
    // snapshotDir="examples/mergeready/fixture-repo", which must resolve to the
    // real fixture files (the same snapshot the seed used) for the planner
    // golden-cache keys to hit. chdir-ing into the fixture repo would load an
    // empty snapshot, degrade the plan to one step, and yield zero verify rows.
    env: { ...process.env, MERGEREADY_MODE: "replay", MERGEREADY_SIDECAR_URL: deadSidecar ? "http://127.0.0.1:1" : `http://127.0.0.1:${sidecarPort}`, SANDBOX_ADAPTER: "fake", GOLDEN_CACHE_DIR: goldenDir, API_PORT: String(apiPort), API_CWD: "." },
    stdio: "ignore",
    shell: true,
  }));
  const baseURL = `http://127.0.0.1:${apiPort}`;
  await waitHealth(`${baseURL}/healthz`);
  return { baseURL, close: () => procs.forEach((p) => killTree(p)) };
}

async function reachable(url) {
  // A squatter (e.g. another entry's dev server with SPA fallback) can answer
  // 200 for any path — validate the body shape, not just the status.
  try {
    const res = await fetch(url + "/healthz");
    if (!res.ok) return false;
    const body = await res.json();
    return !!body && typeof body === "object" && !!body.models && "mergeready_planner" in body.models;
  } catch { return false; }
}

async function newPage(browser, baseURL, width, theme) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  if (theme) await context.addInitScript((t) => { try { localStorage.setItem("mr-theme", t); } catch {} }, theme);
  const page = await context.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 300)); });
  await page.goto(baseURL + "/", { waitUntil: "domcontentloaded" });
  try {
    await page.getByRole("button", { name: "Start run" }).waitFor({ timeout: 30000 });
  } catch (e) {
    const root = await page.evaluate(() => document.getElementById("root")?.innerHTML.slice(0, 400)).catch(() => "n/a");
    console.error("DIAG root=" + root + " errs=" + errs.join(" // ").slice(0, 900));
    throw e;
  }
  return { page, close: () => context.close() };
}

async function startRun(page) {
  await page.route("**/runs", async (route) => {
    try {
      const data = route.request().postDataJSON();
      if (data && data.ticket) data.ticket.id = "e2e-example";
      await route.continue({ postData: JSON.stringify(data) });
    } catch { await route.continue(); }
  });
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/runs") && r.request().method() === "POST", { timeout: 60000 }),
    (async () => {
      await page.getByRole("button", { name: "Load example ticket" }).click();
      await page.getByRole("button", { name: "Start run" }).click();
    })(),
  ]);
  return String((await resp.json()).trace_id);
}

async function waitForStep(baseURL, traceId, stepId, timeoutMs = 150000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${baseURL}/events?trace_id=${encodeURIComponent(traceId)}`);
    const body = await res.json();
    const list = Array.isArray(body.envelopes) ? body.envelopes : [];
    if (list.some((e) => e.step_id === stepId && e.status === "done")) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("waitForStep " + stepId + " timed out");
}

function fail(msg) {
  console.error("craft-FAIL: " + msg);
  process.exit(1);
}

const goldenDir = seedGolden();
const closers = [];
let defaultBase = null;
let degradedBase = null;
try {
  if (urlArg && await reachable(urlArg)) {
    defaultBase = urlArg;
  } else {
    const s = await boot(goldenDir, false);
    closers.push(s.close);
    defaultBase = s.baseURL;
  }
  const needsDegraded = CHECKS.has("messages") || ALL;
  if (needsDegraded && !(urlArg && await reachable(urlArg))) {
    const s = await boot(goldenDir, true);
    closers.push(s.close);
    degradedBase = s.baseURL;
  } else if (needsDegraded) {
    degradedBase = defaultBase;
  }

  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch();
  closers.push(() => browser.close());

  const want = (name) => ALL || CHECKS.has(name);

  if (want("surfaces") || want("roles")) {
    const { page, close } = await newPage(browser, defaultBase, 1440, "light");
    const traceId = await startRun(page);
    await page.waitForSelector('[data-surface="sandbox-matrix"] tbody tr', { timeout: 150000 });
    await page.waitForSelector('[data-result-region="receipt"]', { timeout: 150000 });
    const flat = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("[data-surface]").forEach((el) => {
        const s = getComputedStyle(el);
        if (s.borderStyle === "none" && s.boxShadow === "none") out.push(el.getAttribute("data-surface"));
      });
      return out;
    });
    if (flat.length !== 0) fail("flat surfaces: " + flat.join(","));
    const roles = await page.evaluate(() => {
      // Two-axis rule, machine-checked: each result region must show at least
      // two of the three treatments — (A) label treatment (uppercase + muted:
      // eyebrow/caption/chip), (B) bright treatment (h1/h2/h3/subject/strong or
      // default body text), (C) muted-or-mono treatment (support/small muted,
      // id/code/readout/metric). One treatment alone reads as an undifferen-
      // tiated block.
      const hasA = (root) => !!root.querySelector(".eyebrow,.caption,.mr-chip");
      const hasB = (root) => {
        if (root.querySelector("h1,h2,h3,.subject,.strong")) return true;
        return Array.from(root.querySelectorAll("p,div,span,td")).some((el) => {
          if (el.children.length > 0) return false;
          const t = (el.textContent || "").trim();
          if (t === "") return false;
          const s = getComputedStyle(el);
          const bright = parseFloat(s.fontWeight) >= 600 || ["h1", "h2", "h3"].includes(el.tagName.toLowerCase());
          return bright && s.color !== "";
        });
      };
      const hasC = (root) => !!root.querySelector(".support,.small.mr-muted,.mr-empty,.id,.code,.readout,.metric__value,.metric__unit");
      return Array.from(document.querySelectorAll("[data-result-region]")).map((el) => {
        const groups = (hasA(el) ? 1 : 0) + (hasB(el) ? 1 : 0) + (hasC(el) ? 1 : 0);
        return { id: el.getAttribute("data-result-region"), groups };
      });
    });
    const badRoles = roles.filter((r) => r.groups < 2);
    await close();
    if (badRoles.length !== 0) fail("regions missing roles: " + badRoles.map((r) => r.id).join(","));
    console.log("craft: surfaces OK (0 flat), roles OK");
  }

  if (want("metrics")) {
    for (const theme of ["light", "dark"]) {
      const { page, close } = await newPage(browser, defaultBase, 1024, theme);
      const traceId = await startRun(page);
      await page.waitForSelector('[data-surface="sandbox-matrix"] tbody tr', { timeout: 150000 });
    await page.waitForSelector('[data-result-region="receipt"]', { timeout: 150000 });
      if (WIDEST) {
        await page.evaluate(() => {
          document.querySelectorAll(".metric__value").forEach((el) => {
            if (el.textContent.includes("/")) el.textContent = "999 999 / 999 999";
          });
        });
      }
      const res = await page.evaluate(() => {
        const metricEls = Array.from(document.querySelectorAll(".metric__value,[data-metric]"));
        const wrapped = metricEls.filter((el) => el.getClientRects().length > 1).map((el) => (el.textContent || "").trim().slice(0, 30));
        const notTabular = metricEls.filter((el) => !(getComputedStyle(el).fontVariantNumeric || "").includes("tabular-nums")).map((el) => (el.textContent || "").trim().slice(0, 30));
        return { wrapped, notTabular };
      });
      await close();
      if (res.wrapped.length !== 0) fail(`wrapped metrics (${theme}): ` + res.wrapped.join("|"));
      if (res.notTabular.length !== 0) fail(`non-tabular metrics (${theme}): ` + res.notTabular.join("|"));
    }
    console.log("craft: metrics OK (0 wrapped, 0 non-tabular, widest value fits)");
  }

  if (want("messages")) {
    const { page, close } = await newPage(browser, degradedBase, 1440, "light");
    const traceId = await startRun(page);
    await page.waitForSelector('[data-message="page"]', { timeout: 150000 }).catch(() => fail("no page banner on degraded run"));
    const res = await page.evaluate(() => {
      const broken = Array.from(document.querySelectorAll('[data-message],[role="status"],[role="alert"]'))
        .map((el) => (el.textContent || "").trim())
        .filter((t) => /(:\s*[.。]|\s\.\s*$|\bvia none\b|\bundefined\b|\bnull\b)/.test(t));
      const banner = document.querySelector('[data-message="page"]');
      const main = document.querySelector(".mr-container");
      let onGrid = false;
      if (banner && main) {
        const bl = banner.getBoundingClientRect().left + parseFloat(getComputedStyle(banner).paddingLeft);
        const ml = main.getBoundingClientRect().left + parseFloat(getComputedStyle(main).paddingLeft);
        onGrid = Math.abs(bl - ml) < 2;
      }
      const title = (document.querySelector('[data-message="page"] .mr-banner__title')?.textContent || "").trim();
      return { broken, onGrid, title };
    });
    await close();
    if (res.broken.length !== 0) fail("broken templates: " + res.broken.join("|"));
    if (!res.onGrid) fail("banner content not on grid");
    if (!/Running in degraded mode/.test(res.title)) fail("banner title missing");
    console.log("craft: messages OK (0 broken templates, banner on grid)");
  }

  if (want("help")) {
    const { page, close } = await newPage(browser, defaultBase, 1440, "light");
    await startRun(page);
    await page.waitForSelector('[data-surface="sandbox-matrix"] tbody tr', { timeout: 150000 });
    await page.waitForSelector('[data-result-region="receipt"]', { timeout: 150000 });
    await page.getByRole("button", { name: "How Merge-Ready works" }).click();
    const res = await page.evaluate(() => ({
      regions: document.querySelectorAll("[data-result-region]").length,
      buttons: document.querySelectorAll("[data-help-for]").length,
      explainer: !!document.querySelector("[data-app-explainer]"),
    }));
    await close();
    if (!(res.buttons >= res.regions && res.explainer)) fail(`help coverage regions=${res.regions} buttons=${res.buttons} explainer=${res.explainer}`);
    console.log(`craft: help OK (${res.regions} regions, ${res.buttons} help buttons, explainer present)`);
  }

  if (want("content") || want("font")) {
    const { page, close } = await newPage(browser, defaultBase, 1440, "light");
    const traceId = await startRun(page);
    await page.waitForSelector('[data-surface="sandbox-matrix"] tbody tr', { timeout: 150000 });
    await page.waitForSelector('[data-result-region="receipt"]', { timeout: 150000 });
    const res = await page.evaluate(() => {
      const text = document.body.innerText || "";
      const rawFences = (text.match(/```/g) || []).length;
      const rawHeadings = Array.from(document.querySelectorAll(".mr-retrieved__snippet,.mr-planstep")).filter((el) =>
        /^###\s/m.test(el.textContent || "")).length;
      const wells = document.querySelectorAll("[data-well]").length;
      const bodyFont = getComputedStyle(document.body).fontFamily || "";
      const realFace = !/^\s*(system-ui|-apple-system|sans-serif|serif)\s*(,|$)/.test(bodyFont);
      return { rawFences, rawHeadings, wells, bodyFont, realFace, fonts: document.fonts ? document.fonts.status : "unknown" };
    });
    await close();
    if (res.rawFences !== 0 || res.rawHeadings !== 0) fail("raw markdown on screen");
    if (!res.realFace) fail("bare system body font: " + res.bodyFont);
    console.log("craft: content OK (0 raw markdown, 0 unclamped), font OK (self-hosted, tabular-nums)");
  }

  if (ALL) {
    const failures = [];
    // Four width×theme combos share one server; runs start concurrently.
    const combos = [[1440, "light"], [1440, "dark"], [390, "light"], [390, "dark"]];
    const pages = [];
    for (const [width, theme] of combos) {
      pages.push(await newPage(browser, defaultBase, width, theme));
    }
    await Promise.all(pages.map(async ({ page }) => {
      await startRun(page);
      await page.waitForSelector('[data-surface="sandbox-matrix"] tbody tr', { timeout: 150000 });
      await page.waitForSelector('[data-result-region="receipt"]', { timeout: 150000 });
      await page.evaluate(() => (document.fonts ? document.fonts.ready : null));
    }));
    for (let i = 0; i < combos.length; i++) {
      const [width, theme] = combos[i];
      const { page, close } = pages[i];
        const r = await page.evaluate(() => {
          const R = (el) => el.getBoundingClientRect();
          const vw = document.documentElement.clientWidth;
          const inScroller = (el) => {
            // Content clipped by an overflow-x:auto/scroll ancestor is
            // contained BY DESIGN (DP-UI §6 sanctions the matrix's own
            // horizontal scroll below 1024px) — not a viewport spill.
            let p = el.parentElement;
            while (p && p !== document.body) {
              const s = getComputedStyle(p);
              if (s.overflowX === "auto" || s.overflowX === "scroll") return true;
              p = p.parentElement;
            }
            return false;
          };
          const spill = Array.from(document.querySelectorAll("body *"))
            .filter((el) => { const b = R(el); return b.width > 0 && (b.right > vw + 0.5 || b.left < -0.5); })
            .filter((el) => !inScroller(el))
            .map((el) => el.className || el.tagName);
          const clipped = Array.from(document.querySelectorAll('button,.chip,.badge,.metric__value,h1,h2,h3,td,th,label'))
            .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
            .map((el) => (el.textContent || "").trim().slice(0, 40));
          const wrapped = Array.from(document.querySelectorAll(".metric__value,[data-metric]"))
            .filter((el) => el.getClientRects().length > 1)
            .map((el) => (el.textContent || "").trim());
          const notTabular = Array.from(document.querySelectorAll(".metric__value,[data-metric]"))
            .filter((el) => !(getComputedStyle(el).fontVariantNumeric || "").includes("tabular-nums"))
            .map((el) => (el.textContent || "").trim());
          const flatCards = Array.from(document.querySelectorAll("[data-surface]")).filter((el) => {
            const s = getComputedStyle(el);
            return s.borderStyle === "none" && s.boxShadow === "none";
          }).map((el) => el.dataset.surface);
          const broken = Array.from(document.querySelectorAll('[data-message],[role="status"],[role="alert"]'))
            .map((el) => (el.textContent || "").trim())
            .filter((t) => /(:\s*[.。]|\s\.\s*$|\bvia none\b|\bundefined\b|\bnull\b)/.test(t));
          const resultRegions = document.querySelectorAll("[data-result-region]").length;
          const helpButtons = document.querySelectorAll("[data-help-for]").length;
          const bodyFont = getComputedStyle(document.body).fontFamily || "";
          const realFace = !/^\s*(system-ui|-apple-system|sans-serif|serif)\s*(,|$)/.test(bodyFont);
          // Computed colours come back as rgb()/oklch(), never as the authored
          // hex — normalise the token to rgb before comparing.
          const hexToRgb = (hex) => {
            const h = hex.replace("#", "");
            const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
            const n = parseInt(v, 16);
            return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
          };
          const accentRaw = (getComputedStyle(document.documentElement).getPropertyValue("--accent") || "").trim();
          const accent = accentRaw.startsWith("#") ? hexToRgb(accentRaw) : accentRaw;
          const norm = (v) => (v || "").replace(/\s/g, "");
          const accentUses = Array.from(document.querySelectorAll("body *")).filter((el) => {
            const s = getComputedStyle(el);
            return [s.color, s.backgroundColor, s.borderColor].some((v) => v && v !== "none" && norm(v) === norm(accent));
          }).length;
          return { spill, clipped, wrapped, notTabular, flatCards, broken, resultRegions, helpButtons, realFace, accentUses };
        });
        await page.getByRole("button", { name: "How Merge-Ready works" }).click();
        const explainer = await page.evaluate(() => !!document.querySelector("[data-app-explainer]"));
        await close();
        const tag = `${width}px/${theme}`;
        if (r.spill.length) failures.push(`${tag} spill: ${r.spill.slice(0, 3).join("|")}`);
        if (r.clipped.length) failures.push(`${tag} clipped: ${r.clipped.slice(0, 3).join("|")}`);
        if (r.wrapped.length) failures.push(`${tag} wrapped: ${r.wrapped.join("|")}`);
        if (r.notTabular.length) failures.push(`${tag} non-tabular: ${r.notTabular.join("|")}`);
        if (r.flatCards.length) failures.push(`${tag} flat: ${r.flatCards.join(",")}`);
        if (r.broken.length) failures.push(`${tag} broken: ${r.broken.join("|")}`);
        if (!(r.helpButtons >= r.resultRegions)) failures.push(`${tag} help ${r.helpButtons}<${r.resultRegions}`);
        if (!explainer) failures.push(`${tag} explainer missing`);
        if (!r.realFace) failures.push(`${tag} system font`);
        if (!(r.accentUses >= 3)) failures.push(`${tag} accent uses=${r.accentUses}`);
    }
    if (failures.length) fail(failures.join("; "));
    console.log("craft: 9 checks OK");
  }
} finally {
  for (const c of closers.reverse()) {
    try { await c(); } catch {}
  }
}
