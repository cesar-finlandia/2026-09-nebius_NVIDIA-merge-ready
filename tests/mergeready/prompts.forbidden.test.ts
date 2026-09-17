import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FILES = [
  "system.planner.md",
  "user.planner.md",
  "system.drafter.md",
  "user.drafter.md",
  "system.redrafter.md",
  "user.redrafter.md",
];

const BOUNDARY = "You do not authorize merging; a separate gate decides.";

describe("prompts forbidden vocabulary", () => {
  it("contains no merge-authorizing language outside the boundary sentence", () => {
    const words = ["merge", "approve", "ship", "deploy"];
    for (const name of FILES) {
      const raw = readFileSync(join(process.cwd(), "engine", "prompts", name), "utf8");
      // Strip the single allowed boundary sentence from each file.
      const withoutBoundary = raw.split(BOUNDARY).join("");
      // Product name "Merge-Ready" is the project title, not a merge
      // authorization; normalize it away before the substring check so the
      // check targets authorizing language only.
      const normalized = withoutBoundary.split(/merge-ready/gi).join("");
      const lowered = normalized.toLowerCase();
      for (const w of words) {
        expect(lowered.includes(w), `${name} contains forbidden word "${w}"`).toBe(false);
      }
    }
  });
});
