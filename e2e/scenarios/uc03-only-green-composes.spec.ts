// SPDX-License-Identifier: Apache-2.0
// uc03 — only green diffs reach the PR (FR-07): the red attempt's diff is
// absent from the proposal, and a run with nothing green proposes nothing.
import { test, expect, runExampleTicket } from "../fixtures/app.js";
import { collectEvents, waitForStep } from "../fixtures/envelopes.js";

test("uc03 only green diffs compose the PR", async ({ page, defaultServer, refusedServer }) => {
  test.setTimeout(420000);

  // Green clause: the red step-2 attempt broke `add`; the PR must not carry it.
  const greenTrace = await runExampleTicket(page, defaultServer);
  await waitForStep(defaultServer.baseURL, greenTrace, "pr");
  const greenEvents = await collectEvents(defaultServer.baseURL, greenTrace);
  const greenPr = greenEvents.find((e) => e.step_id === "pr" && e.status === "done");
  const greenPayload = greenPr!.payload as {
    acceptedCount?: unknown;
    unifiedDiff?: unknown;
    stepIds?: unknown;
  };
  const planning = greenEvents.find((e) => e.step_id === "planning" && e.status === "done");
  const planned = ((planning!.payload as { stepIds?: unknown }).stepIds as string[]).length;
  expect(greenPayload.acceptedCount).toBe(planned);
  const diff = String(greenPayload.unifiedDiff ?? "");
  expect(diff).toContain("def mul");
  expect(diff).not.toContain("return a + b + 1");
  const preview = page.getByRole("region", { name: "Pull request" });
  await expect(preview.getByText(/^mergeready\//).first()).toBeVisible();

  // No-green clause: the 0.000001-budget run rejects every step before any
  // draft, so nothing is proposed and no diff is emitted.
  const refusedTrace = await runExampleTicket(page, refusedServer);
  await waitForStep(refusedServer.baseURL, refusedTrace, "pr");
  const refusedEvents = await collectEvents(refusedServer.baseURL, refusedTrace);
  const refusedPr = refusedEvents.find((e) => e.step_id === "pr" && e.status === "done");
  const refusedPayload = refusedPr!.payload as { acceptedCount?: unknown; unifiedDiff?: unknown };
  expect(refusedPayload.acceptedCount).toBe(0);
  expect(String(refusedPayload.unifiedDiff ?? "")).toBe("");
  await expect(
    page.getByText("No pull request. Nothing went green, so nothing is proposed."),
  ).toBeVisible();
  expect(await preview.locator(".mr-diff__line--add").count()).toBe(0);
});
