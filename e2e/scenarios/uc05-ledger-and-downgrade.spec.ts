// SPDX-License-Identifier: Apache-2.0
// uc05 — spend is metered and the downgrade is visible (FR-09).
import { test, expect, runExampleTicket } from "../fixtures/app.js";
import { collectEvents, waitForStep } from "../fixtures/envelopes.js";

const HONESTY = "Local estimate from the published price list — not a billing figure.";

test("uc05 ledger meters spend and surfaces the downgrade", async ({
  page,
  defaultServer,
  tinyServer,
}) => {
  test.setTimeout(420000);

  // Forced-low budget: the redrafter flips ultra→nano and the USD tile turns.
  const tinyTrace = await runExampleTicket(page, tinyServer);
  await waitForStep(tinyServer.baseURL, tinyTrace, "pr");
  const tinyEvents = await collectEvents(tinyServer.baseURL, tinyTrace);
  const tinyLedger = tinyEvents.find((e) => e.step_id === "ledger" && e.status === "done");
  const downgrades = (
    (tinyLedger!.payload as { downgrades?: unknown }).downgrades as {
      role?: unknown;
      from?: unknown;
      to?: unknown;
      reason?: unknown;
    }[]
  ).slice();
  expect(downgrades.length).toBeGreaterThan(0);
  const flip = downgrades.find((d) => d.role === "redrafter");
  expect(flip, "redrafter downgrade row").toBeDefined();

  const ledger = page.getByRole("region", { name: "Ledger" });
  await expect(ledger).toBeVisible();
  await expect(
    ledger.getByText(`redrafter downgraded ${flip!.from} → ${flip!.to}`),
  ).toBeVisible();
  await expect(ledger.getByText("budget exceeded — planner downgraded")).toBeVisible();
  await expect(ledger.getByText(HONESTY)).toBeVisible();

  // Full-budget run: the same honesty line is present in the live state.
  const fullTrace = await runExampleTicket(page, defaultServer);
  await waitForStep(defaultServer.baseURL, fullTrace, "pr");
  await expect(page.getByRole("region", { name: "Ledger" }).getByText(HONESTY)).toBeVisible();
});
