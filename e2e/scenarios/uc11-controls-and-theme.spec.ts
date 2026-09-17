// SPDX-License-Identifier: Apache-2.0
// uc11 — every control does something: full inventory, theme persistence,
// receipt focus trap + Escape.
import { test, expect, runExampleTicket } from "../fixtures/app.js";
import { waitForStep } from "../fixtures/envelopes.js";

// Manifest of interactive controls by accessible name → scenario that clicks
// it. Dynamic names (per-step log buttons) are covered by DYNAMIC_PATTERNS.
// Controls that cannot be clicked in a green replay run live in
// KNOWN_INERT with their reason (mirrors known-inert.md).
export const CONTROL_MANIFEST: Record<string, string> = {
  "Start run": "uc01",
  "Load example ticket": "uc01",
  Receipt: "uc04",
  "Close receipt": "uc04",
  "Switch to light theme": "uc11",
  "Switch to dark theme": "uc11",
  "Ticket title": "uc01",
  "Ticket body": "uc01",
  "Repo URL": "uc01",
  "Base branch": "uc01",
};
export const DYNAMIC_PATTERNS: RegExp[] = [
  /^Show log for \S+/,
  /^Hide log for \S+/,
  /^Copy log for \S+/,
];
export const KNOWN_INERT: { pattern: RegExp; reason: string }[] = [
  { pattern: /^Reconnect$/, reason: "renders only on stream error" },
  { pattern: /^citation:/, reason: "external navigation links; hrefs asserted, never clicked" },
];

interface ControlInfo {
  kind: string;
  name: string;
}

async function inventory(page: import("@playwright/test").Page): Promise<ControlInfo[]> {
  return page.evaluate(() => {
    const els = Array.from(
      document.querySelectorAll("button, a[href], input, textarea, select, [role='switch']"),
    );
    return els.map((el) => {
      const labelled =
        el.getAttribute("aria-label") ??
        (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 80) ??
        "";
      const id = el.getAttribute("id") ?? "";
      let fromLabel = "";
      if (id !== "") {
        const lab = document.querySelector(`label[for='${id}']`);
        if (lab) fromLabel = (lab.textContent ?? "").trim();
      }
      return { kind: el.tagName.toLowerCase(), name: fromLabel !== "" ? fromLabel : labelled };
    });
  });
}

test("uc11 every control is exercised, theme persists, drawer traps focus", async ({
  page,
  defaultServer,
}) => {
  // No theme seed here: uc11 owns the toggle.
  const traceId = await runExampleTicket(page, defaultServer, { theme: null });
  await waitForStep(defaultServer.baseURL, traceId, "pr");

  // Open one disclosure so Hide-log and Copy-log controls exist in the DOM.
  await page.getByRole("button", { name: "Show log for verify-1" }).click();

  const controls = await inventory(page);
  expect(controls.length).toBeGreaterThan(0);
  const problems: string[] = [];
  for (const c of controls) {
    if (c.kind === "a") continue; // citation links: external navigation, inert
    if (c.name === "Reconnect") continue; // error-only control, inert
    if (c.name in CONTROL_MANIFEST) continue;
    if (DYNAMIC_PATTERNS.some((re) => re.test(c.name))) continue;
    problems.push(`${c.kind}:"${c.name}"`);
  }
  expect(problems, "unexercised controls").toEqual([]);

  // Citation links are inert (external navigation) but their hrefs resolve.
  const links = page.getByRole("link");
  expect(await links.count()).toBeGreaterThan(0);
  for (const href of await links.evaluateAll((els) =>
    els.map((el) => (el as HTMLAnchorElement).href),
  )) {
    expect(href).toMatch(/^https?:\/\//);
  }

  // Theme toggle flips data-theme and survives a reload.
  const toggle = page.getByRole("switch");
  await expect(toggle).toBeVisible();
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await toggle.click();
  const after = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(after).not.toBe(before);
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(after);
  await page.getByRole("switch").click();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(before);

  // Receipt drawer traps focus and closes on Escape, returning focus.
  await page.getByRole("button", { name: "Receipt" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Receipt" });
  await expect(dialog).toBeVisible();
  expect(
    await page.evaluate(() => {
      const d = document.querySelector("[role='dialog']");
      return d !== null && d.contains(document.activeElement);
    }),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(
    await page.evaluate(() => (document.activeElement?.textContent ?? "").trim()),
  ).toContain("Receipt");
});
