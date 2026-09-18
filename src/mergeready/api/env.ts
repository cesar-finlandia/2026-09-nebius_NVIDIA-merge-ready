// SPDX-License-Identifier: Apache-2.0
export type MergeReadyMode = "live" | "replay";
export type PrMode = "dry" | "live";

export interface MergeReadyEnv {
  NEBIUS_API_KEY: string | null;
  NEBIUS_BASE_URL: string;
  TAVILY_API_KEY: string | null;
  CONTREE_PROFILE: string | null;
  MERGEREADY_MODE: MergeReadyMode;
  MERGEREADY_SIDECAR_URL: string;
  MERGEREADY_MAX_STEPS: number;
  MERGEREADY_BUDGET_USD: number;
  MERGEREADY_RUN_BUDGET_USD: number;
  MERGEREADY_JOBS_THRESHOLD: number;
  MERGEREADY_PR_MODE: PrMode;
  GITHUB_TOKEN: string | null;
  TRANSPORT: string | null;
  THEME: string | null;
  API_BASE: string | null;
  DEPLOY_PROVIDER: string | null;
  // Build marker shown in the UI status bar and smoke line. Cloud Run sets
  // K_REVISION automatically; an explicit BUILD_MARKER wins when present
  // (e.g. a git SHA stamped at image build time); "dev" locally.
  BUILD_MARKER: string;
}

function nonEmpty(v: string | undefined): string | null {
  if (v === undefined) return null;
  return v.trim() === "" ? null : v;
}

function parseIntOr(v: string | undefined, fallback: number): number {
  if (v === undefined || v.trim() === "") return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

function parseFloatOr(v: string | undefined, fallback: number): number {
  if (v === undefined || v.trim() === "") return fallback;
  const n = Number.parseFloat(v);
  return Number.isNaN(n) ? fallback : n;
}

export function readEnv(): MergeReadyEnv {
  const modeRaw = nonEmpty(process.env["MERGEREADY_MODE"]);
  const mode: MergeReadyMode = modeRaw === "replay" ? "replay" : "live";
  const prRaw = nonEmpty(process.env["MERGEREADY_PR_MODE"]);
  const prMode: PrMode = prRaw === "live" ? "live" : "dry";
  const env: MergeReadyEnv = {
    NEBIUS_API_KEY: nonEmpty(process.env["NEBIUS_API_KEY"]),
    NEBIUS_BASE_URL: nonEmpty(process.env["NEBIUS_BASE_URL"]) ?? "https://api.tokenfactory.nebius.com/v1/",
    TAVILY_API_KEY: nonEmpty(process.env["TAVILY_API_KEY"]),
    CONTREE_PROFILE: nonEmpty(process.env["CONTREE_PROFILE"]),
    MERGEREADY_MODE: mode,
    MERGEREADY_SIDECAR_URL: nonEmpty(process.env["MERGEREADY_SIDECAR_URL"]) ?? "http://127.0.0.1:8787",
    MERGEREADY_MAX_STEPS: parseIntOr(process.env["MERGEREADY_MAX_STEPS"], 6),
    MERGEREADY_BUDGET_USD: parseFloatOr(process.env["MERGEREADY_BUDGET_USD"], 50),
    MERGEREADY_RUN_BUDGET_USD: parseFloatOr(process.env["MERGEREADY_RUN_BUDGET_USD"], 0.75),
    MERGEREADY_JOBS_THRESHOLD: parseIntOr(process.env["MERGEREADY_JOBS_THRESHOLD"], 4),
    MERGEREADY_PR_MODE: prMode,
    GITHUB_TOKEN: nonEmpty(process.env["GITHUB_TOKEN"]),
    TRANSPORT: nonEmpty(process.env["TRANSPORT"]),
    THEME: nonEmpty(process.env["THEME"]),
    API_BASE: nonEmpty(process.env["API_BASE"]),
    DEPLOY_PROVIDER: nonEmpty(process.env["DEPLOY_PROVIDER"]),
    BUILD_MARKER:
      nonEmpty(process.env["BUILD_MARKER"]) ?? nonEmpty(process.env["K_REVISION"]) ?? "dev",
  };
  if (mode === "live") {
    const missing: string[] = [];
    if (env.NEBIUS_API_KEY === null) missing.push("NEBIUS_API_KEY");
    if (env.TAVILY_API_KEY === null) missing.push("TAVILY_API_KEY");
    if (env.CONTREE_PROFILE === null) missing.push("CONTREE_PROFILE");
    if (env.MERGEREADY_PR_MODE === "live" && env.GITHUB_TOKEN === null) missing.push("GITHUB_TOKEN");
    if (missing.length > 0) throw new Error("missing required env: " + missing.join(", "));
  }
  return env;
}
