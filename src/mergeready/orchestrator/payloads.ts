// SPDX-License-Identifier: Apache-2.0
export interface IntakePayload { ticketId: string; title: string; repoUrl: string; branchBase: string; traceId: string; }
export interface GroundingResultView { title: string; url: string; snippet: string; }
export interface GroundingPayload { query: string; resultCount: number; results: GroundingResultView[]; citationsInPrompt: string[]; provider: "tavily"; fetchedAt: string; degraded: boolean; }
export interface BaselinePayload { tag: string; imageId: string; degraded: boolean; }
export interface ContextPackPayload { tokens: number; droppedFiles: string[]; strategy: string; contextWindow: number; }
export interface PlanningPayload { summary: string; stepCount: number; stepIds: string[]; modelId: string; degraded: boolean; }
export interface DraftPayload { stepId: string; file: string; diffBytes: number; diffSha256: string; modelId: string; degraded: boolean; }
export interface VerifyPayload { stepId: string; branchTag: string; parentTag: string; exitCode: number; verifiedSha: string; diffSha256: string; gateOk: boolean; gateReason: string; rolledBack: boolean; durationMs: number; stdout: string; stderr: string; degraded: boolean; }
export interface LedgerPayload { calls: number; promptTokens: number; completionTokens: number; usd: number; sandboxSeconds: number; runBudgetUsd: number; downgrades: { role: string; from: string; to: string; reason: string }[]; degraded: boolean; }
export interface PrPayload { title: string; body: string; branch: string; unifiedDiff: string; receiptMarkdown: string; url: string | null; acceptedCount: number; rejectedCount: number; mode: "dry" | "live"; degraded: boolean; }
