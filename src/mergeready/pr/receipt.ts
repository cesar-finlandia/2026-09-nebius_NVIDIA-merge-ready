// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from "node:fs";
import type { CostReceipt } from "../ledger/types.js";

export interface ReceiptRow {
  role: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  usd: number;
}

export type RenderReceiptFn = (
  receipt: CostReceipt | null,
  modelByRole: Record<string, string>,
  tokensByRole: Record<string, { promptTokens: number; completionTokens: number }>,
) => string;

interface PricingFile {
  usd_per_1k_prompt?: Record<string, number>;
  usd_per_1k_completion?: Record<string, number>;
  usd_per_sandbox_minute?: number;
  roleTier?: Record<string, string>;
}

let cachedPricing: PricingFile | null = null;

function loadPricing(): PricingFile {
  if (cachedPricing) return cachedPricing;
  try {
    const url = new URL("../../../config/mergeready-pricing.json", import.meta.url);
    cachedPricing = JSON.parse(readFileSync(url, "utf8")) as PricingFile;
  } catch {
    cachedPricing = {};
  }
  return cachedPricing as PricingFile;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export const renderReceiptMarkdown: RenderReceiptFn = (receipt, modelByRole, tokensByRole) => {
  if (receipt === null) {
    return "## Cost receipt\n\nNo receipt — ledger unavailable for this run. All USD figures below are est.\n";
  }
  const pricing = loadPricing();
  const perPrompt = pricing.usd_per_1k_prompt ?? {};
  const perCompletion = pricing.usd_per_1k_completion ?? {};
  const sandboxRate = typeof pricing.usd_per_sandbox_minute === "number" ? pricing.usd_per_sandbox_minute : 0.01;
  const roleTier = pricing.roleTier ?? {};
  const roleRows: string[] = [];
  for (const role of ["planner", "drafter", "redrafter"]) {
    const toks = (tokensByRole as Record<string, { promptTokens: number; completionTokens: number } | undefined>)[role];
    if (!toks) continue;
    const tier = roleTier[role] ?? "unknown";
    const promptRate = perPrompt[tier] ?? perPrompt["unknown"] ?? 0;
    const completionRate = perCompletion[tier] ?? perCompletion["unknown"] ?? 0;
    const usd = round4((toks.promptTokens / 1000) * promptRate + (toks.completionTokens / 1000) * completionRate);
    const model = (modelByRole as Record<string, string | undefined>)[role] ?? "n/a";
    roleRows.push(`| ${role} | ${model} | ${toks.promptTokens} | ${toks.completionTokens} | est. $${usd} |`);
  }
  const sandboxMinutes = round4(receipt.sandboxSeconds / 60);
  const sandboxUsd = round4(sandboxMinutes * sandboxRate);
  const downgradeLines =
    receipt.downgrades.length === 0
      ? "No downgrades — full-tier run."
      : receipt.downgrades.map((d) => `- ${d.role}: ${d.from} -> ${d.to} (${d.reason})`).join("\n");
  return (
    `## Cost receipt\n` +
    `trace \`${receipt.traceId}\` — ${receipt.calls} calls, ${receipt.promptTokens} prompt + ${receipt.completionTokens} completion tokens.\n` +
    `\n` +
    `| role | model | prompt | completion | cost |\n` +
    `|---|---|---|---|---|\n` +
    (roleRows.length > 0 ? roleRows.join("\n") + "\n" : "") +
    `| total | — | ${receipt.promptTokens} | ${receipt.completionTokens} | est. $${receipt.usd} |\n` +
    `| sandbox | — | — | — | ${sandboxMinutes} min / est. $${sandboxUsd} |\n` +
    `\n` +
    `### Downgrades\n` +
    `${downgradeLines}\n`
  );
};
