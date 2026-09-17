// SPDX-License-Identifier: Apache-2.0
// uc04 — every PR carries its receipt (FR-08).
import { test, expect, runExampleTicket } from "../fixtures/app.js";
import { collectEvents, waitForStep } from "../fixtures/envelopes.js";

test("uc04 receipt drawer is complete", async ({ page, defaultServer }) => {
  const traceId = await runExampleTicket(page, defaultServer);
  await waitForStep(defaultServer.baseURL, traceId, "pr");

  const events = await collectEvents(defaultServer.baseURL, traceId);
  const planning = events.find((e) => e.step_id === "planning" && e.status === "done");
  const modelId = String((planning!.payload as { modelId?: unknown }).modelId ?? "");
  expect(modelId.length).toBeGreaterThan(0);
  const ledger = events.find((e) => e.step_id === "ledger" && e.status === "done");
  const ledgerPayload = ledger!.payload as {
    promptTokens?: unknown;
    completionTokens?: unknown;
    usd?: unknown;
  };
  expect(ledgerPayload.promptTokens).toBeGreaterThan(0);
  expect(ledgerPayload.completionTokens).toBeGreaterThan(0);

  // The drawer opens from the status bar and carries plan, branches, models,
  // tokens and a 4-dp USD figure (never hardcoded — read off the envelopes).
  await page.getByRole("button", { name: "Receipt" }).first().click();
  // Plan-literal string (case-insensitive substring): the drawer is labelled
  // "Cost receipt", which a case-sensitive /Receipt/ regex misses.
  const dialog = page.getByRole("dialog", { name: "Receipt" });
  await expect(dialog).toBeVisible();
  const text = (await dialog.textContent()) ?? "";
  expect(text).toContain("Add sub() and mul()");
  expect(text).toContain("step-1");
  expect(text).toContain("step-2");
  expect(text).toContain(modelId);
  expect(text).toContain(String(ledgerPayload.promptTokens));
  expect(text).toContain(String(ledgerPayload.completionTokens));
  expect(text).toMatch(/\$\d+\.\d{4}/);

  await page.getByRole("button", { name: "Close receipt" }).click();
  await expect(dialog).toHaveCount(0);
});
