// SPDX-License-Identifier: Apache-2.0
// uc06 — FR-11's five states all render (DP-E2E-BROWSER-TESTING §5 A2).
// Written first: it validates the harness fixture end to end.
import { test, expect, runExampleTicket } from "../fixtures/app.js";
import { collectEvents, waitForStep } from "../fixtures/envelopes.js";

test("uc06 five states render over one replay run", async ({ page, defaultServer }) => {
  // Intake state before the run.
  await page.addInitScript(() => localStorage.setItem("mr-theme", "dark"));
  await page.goto(`${defaultServer.baseURL}/`);
  await expect(page.getByRole("heading", { name: "Nothing has been verified yet." })).toBeVisible();
  for (const name of ["Ticket title", "Ticket body", "Repo URL", "Base branch"]) {
    await expect(page.getByLabel(name)).toBeVisible();
  }

  const traceId = await runExampleTicket(page, defaultServer);
  await waitForStep(defaultServer.baseURL, traceId, "pr");

  // Planning trace with the grounding strip.
  const plan = page.getByRole("region", { name: "Planning trace" });
  await expect(plan).toBeVisible();
  const events = await collectEvents(defaultServer.baseURL, traceId);
  const planning = events.find((e) => e.step_id === "planning" && e.status === "done");
  const stepIds = ((planning?.payload ?? {}) as { stepIds?: unknown }).stepIds;
  expect(Array.isArray(stepIds) && stepIds.length > 0).toBe(true);
  for (const id of stepIds as string[]) {
    await expect(plan.getByText(id, { exact: true }).first()).toBeVisible();
  }
  await expect(plan.getByRole("link").first()).toBeVisible();

  // Sandbox matrix with rows.
  const matrix = page.getByRole("table", { name: "Sandbox matrix" });
  await expect(matrix).toBeVisible();
  expect(await matrix.getByRole("row").count()).toBeGreaterThan(1);

  // PR preview with receipt section.
  const pr = page.getByRole("region", { name: "Pull request" });
  await expect(pr).toBeVisible();
  await expect(pr.getByText(/^mergeready\//).first()).toBeVisible();
  expect(await pr.locator(".mr-diff__line--add").count()).toBeGreaterThan(0);
  await expect(pr.getByRole("heading", { name: "Receipt" })).toBeVisible();

  // Ledger dashboard past its empty state.
  const ledger = page.getByRole("region", { name: "Ledger" });
  await expect(ledger).toBeVisible();
  await expect(ledger.getByText("waiting for the first call")).toHaveCount(0);
  await expect(ledger.getByText("Calls")).toBeVisible();
});
