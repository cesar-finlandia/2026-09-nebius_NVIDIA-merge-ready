// SPDX-License-Identifier: Apache-2.0
// uc10 — degraded is visible, never a crash (NFR-02).
import { test, expect, runExampleTicket } from "../fixtures/app.js";
import { collectEvents, waitForStep } from "../fixtures/envelopes.js";

test("uc10 sandbox degradation renders calmly", async ({ page, degradedServer }) => {
  const traceId = await runExampleTicket(page, degradedServer);
  await waitForStep(degradedServer.baseURL, traceId, "pr");

  // The banner names the step and the fallback source.
  const banner = page.getByRole("status").filter({ hasText: /^Step .* degraded via/ });
  await expect(banner.first()).toBeVisible();
  const bannerText = (await banner.first().textContent()) ?? "";
  expect(bannerText).toMatch(/^Step \S+ degraded via \S+/);

  // Matrix rows render the hollow-circle glyph with the word `unverified`.
  const matrix = page.getByRole("table", { name: "Sandbox matrix" });
  await expect(matrix).toBeVisible();
  await expect(matrix.getByText("unverified").first()).toBeVisible();
  await expect(matrix.getByRole("img", { name: /unverified/ }).first()).toBeVisible();
  const events = await collectEvents(degradedServer.baseURL, traceId);
  expect(
    events.some((e) => /^verify-\d+$/.test(e.step_id) || /^reverify-\d+$/.test(e.step_id)),
  ).toBe(true);

  // Every other view stays live: planning trace, ledger and PR all render.
  await expect(page.getByRole("region", { name: "Planning trace" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Ledger" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Pull request" })).toBeVisible();

  // Never a stack trace, never a blank page.
  await expect(page.getByText("Traceback", { exact: false })).toHaveCount(0);
  expect(((await page.locator("body").textContent()) ?? "").trim().length).toBeGreaterThan(100);
});
