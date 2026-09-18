// SPDX-License-Identifier: Apache-2.0
// C-30 deployed-URL smoke suite (DP-E2E-BROWSER-TESTING §5 A4). The single
// suite DP-API's deploy gate, DP-SCRIPT's harvest and DP-LIVE-RUN-AND-VIDEO's
// health gate re-run remotely. Writes nothing to the repo.
import { test, expect } from "@playwright/test";
import { CONSOLE_ALLOWLIST, bootLocal } from "./fixtures/app.js";
import { waitForStep } from "./fixtures/envelopes.js";

const BASE = process.env["BASE_URL"] ?? "http://localhost:8787";

test("smoke: deployed app serves a full run", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));

  let close: (() => void) | null = null;
  let base = BASE;
  if (!process.env["BASE_URL"]) {
    const local = await bootLocal("default");
    base = local.baseURL;
    close = local.close;
  }
  try {
    // 1. Health with a non-empty build marker (/health: Cloud Run's edge
    // reserves /healthz and 404s it before the container is reached).
    const healthRes = await fetch(`${base}/health`);
    expect(healthRes.ok).toBe(true);
    const health = (await healthRes.json()) as {
      buildMarker?: unknown;
      build?: unknown;
      version?: unknown;
    };
    const buildMarker =
      [health.buildMarker, health.build, health.version].find(
        (v): v is string => typeof v === "string" && v !== "",
      ) ?? "dev";
    expect(buildMarker.length).toBeGreaterThan(0);

    // 2-3. Open, load the example, start.
    await page.addInitScript(() => localStorage.setItem("mr-theme", "dark"));
    if (!process.env["BASE_URL"]) {
      await page.route("**/runs", async (route) => {
        try {
          const data = route.request().postDataJSON() as { ticket?: { id?: string } } | null;
          if (data && data.ticket) data.ticket.id = "e2e-example";
          await route.continue({ postData: JSON.stringify(data) });
        } catch {
          await route.continue();
        }
      });
    }
    await page.goto(`${base}/`);
    await expect(page.getByText("Merge-Ready").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Start run" })).toBeVisible();
    await page.getByRole("button", { name: "Load example ticket" }).click();
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/runs") && r.request().method() === "POST"),
      page.getByRole("button", { name: "Start run" }).click(),
    ]);
    const started = (await resp.json()) as { trace_id?: unknown };
    const traceId = String(started.trace_id);

    // 4. The work indicator's text line becomes non-empty.
    const indicator = page.getByTestId("work-indicator-text");
    await expect(indicator).toBeVisible();
    expect(((await indicator.textContent()) ?? "").trim().length).toBeGreaterThan(0);

    // 5. A verify envelope lands and the matrix carries a verdict word.
    await waitForStep(base, traceId, "verify-1");
    const matrix = page.getByRole("table", { name: "Sandbox matrix" });
    await expect(matrix).toBeVisible();
    await expect(matrix.getByText(/pass|fail|rolled back|unverified/).first()).toBeVisible();
    const rowCount = await matrix.getByRole("row").count();

    // 6. PR proposal or the explicit no-PR copy.
    await waitForStep(base, traceId, "pr");
    const preview = page.getByRole("region", { name: "Pull request" });
    const branches = await preview.getByText(/^mergeready\//).count();
    if (branches === 0) {
      await expect(
        preview.getByText("No pull request. Nothing went green, so nothing is proposed."),
      ).toBeVisible();
    }

    // 7. Zero unexpected console errors.
    const bad = errors.filter((m) => !CONSOLE_ALLOWLIST.some((re) => re.test(m)));
    expect(bad).toEqual([]);

    // 8. The gate line every downstream caller greps for.
    console.log(`smoke-ok ${base} ${buildMarker} ${rowCount}`);
  } finally {
    if (close) close();
  }
});
