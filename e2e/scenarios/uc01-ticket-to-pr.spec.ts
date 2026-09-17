// SPDX-License-Identifier: Apache-2.0
// uc01 — the skeptic pastes a ticket and gets a PR proposal (FR-01).
import { test, expect, runExampleTicket } from "../fixtures/app.js";
import { collectEvents, waitForStep } from "../fixtures/envelopes.js";

test("uc01 ticket in, PR proposal out", async ({ page, defaultServer }) => {
  const traceId = await runExampleTicket(page, defaultServer);

  // The app is working, not just painted (the plan's single testid).
  const indicator = page.getByTestId("work-indicator-text");
  await expect(indicator).toBeVisible();
  expect((await indicator.textContent())?.trim().length).toBeGreaterThan(0);

  await waitForStep(defaultServer.baseURL, traceId, "pr");

  const events = await collectEvents(defaultServer.baseURL, traceId);
  const pr = events.find((e) => e.step_id === "pr" && e.status === "done");
  expect(pr, "pr envelope exists").toBeDefined();
  const payload = pr!.payload as { acceptedCount?: unknown };
  expect(typeof payload.acceptedCount === "number" && payload.acceptedCount > 0).toBe(true);

  const preview = page.getByRole("region", { name: "Pull request" });
  await expect(preview).toBeVisible();
  await expect(preview.getByText(/^mergeready\//).first()).toBeVisible();
  expect(await preview.locator(".mr-diff__line--add").count()).toBeGreaterThan(0);
  await expect(preview.getByRole("heading", { name: "Receipt" })).toBeVisible();

  const header = page.getByRole("banner", { name: "Run header" });
  await expect(header.getByText("pass").first()).toBeVisible();
});
