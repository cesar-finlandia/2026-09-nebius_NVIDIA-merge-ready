// SPDX-License-Identifier: Apache-2.0
export interface HelpEntry {
  label: string;
  copy: string;
}

export const helpContent: Record<string, HelpEntry> = {
  plan: {
    label: "What is the plan?",
    copy: "The steps the planner derived from your ticket, with the grounding sources each one used. Every step here will be drafted, run in its own sandbox branch, and either merged or rolled back.",
  },
  "step-rail": {
    label: "What does the step rail show?",
    copy: "Every stage of the run, in order, with its live state. Draft writes a diff, verify runs the test suite against it. A red row means that attempt failed and was rolled back — which is the gate working, not the run breaking.",
  },
  "sandbox-matrix": {
    label: "What is the sandbox matrix?",
    copy: "One row per planned step, showing the branch it ran on, the test command, the exit code and the verdict. This is the evidence: nothing reaches the pull request without a green row here.",
  },
  "pr-preview": {
    label: "What is in the pull request?",
    copy: "Only the diffs whose sandbox row went green. Rolled-back attempts stay on the record above but never compose the PR.",
  },
  ledger: {
    label: "What do these numbers mean?",
    copy: "Model calls, prompt and completion tokens, and a cost estimate computed locally from the published price list — not a billing figure.",
  },
  receipt: {
    label: "What is the receipt?",
    copy: "A per-branch record of which model ran, what it cost and what it returned, so a reviewer can answer why they should believe this diff without rerunning it.",
  },
};

export const explainerCopy: { what: string; who: string; flow: string[]; howToRead: string } = {
  what: "Merge-Ready turns a repo ticket into a pull request it can prove.",
  who: "It is for developers who stopped trusting coding agents after a confident patch broke something — the review burden moves from reading diffs on faith to checking sandbox verdicts.",
  flow: [
    "One, paste a ticket.",
    "Two, the planner writes file-scoped steps.",
    "Three, each step is drafted and its test suite runs in its own sandbox branch — red rolls back, green stays.",
    "Four, only green diffs compose the pull request, with a receipt behind every claim.",
  ],
  howToRead:
    "Read the sandbox matrix row by row: branch, exit code, verdict. Green means executed and passing; rolled back means the gate did its job.",
};
