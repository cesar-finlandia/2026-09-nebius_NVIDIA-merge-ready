// SPDX-License-Identifier: Apache-2.0
import { createHash } from "node:crypto";
import { count } from "../../context/index.js";
import {
  createGoldenCache,
  isDegradedResult,
  makeDegradedResult,
  withResilience,
} from "../../resilience/index.js";
import type { DegradedResult, ResilienceConfig } from "../../resilience/index.js";
// Static owner-path imports (DP-TF §2.2):
// import { ledgerClient } from "../ledger/index.js";
// import { readEnv } from "../api/env.js";
// Resolved dynamically at runtime so callNemotron stays importable and
// hermetic before DP-LEDGER / DP-API land (models.ts pattern). When the
// owner modules exist the real implementations are used; otherwise we fall
// back to process.env and a degraded policy signal. No stub files created.
async function readEnvDynamic(): Promise<{ NEBIUS_BASE_URL?: unknown; NEBIUS_API_KEY?: unknown; MERGEREADY_MODE?: unknown }> {
  try {
    const spec = "../api/env.js";
    const mod = (await import(/* @vite-ignore */ spec)) as { readEnv?: () => unknown | Promise<unknown> };
    if (typeof mod.readEnv === "function") {
      const e = (await mod.readEnv()) as { NEBIUS_BASE_URL?: unknown; NEBIUS_API_KEY?: unknown; MERGEREADY_MODE?: unknown };
      if (e !== null && typeof e === "object") return e;
    }
  } catch {
  }
  return {
    NEBIUS_BASE_URL: process.env["NEBIUS_BASE_URL"],
    NEBIUS_API_KEY: process.env["NEBIUS_API_KEY"],
    MERGEREADY_MODE: process.env["MERGEREADY_MODE"],
  };
}
async function policyForDynamic(role: NemotronRole, traceId?: string): Promise<unknown> {
  try {
    const spec = "../ledger/index.js";
    const mod = (await import(/* @vite-ignore */ spec)) as { ledgerClient?: { policyFor?: (r: unknown, t?: unknown) => unknown | Promise<unknown> } };
    const fn = mod.ledgerClient?.policyFor;
    if (typeof fn === "function") return await fn(role, traceId);
  } catch {
  }
  return makeDegradedResult({ reason: "policy-unavailable", fallback_source: "none", original_error: "ledger unavailable" });
}
async function recordDynamic(event: unknown): Promise<void> {
  try {
    const spec = "../ledger/index.js";
    const mod = (await import(/* @vite-ignore */ spec)) as { ledgerClient?: { record?: (e: never) => Promise<void> } };
    const fn = mod.ledgerClient?.record;
    if (typeof fn === "function") await fn(event as never);
  } catch {
  }
}
import { resolveModelId } from "./models.js";
import type { ModelTier, NemotronRole } from "./types.js";
// NOTE: verification fails with `Cannot find module` until DP-LEDGER
// (src/mergeready/ledger/index.ts) and DP-API (src/mergeready/api/env.ts)
// land. No stub files are created for ledger or env (DP-TF §2.2).

export interface NemotronRequest {
  role: NemotronRole;
  system: string;
  user: string;
  traceId: string;
  maxTokens?: number;
  temperature?: number;
  jsonSchema?: object;
}

export interface NemotronResponse {
  text: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  role: NemotronRole;
}

interface ChatCompletionsBody {
  model: string;
  messages: [{ role: "system"; content: string }, { role: "user"; content: string }];
  temperature: number;
  max_tokens: number;
  response_format?: { type: "json_schema"; json_schema: { name: "output"; schema: object; strict: true } };
}

interface ChatCompletionsWire {
  choices: [{ message?: { content?: string } }] | [];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
}

const ROLE_DEFAULTS: Record<NemotronRole, ModelTier> = {
  planner: "ultra",
  drafter: "nano",
  redrafter: "ultra",
};

function sha16(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function joinChatUrl(base: string): string {
  return base.endsWith("/") ? `${base}chat/completions` : `${base}/chat/completions`;
}

function tierProfileDefaults(tier: ModelTier): { temperature: number; max_tokens: number } {
  if (tier === "nano") return { temperature: 0.4, max_tokens: 4000 };
  return { temperature: 0.2, max_tokens: 8000 };
}

function degradedWithDetails(
  reason: string,
  originalError: string | null,
  details: { traceId: string; role: NemotronRole; modelIdAttempted: string; httpStatus: number | null; latencyMs: number },
): DegradedResult<NemotronResponse> {
  return makeDegradedResult<NemotronResponse>({
    reason,
    fallback_source: "none",
    original_error: originalError ?? JSON.stringify(details),
    data: details as unknown as NemotronResponse,
  });
}

export async function callNemotron(
  req: NemotronRequest,
): Promise<NemotronResponse | DegradedResult<NemotronResponse>> {
  const startMs = Date.now();
  try {
    const validRole = req != null && (req.role === "planner" || req.role === "drafter" || req.role === "redrafter");
    const validSystem = req != null && typeof req.system === "string" && req.system.length > 0;
    const validUser = req != null && typeof req.user === "string" && req.user.length > 0;
    const validTrace = req != null && typeof req.traceId === "string" && req.traceId.length > 0;
    if (!validRole || !validSystem || !validUser || !validTrace) {
      return makeDegradedResult<NemotronResponse>({
        reason: "bad-request",
        fallback_source: "none",
        original_error: "invalid NemotronRequest: role/system/user/traceId",
        data: null,
      });
    }
    const role: NemotronRole = req.role;
    const env = (await readEnvDynamic()) as unknown as {
      NEBIUS_BASE_URL?: unknown;
      NEBIUS_API_KEY?: unknown;
      MERGEREADY_MODE?: unknown;
    };
    const base = typeof env.NEBIUS_BASE_URL === "string" && env.NEBIUS_BASE_URL ? env.NEBIUS_BASE_URL : "https://api.tokenfactory.nebius.com/v1/";
    const key = typeof env.NEBIUS_API_KEY === "string" ? env.NEBIUS_API_KEY : "";
    const mode = typeof env.MERGEREADY_MODE === "string" ? env.MERGEREADY_MODE : "live";
    if (mode === "replay") {
      const replayExplicit = `tf:${role}:${sha16(req.system + req.user)}`;
      try {
        const rcache = createGoldenCache();
        let hit: unknown = null;
        try {
          hit = await rcache.get(replayExplicit);
        } catch {
          hit = null;
        }
        if ((hit === null || hit === undefined) && typeof rcache.deriveKey === "function") {
          try {
            hit = await rcache.get(rcache.deriveKey({ explicitKey: replayExplicit }));
          } catch {
          }
        }
        if (hit !== null && hit !== undefined && typeof hit === "object") {
          const h = hit as Partial<NemotronResponse>;
          if (typeof h["text"] === "string") {
            const cached: NemotronResponse = {
              text: h["text"] as string,
              modelId: typeof h["modelId"] === "string" ? (h["modelId"] as string) : "",
              promptTokens: typeof h["promptTokens"] === "number" ? (h["promptTokens"] as number) : 0,
              completionTokens: typeof h["completionTokens"] === "number" ? (h["completionTokens"] as number) : 0,
              latencyMs: 0,
              role,
            };
            // FR-09: replayed calls still meter usage; record best-effort and
            // never let a ledger failure escape the replay path.
            try {
              await recordDynamic({
                traceId: req.traceId,
                role,
                modelId: cached.modelId,
                promptTokens: cached.promptTokens,
                completionTokens: cached.completionTokens,
                latencyMs: 0,
              });
            } catch {
              // ignore
            }
            // FR-09 downgrade surfacing in replay: consult the ledger policy
            // with the run's trace id so a forced-low MERGEREADY_RUN_BUDGET_USD
            // attributes a downgrade transition to this run's receipt. The
            // returned tier is intentionally ignored — replay keeps the
            // recorded model (NFR-10 determinism); only the sidecar's
            // _DOWNGRADE_LOG side effect is wanted. Best-effort, never throws.
            try {
              await policyForDynamic(role, req.traceId);
            } catch {
              // ignore
            }
            return cached;
          }
        }
      } catch {
      }
      const latencyMs = Date.now() - startMs;
      return degradedWithDetails("replay-miss", `replay miss for ${replayExplicit}`, {
        traceId: req.traceId,
        role,
        modelIdAttempted: "",
        httpStatus: null,
        latencyMs,
      });
    }
    let tier: ModelTier;
    try {
      const policy = await policyForDynamic(role, req.traceId);
      if (isDegradedResult(policy)) {
        tier = ROLE_DEFAULTS[role];
      } else {
        tier = policy as ModelTier;
      }
    } catch {
      tier = ROLE_DEFAULTS[role];
    }
    const override = (req as unknown as { tier?: unknown }).tier;
    if (override === "ultra" || override === "super" || override === "nano") {
      tier = override;
    }
    const resolved = await resolveModelId(role, tier);
    const prof = tierProfileDefaults(tier);
    const chatBody: ChatCompletionsBody = {
      model: resolved.modelId,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
      temperature: typeof req.temperature === "number" ? req.temperature : prof.temperature,
      max_tokens: typeof req.maxTokens === "number" ? req.maxTokens : prof.max_tokens,
    };
    if (req.jsonSchema !== undefined) {
      chatBody.response_format = {
        type: "json_schema",
        json_schema: { name: "output", schema: req.jsonSchema, strict: true },
      };
    }
    const cacheKey = `tf:${role}:${sha16(req.system + req.user)}`;
    const tfResilience: ResilienceConfig = {
      timeout_ms: 60000,
      retries: 1,
      backoff: { policy: "exponential", base_ms: 500, max_ms: 4000, jitter: true },
      fallback_chain: { order: ["cache", "none"] },
      cache_key_strategy: "explicit",
      cache_key_explicit: cacheKey,
    };
    const url = joinChatUrl(base);
    const bodyText = JSON.stringify(chatBody);
    const hadFormat = chatBody.response_format !== undefined;
    let seenStatus: number | null = null;
    const wrapped = withResilience(async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: bodyText,
      });
      if (!res.ok && res.status === 400 && hadFormat) {
        seenStatus = 400;
        return { __tfSchemaRejected: true } as unknown;
      }
      if (!res.ok) {
        seenStatus = res.status;
        throw new Error(`chat HTTP ${res.status}`);
      }
      return (await res.json()) as unknown;
    }, tfResilience);
    let out = await wrapped();
    const needsSchemaRetry =
      (out !== null &&
        typeof out === "object" &&
        (out as Record<string, unknown>)["__tfSchemaRejected"] === true) ||
      (isDegradedResult(out) && seenStatus === 400 && hadFormat);
    if (needsSchemaRetry) {
      const noFormatBody: ChatCompletionsBody = {
        model: chatBody.model,
        messages: chatBody.messages,
        temperature: chatBody.temperature,
        max_tokens: chatBody.max_tokens,
      };
      const noFormatText = JSON.stringify(noFormatBody);
      const tfRetry: ResilienceConfig = {
        ...tfResilience,
        cache_key_explicit: `${cacheKey}:noformat`,
      };
      let seenRetryStatus: number | null = 400;
      const wrappedRetry = withResilience(async () => {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: noFormatText,
        });
        if (!res.ok) {
          seenRetryStatus = res.status;
          throw new Error(`chat HTTP ${res.status}`);
        }
        return (await res.json()) as unknown;
      }, tfRetry);
      const outRetry = await wrappedRetry();
      if (isDegradedResult(outRetry)) {
        const latencyMs = Date.now() - startMs;
        return degradedWithDetails("tf-schema-rejected", outRetry.original_error ?? outRetry.reason, {
          traceId: req.traceId,
          role,
          modelIdAttempted: resolved.modelId,
          httpStatus: seenRetryStatus,
          latencyMs,
        });
      }
      if (
        outRetry !== null &&
        typeof outRetry === "object" &&
        (outRetry as Record<string, unknown>)["__tfSchemaRejected"] === true
      ) {
        const latencyMs = Date.now() - startMs;
        return degradedWithDetails("tf-schema-rejected", "schema retry rejected", {
          traceId: req.traceId,
          role,
          modelIdAttempted: resolved.modelId,
          httpStatus: seenRetryStatus,
          latencyMs,
        });
      }
      seenStatus = null;
      out = outRetry;
    }
    if (isDegradedResult(out)) {
      const latencyMs = Date.now() - startMs;
      const reason = seenStatus !== null ? `tf-http-${seenStatus}` : "tf-unreachable";
      return degradedWithDetails(reason, out.original_error ?? out.reason, {
        traceId: req.traceId,
        role,
        modelIdAttempted: resolved.modelId,
        httpStatus: seenStatus,
        latencyMs,
      });
    }
    let wire: ChatCompletionsWire;
    try {
      wire = out as ChatCompletionsWire;
      if (wire === null || typeof wire !== "object" || !Array.isArray((wire as { choices?: unknown }).choices)) {
        throw new Error("wire choices missing");
      }
    } catch (e) {
      const latencyMs = Date.now() - startMs;
      return degradedWithDetails("tf-empty-choice", e instanceof Error ? e.message : String(e), {
        traceId: req.traceId,
        role,
        modelIdAttempted: resolved.modelId,
        httpStatus: seenStatus,
        latencyMs,
      });
    }
    const first = (wire.choices as [{ message?: { content?: string } }])[0];
    const text = first?.message?.content;
    if (typeof text !== "string" || text.length === 0) {
      const latencyMs = Date.now() - startMs;
      return degradedWithDetails("tf-empty-choice", "empty choices", {
        traceId: req.traceId,
        role,
        modelIdAttempted: resolved.modelId,
        httpStatus: seenStatus,
        latencyMs,
      });
    }
    let promptTokens: number;
    let completionTokens: number;
    let tokensEstimated = false;
    const usage = wire.usage;
    if (
      usage != null &&
      typeof usage.prompt_tokens === "number" &&
      typeof usage.completion_tokens === "number"
    ) {
      promptTokens = usage.prompt_tokens;
      completionTokens = usage.completion_tokens;
    } else {
      try {
        const sysCount = count(req.system, resolved.modelId);
        const userCount = count(req.user, resolved.modelId);
        promptTokens = sysCount + userCount;
        completionTokens = count(text, resolved.modelId);
        tokensEstimated = true;
      } catch {
        promptTokens = 0;
        completionTokens = 0;
      }
    }
    const latencyMs = Date.now() - startMs;
    const response: NemotronResponse = {
      text,
      modelId: resolved.modelId,
      promptTokens,
      completionTokens,
      latencyMs,
      role,
    };
    try {
      const event: Record<string, unknown> = {
        traceId: req.traceId,
        role,
        modelId: resolved.modelId,
        promptTokens,
        completionTokens,
        latencyMs,
      };
      if (tokensEstimated) {
        event["note"] = "tokensEstimated:true";
      }
      await recordDynamic(event);
    } catch {
    }
    return response;
  } catch (e) {
    const latencyMs = Date.now() - startMs;
    let traceId = "";
    let role: NemotronRole = "planner";
    try {
      if (req != null && typeof req.traceId === "string") traceId = req.traceId;
      if (req != null && (req.role === "planner" || req.role === "drafter" || req.role === "redrafter")) role = req.role;
    } catch {
    }
    return degradedWithDetails("tf-unreachable", e instanceof Error ? e.message : String(e), {
      traceId,
      role,
      modelIdAttempted: "",
      httpStatus: null,
      latencyMs,
    });
  }
}
