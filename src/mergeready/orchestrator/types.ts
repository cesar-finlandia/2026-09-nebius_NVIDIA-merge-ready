// SPDX-License-Identifier: Apache-2.0
export interface Ticket {
  id: string;
  title: string;
  body: string;
  repoUrl: string;
  branchBase: string;
}

export interface RunArgs {
  ticket: Ticket;
  snapshot: import("src/mergeready/context/snapshot.js").RepoSnapshot;
  traceId: string;
  publish: import("src/platform/transport").Publisher;
}

export interface RunResult {
  traceId: string;
  accepted: import("src/mergeready/prompts/schemas.js").PlanStep[];
  rejected: import("src/mergeready/prompts/schemas.js").PlanStep[];
  proposal: import("src/mergeready/pr/compose.js").PrProposal | null;
  receipt: import("src/mergeready/ledger/types.js").CostReceipt | null;
  degraded: boolean;
}
