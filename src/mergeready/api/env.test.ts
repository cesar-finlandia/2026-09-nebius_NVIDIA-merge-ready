// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readEnv } from "./env.js";

const SAVED = { ...process.env };

function clearLiveKeys(): void {
  delete process.env["NEBIUS_API_KEY"];
  delete process.env["TAVILY_API_KEY"];
  delete process.env["CONTREE_PROFILE"];
  delete process.env["GITHUB_TOKEN"];
  delete process.env["MERGEREADY_MODE"];
  delete process.env["MERGEREADY_PR_MODE"];
  delete process.env["NEBIUS_BASE_URL"];
  delete process.env["MERGEREADY_SIDECAR_URL"];
  delete process.env["MERGEREADY_MAX_STEPS"];
  delete process.env["MERGEREADY_BUDGET_USD"];
  delete process.env["MERGEREADY_RUN_BUDGET_USD"];
  delete process.env["MERGEREADY_JOBS_THRESHOLD"];
  delete process.env["K_REVISION"];
  delete process.env["BUILD_MARKER"];
}

beforeEach(() => {
  clearLiveKeys();
});

afterEach(() => {
  for (const k of Object.keys(process.env)) {
    if (!(k in SAVED)) delete process.env[k];
  }
  for (const [k, v] of Object.entries(SAVED)) {
    if (v !== undefined) process.env[k] = v;
  }
});

describe("readEnv", () => {
  it("applies defaults", () => {
    process.env["MERGEREADY_MODE"] = "replay";
    const e = readEnv();
    expect(e.NEBIUS_BASE_URL).toBe("https://api.tokenfactory.nebius.com/v1/");
    expect(e.MERGEREADY_SIDECAR_URL).toBe("http://127.0.0.1:8787");
    expect(e.MERGEREADY_MAX_STEPS).toBe(6);
    expect(e.MERGEREADY_PR_MODE).toBe("dry");
    expect(e.MERGEREADY_BUDGET_USD).toBe(50);
    expect(e.MERGEREADY_RUN_BUDGET_USD).toBe(0.75);
    expect(e.MERGEREADY_JOBS_THRESHOLD).toBe(4);
    expect(e.BUILD_MARKER).toBe("dev");
    process.env["K_REVISION"] = "mergeready-00012-tfq";
    expect(readEnv().BUILD_MARKER).toBe("mergeready-00012-tfq");
    process.env["BUILD_MARKER"] = "abc1234";
    expect(readEnv().BUILD_MARKER).toBe("abc1234");
  });

  it("throws one aggregated error in live mode", () => {
    process.env["MERGEREADY_MODE"] = "live";
    expect(() => readEnv()).toThrow("missing required env: NEBIUS_API_KEY, TAVILY_API_KEY, CONTREE_PROFILE");
  });

  it("requires GITHUB_TOKEN only when PR mode is live", () => {
    process.env["MERGEREADY_MODE"] = "live";
    process.env["NEBIUS_API_KEY"] = "k";
    process.env["TAVILY_API_KEY"] = "k";
    process.env["CONTREE_PROFILE"] = "p";
    expect(() => readEnv()).not.toThrow();
    process.env["MERGEREADY_PR_MODE"] = "live";
    expect(() => readEnv()).toThrow("missing required env: GITHUB_TOKEN");
  });
});
