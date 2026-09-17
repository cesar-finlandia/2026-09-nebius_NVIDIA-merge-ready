// SPDX-License-Identifier: Apache-2.0
// DP-SUBMIT C-28 compliance guard: four independent checks with mapped exits.
// 2 = prohibited-strings, 3 = bare-network, 4 = deep-import, 5 = license-presence.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, sep } from "node:path";

type LintCheckId = "prohibited-strings" | "bare-network" | "deep-import" | "license-presence";

interface LintFailure {
  check: LintCheckId;
  file: string;
  line: number;
  excerpt: string;
  reason: string;
}

const EXIT: Record<LintCheckId, number> = {
  "prohibited-strings": 2,
  "bare-network": 3,
  "deep-import": 4,
  "license-presence": 5,
};

function trackedFiles(): string[] {
  const out = execFileSync("git", ["ls-files"], { encoding: "utf8" });
  return out.split("\n").map((s) => s.trim()).filter((s) => s !== "");
}

function readText(file: string): string | null {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

// Check 1 — blocklist loader: literals quoted in Part 1 section B of
// design_documents/prompts/PROMPT-DP-SUBMIT.md. Definitional files (the
// PROMPT-DP-*.md family, which all share Part 1 verbatim) are exempt: the rule
// must name the strings to define them.
const BLOCKLIST_SOURCE = "design_documents/prompts/PROMPT-DP-SUBMIT.md";

function loadBlocklist(): string[] {
  const text = readText(BLOCKLIST_SOURCE) ?? "";
  const after = text.split("### B. DISQUALIFICATION-LEVEL naming prohibition")[1] ?? "";
  // Section B ends at the next heading (### C. ... or ## PART 2) — the eight
  // literals live only in that span.
  const end = after.search(/\n### |\n## /);
  const section = end >= 0 ? after.slice(0, end) : after;
  const quoted = section.match(/`([^`]+)`/g) ?? [];
  return quoted.map((q) => q.slice(1, -1)).filter((s) => s.length > 0);
}

function checkProhibitedStrings(files: string[], blocklist: string[]): LintFailure[] {
  const out: LintFailure[] = [];
  for (const file of files) {
    if (/^design_documents\/prompts\/PROMPT-DP-.*\.md$/.test(file)) continue;
    const text = readText(file);
    if (text === null) continue;
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      for (const bad of blocklist) {
        if (lines[i]!.includes(bad)) {
          out.push({
            check: "prohibited-strings",
            file,
            line: i + 1,
            excerpt: lines[i]!.slice(0, 120),
            reason: "disallowed vendor string present",
          });
          break;
        }
      }
    }
  }
  return out;
}

// Check 2 — bare network calls under src/mergeready/.
// Limitation (by design, stated here): a call whose withResilience( wrapper
// sits more than 5 lines away is flagged; the operator adds
// `// resilience-exempt: wrapper on caller` on the flagged line and re-runs.
function checkBareNetwork(files: string[]): LintFailure[] {
  const out: LintFailure[] = [];
  for (const file of files) {
    if (!file.startsWith("src/mergeready/")) continue;
    if (!/\.(ts|tsx|py)$/.test(file)) continue;
    const text = readText(file);
    if (text === null) continue;
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const hit = /fetch\s*\(/.test(line) || line.includes("httpx.");
      if (!hit) continue;
      if (line.includes("127.0.0.1") || line.includes("localhost")) continue;
      if (/resilience-exempt:\s*\S/.test(line)) continue;
      let wrapped = false;
      for (let j = Math.max(0, i - 5); j <= Math.min(lines.length - 1, i + 5); j++) {
        if (lines[j]!.includes("withResilience(")) {
          wrapped = true;
          break;
        }
      }
      if (wrapped) continue;
      out.push({
        check: "bare-network",
        file,
        line: i + 1,
        excerpt: line.trim().slice(0, 120),
        reason: "bare network call outside withResilience",
      });
    }
  }
  return out;
}

// Check 3 — deep chassis imports under src/mergeready/.
const ALLOWED_ROOTS = ["src/resilience", "src/context", "src/platform/transport", "src/platform/ui"];

function normalizeSpecifier(spec: string): string {
  return spec.replace(/(\/index)?\.js$/, "");
}

function checkDeepImport(files: string[]): LintFailure[] {
  const out: LintFailure[] = [];
  const fromRe = /from\s+["']([^"']+)["']/g;
  const dynRe = /import\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const file of files) {
    if (!file.startsWith("src/mergeready/")) continue;
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const text = readText(file);
    if (text === null) continue;
    const specs = new Set<string>();
    for (const re of [fromRe, dynRe]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) specs.add(m[1]!);
    }
    for (const spec of specs) {
      if (spec.startsWith("src/")) {
        const norm = normalizeSpecifier(spec);
        if (norm.startsWith("src/mergeready/")) continue;
        if (ALLOWED_ROOTS.includes(norm)) continue;
        out.push({
          check: "deep-import",
          file,
          line: 0,
          excerpt: spec.slice(0, 120),
          reason: "deep chassis import; use bare barrel import",
        });
      } else if (spec.includes("..")) {
        // Resolve relative to the importing file; flag escapes into chassis
        // deeper than the allowed roots.
        const abs = resolve(dirname(resolve(file)), spec);
        const root = resolve(".") + sep;
        const rel = abs.startsWith(root) ? abs.slice(root.length).replace(/\\/g, "/") : abs;
        const norm = normalizeSpecifier(rel);
        if (norm.startsWith("src/") && !norm.startsWith("src/mergeready/") && !ALLOWED_ROOTS.includes(norm)) {
          const isAllowedPrefix = ALLOWED_ROOTS.some((r) => norm === r || norm.startsWith(r + "/"));
          if (!isAllowedPrefix) {
            out.push({
              check: "deep-import",
              file,
              line: 0,
              excerpt: spec.slice(0, 120),
              reason: "deep chassis import; use bare barrel import",
            });
          }
        }
      }
    }
  }
  return out;
}

// Check 4 — license presence plus README gate.
function checkLicense(): LintFailure[] {
  const out: LintFailure[] = [];
  const fail = (file: string, line: number, reason: string): void => {
    out.push({ check: "license-presence", file, line, excerpt: "", reason });
  };
  if (!existsSync("LICENSE")) {
    fail("LICENSE", 0, "LICENSE file missing");
  } else {
    const text = readText("LICENSE") ?? "";
    if (!text.includes("Apache License") || !text.includes("Version 2.0")) {
      fail("LICENSE", 0, "LICENSE is not Apache-2.0");
    }
  }
  const files = trackedFiles();
  for (const file of files) {
    if (!file.startsWith("src/mergeready/") && file !== "scripts/lint-mergeready.ts") continue;
    if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      const first = (readText(file) ?? "").split("\n")[0] ?? "";
      if (first.trim() !== "// SPDX-License-Identifier: Apache-2.0") {
        fail(file, 1, "missing license header");
      }
    } else if (file.endsWith(".py")) {
      const first = (readText(file) ?? "").split("\n")[0] ?? "";
      if (first.trim() !== "# SPDX-License-Identifier: Apache-2.0") {
        fail(file, 1, "missing license header");
      }
    }
  }
  if (!existsSync("README.md")) {
    fail("README.md", 0, "README.md missing");
  } else {
    const top = (readText("README.md") ?? "").split("\n").slice(0, 3).join("\n");
    if (!top.includes("Apache-2.0")) fail("README.md", 0, "README top does not name license");
  }
  return out;
}

function main(): void {
  const files = trackedFiles();
  const failures: LintFailure[] = [
    ...checkProhibitedStrings(files, loadBlocklist()),
    ...checkBareNetwork(files),
    ...checkDeepImport(files),
    ...checkLicense(),
  ];
  if (failures.length === 0) {
    console.log(`lint-mergeready: clean (${files.length} files)`);
    process.exit(0);
  }
  for (const f of failures) {
    console.log(`FAIL [${f.check}] ${f.file}:${f.line}: ${f.reason}`);
  }
  console.log(`lint-mergeready: FAILED with ${failures.length} failure(s)`);
  const code = Math.min(...failures.map((f) => EXIT[f.check]));
  process.exit(code);
}

main();
