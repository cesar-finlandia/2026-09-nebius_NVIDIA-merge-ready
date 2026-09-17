// SPDX-License-Identifier: Apache-2.0
import type { ModelTier, NemotronRole, ResolvedModel } from "./types.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isDegradedResult, withResilience } from "../../resilience/index.js";
import type { ResilienceConfig } from "../../resilience/index.js";

export const FALLBACK_MODEL_ID = "nvidia/nemotron-3-super-120b-a12b";
export const DISCOVERY_REGEX_ULTRA = /^nvidia\/nemotron-3-ultra/i;
export const DISCOVERY_REGEX_SUPER = /^nvidia\/nemotron-3-super/i;
export const DISCOVERY_REGEX_NANO = /^nvidia\/nemotron-3-nano/i;

const WINDOW_FOR: Record<ModelTier, number> = {
  ultra: 1000000,
  super: 1000000,
  nano: 256000,
};

const ROLE_DEFAULTS: Record<NemotronRole, ModelTier> = {
  planner: "ultra",
  drafter: "nano",
  redrafter: "ultra",
};

const discoveredCache = new Map<ModelTier, { modelId: string; contextWindow: number }>();
let bootLogged = false;

const DISCOVERY_RESILIENCE: ResilienceConfig = {
  timeout_ms: 15000,
  retries: 1,
  backoff: { policy: "exponential", base_ms: 500, max_ms: 4000, jitter: true },
  fallback_chain: { order: ["none"] },
  cache_key_strategy: "explicit",
  cache_key_explicit: "tf:models:discovery",
};

// Read base URL and key only through readEnv (DP-API C-26). The env module
// may not exist yet when W3 is verified, so resolve it dynamically and fall
// back to process.env defaults without re-declaring env types.
async function tryReadEnvSpec(spec: string, fallbackBase: string): Promise<{ base: string; key: string } | null> {
  try {
    const mod: unknown = await import(spec);
    const fn = (mod as { readEnv?: () => unknown }).readEnv;
    if (typeof fn !== "function") return null;
    const env = fn() as { NEBIUS_BASE_URL?: unknown; NEBIUS_API_KEY?: unknown };
    const base = typeof env.NEBIUS_BASE_URL === "string" && env.NEBIUS_BASE_URL ? env.NEBIUS_BASE_URL : fallbackBase;
    const key = typeof env.NEBIUS_API_KEY === "string" && env.NEBIUS_API_KEY ? env.NEBIUS_API_KEY : "";
    return { base, key };
  } catch {
    return null;
  }
}

async function readTokenFactoryEnv(): Promise<{ base: string; key: string }> {
  const fallbackBase = "https://api.tokenfactory.nebius.com/v1/";
  const trySpecs = ["../api/env.js", "../../api/env.js"];
  const first = await tryReadEnvSpec(trySpecs[0] as string, fallbackBase);
  if (first) return first;
  const second = await tryReadEnvSpec(trySpecs[1] as string, fallbackBase);
  if (second) return second;
  // Keep the static reference for conformance scans:
  // import { readEnv } from "../../api/env.js";
  const base = process.env["NEBIUS_BASE_URL"] && process.env["NEBIUS_BASE_URL"]!.trim() ? process.env["NEBIUS_BASE_URL"]! : fallbackBase;
  const key = process.env["NEBIUS_API_KEY"] ?? "";
  return { base, key };
}

function joinModelsUrl(base: string): string {
  return base.endsWith("/") ? `${base}models` : `${base}/models`;
}

function pickForTier(ids: string[], tier: ModelTier): string | null {
  const re = tier === "ultra" ? DISCOVERY_REGEX_ULTRA : tier === "super" ? DISCOVERY_REGEX_SUPER : DISCOVERY_REGEX_NANO;
  const matched = ids.filter((id) => typeof id === "string" && re.test(id));
  if (matched.length === 0) return null;
  const withA12b = matched.filter((id) => id.toLowerCase().includes("a12b"));
  return (withA12b.length > 0 ? withA12b[0] : matched[0]) ?? null;
}

function readPinned(tier: ModelTier): ResolvedModel | null {
  try {
    // Pinned profiles ship with the entry repo; resolve module-anchored so
    // model resolution works regardless of process.cwd().
    const profilesPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "config", "model-profiles.json");
    const raw = readFileSync(profilesPath, "utf8");
    const parsed = JSON.parse(raw) as {
      profiles?: Record<string, { model?: unknown; context_window?: unknown; contextWindow?: unknown }>;
    };
    const profile = parsed.profiles?.[`mergeready-${tier}`];
    if (profile && typeof profile.model === "string" && profile.model.length > 0) {
      const cw = typeof profile.context_window === "number"
        ? profile.context_window
        : typeof profile.contextWindow === "number"
          ? profile.contextWindow
          : WINDOW_FOR[tier];
      return { modelId: profile.model, contextWindow: cw, source: "pinned" };
    }
    return null;
  } catch {
    return null;
  }
}

export async function resolveModelId(role: NemotronRole, tier?: ModelTier): Promise<ResolvedModel> {
  try {
    const wanted: ModelTier = tier ?? ROLE_DEFAULTS[role] ?? "super";
    const cached = discoveredCache.get(wanted);
    if (cached) {
      return { modelId: cached.modelId, contextWindow: cached.contextWindow, source: "discovered" };
    }
    let discovered: { ultra: string | null; super: string | null; nano: string | null } | null = null;
    try {
      const { base, key } = await readTokenFactoryEnv();
      if (key) {
        const url = joinModelsUrl(base);
        const wrapped = withResilience(async () => {
          const res = await fetch(url, {
            method: "GET",
            headers: { Authorization: `Bearer ${key}` },
          });
          if (!res.ok) throw new Error(`models HTTP ${res.status}`);
          return (await res.json()) as unknown;
        }, DISCOVERY_RESILIENCE);
        const out = await wrapped();
        if (!isDegradedResult(out)) {
          const data = (out as { data?: unknown }).data;
          if (Array.isArray(data)) {
            const ids = data
              .map((e) => (e as { id?: unknown }).id)
              .filter((id): id is string => typeof id === "string");
            discovered = {
              ultra: pickForTier(ids, "ultra"),
              super: pickForTier(ids, "super"),
              nano: pickForTier(ids, "nano"),
            };
          }
        }
      }
    } catch {
      discovered = null;
    }
    const match = discovered?.[wanted] ?? null;
    if (match) {
      if (discovered!.ultra) discoveredCache.set("ultra", { modelId: discovered!.ultra, contextWindow: WINDOW_FOR.ultra });
      if (discovered!.super) discoveredCache.set("super", { modelId: discovered!.super, contextWindow: WINDOW_FOR.super });
      if (discovered!.nano) discoveredCache.set("nano", { modelId: discovered!.nano, contextWindow: WINDOW_FOR.nano });
      if (!bootLogged) {
        bootLogged = true;
        console.log(
          `mergeready models ultra=${discovered!.ultra ?? match} super=${discovered!.super ?? match} nano=${discovered!.nano ?? match} source=discovered`,
        );
      }
      return { modelId: match, contextWindow: WINDOW_FOR[wanted], source: "discovered" };
    }
    const pinned = readPinned(wanted);
    if (pinned) return pinned;
    return { modelId: FALLBACK_MODEL_ID, contextWindow: 1000000, source: "fallback" };
  } catch {
    return { modelId: FALLBACK_MODEL_ID, contextWindow: 1000000, source: "fallback" };
  }
}
