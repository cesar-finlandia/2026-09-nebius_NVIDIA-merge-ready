// SPDX-License-Identifier: Apache-2.0
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withResilience, makeDegradedResult } from "src/resilience";
import type { DegradedResult, ResilienceConfig } from "src/resilience";
import type { PrProposal } from "./compose.js";

export type PrPublishMode = "dry" | "live";

export interface PrPublishResult {
  url: string | null;
}

export type PublishPrFn = (
  p: PrProposal,
  mode: PrPublishMode,
) => Promise<PrPublishResult | DegradedResult<PrPublishResult>>;

export const PR_PUBLISH_RESILIENCE: ResilienceConfig = {
  timeout_ms: 20000,
  retries: 1,
  fallback_chain: { order: ["none"] },
};

async function readEnvDynamic(): Promise<Record<string, unknown>> {
  try {
    // @ts-ignore — ../api/env.js is DP-API C-26 (row 10); falls back to process.env until then.
    const mod = (await import(/* @vite-ignore */ "../api/env.js")) as {
      readEnv?: () => unknown | Promise<unknown>;
    };
    if (typeof mod.readEnv === "function") {
      const e = (await mod.readEnv()) as Record<string, unknown>;
      if (e !== null && typeof e === "object") return e;
    }
  } catch {
    // api/env.js (DP-API C-26) may not exist yet; fall back to process.env.
  }
  return {
    GITHUB_TOKEN: process.env["GITHUB_TOKEN"] ?? null,
    MERGEREADY_PR_MODE: process.env["MERGEREADY_PR_MODE"] ?? "dry",
  };
}

function parseOwnerRepo(body: string): string | null {
  const m = /github\.com[/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\s|$|`)/.exec(body);
  if (!m || !m[1] || !m[2]) return null;
  return `${m[1]}/${m[2]}`;
}

function degraded(reason: string): DegradedResult<PrPublishResult> {
  return makeDegradedResult<PrPublishResult>({
    reason,
    fallback_source: "none",
    original_error: reason,
    data: { url: null },
  });
}

async function dryPublish(p: PrProposal): Promise<PrPublishResult> {
  // A6: out/pr/ relative to the repo root (module-anchored, not cwd).
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const dir = join(root, "out", "pr");
  mkdirSync(dir, { recursive: true });
  const sanitized = p.branch.replace(/\//g, "-");
  const md = `# ${p.title}\n\nBranch: \`${p.branch}\`\n\n${p.body}`;
  writeFileSync(join(dir, `${sanitized}.md`), md, "utf8");
  writeFileSync(join(dir, `${sanitized}.diff`), p.unifiedDiff + "\n", "utf8");
  return { url: null };
}

async function livePublish(p: PrProposal): Promise<PrPublishResult | DegradedResult<PrPublishResult>> {
  const env = await readEnvDynamic();
  const token = typeof env["GITHUB_TOKEN"] === "string" ? (env["GITHUB_TOKEN"] as string) : "";
  if (!token) return degraded("github-token-missing");
  const repoFullName = parseOwnerRepo(p.body);
  if (!repoFullName) return degraded("repo-unknown");
  // Branch push is performed by the orchestrator's working copy before this
  // call; this plan performs no git spawn itself.
  const baseMatch = /@ `([^`]+)`/.exec(p.body);
  const base = baseMatch && baseMatch[1] ? baseMatch[1] : "main";
  const url = `https://api.github.com/repos/${repoFullName}/pulls`;
  const out = await withResilience(async () => {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
      body: JSON.stringify({ title: p.title, body: p.body, head: p.branch, base }),
    });
    if (!res.ok) throw new Error(`github-http-${res.status}`);
    return (await res.json()) as unknown;
  }, PR_PUBLISH_RESILIENCE)();
  if (out !== null && typeof out === "object" && "reason" in (out as Record<string, unknown>)) {
    const d = out as unknown as DegradedResult<unknown>;
    const reason = typeof d.reason === "string" && d.reason.startsWith("github-http-") ? d.reason : "github-unreachable";
    return degraded(reason);
  }
  const htmlUrl = (out as { html_url?: unknown }).html_url;
  if (typeof htmlUrl === "string" && htmlUrl.length > 0) return { url: htmlUrl };
  return degraded("github-http-unknown");
}

export const publishPr: PublishPrFn = async (p, mode) => {
  try {
    let effective: PrPublishMode = mode;
    if (effective !== "dry" && effective !== "live") {
      const env = await readEnvDynamic();
      effective = env["MERGEREADY_PR_MODE"] === "live" ? "live" : "dry";
    }
    if (effective === "dry") return dryPublish(p);
    return livePublish(p);
  } catch (e) {
    return degraded(e instanceof Error ? e.message : String(e));
  }
};
