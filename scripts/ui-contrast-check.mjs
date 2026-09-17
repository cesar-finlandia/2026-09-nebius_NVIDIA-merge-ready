// SPDX-License-Identifier: Apache-2.0
// Contrast gate: asserts the AA pairings for both themes by parsing the
// literal token block in src/mergeready/ui/mergeready.css. Real WCAG
// relative-luminance math, no dependencies.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cssPath = join(root, "src", "mergeready", "ui", "mergeready.css");
const css = readFileSync(cssPath, "utf8");

function themeBlock(theme) {
  const re =
    theme === "dark"
      ? /:root,\s*\[data-theme="dark"\]\s*\{([\s\S]*?)\}/
      : /\[data-theme="light"\]\s*\{([\s\S]*?)\}/;
  const m = css.match(re);
  if (!m) throw new Error("missing token block for theme: " + theme);
  return m[1];
}

function readVars(block) {
  const out = Object.create(null);
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*#([0-9A-Fa-f]{6})/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

function channel(c) {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const TEXT_TOKENS = [
  "--text",
  "--text-muted",
  "--accent",
  "--accent-hover",
  "--pass",
  "--fail",
  "--rolled-back",
  "--degraded",
];

// 27 pairings per theme: 8 text tokens x {bg, bg-elevated} @4.5 (16),
// border-strong vs bg @3.0 (1), chart-1..6 vs bg @3.0 (6),
// accent-contrast vs accent @4.5 (1), text vs row tints @4.5 (3).
const PAIRINGS = [];
for (const t of TEXT_TOKENS) {
  PAIRINGS.push([t, "--bg", 4.5]);
  PAIRINGS.push([t, "--bg-elevated", 4.5]);
}
PAIRINGS.push(["--border-strong", "--bg", 3.0]);
for (let i = 1; i <= 6; i += 1) PAIRINGS.push(["--chart-" + i, "--bg", 3.0]);
PAIRINGS.push(["--accent-contrast", "--accent", 4.5]);
PAIRINGS.push(["--text", "--bg-pass", 4.5]);
PAIRINGS.push(["--text", "--bg-fail", 4.5]);
PAIRINGS.push(["--text", "--bg-rolled", 4.5]);

let ok = 0;
const failures = [];
for (const theme of ["dark", "light"]) {
  const vars = readVars(themeBlock(theme));
  for (const [fg, bg, min] of PAIRINGS) {
    if (!(fg in vars)) {
      failures.push(theme + " " + fg + " missing from token block");
      continue;
    }
    if (!(bg in vars)) {
      failures.push(theme + " " + bg + " missing from token block");
      continue;
    }
    const r = ratio(vars[fg], vars[bg]);
    if (r + 1e-9 >= min) {
      ok += 1;
    } else {
      failures.push(
        theme + " " + fg + " on " + bg + " = " + r.toFixed(2) + " (< " + min.toFixed(1) + ")",
      );
    }
  }
}

if (failures.length > 0) {
  for (const f of failures) console.error("contrast FAIL: " + f);
  process.exit(1);
}
console.log("contrast: " + ok + " pairs OK");
