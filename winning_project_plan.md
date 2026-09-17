---
title: "Merge-Ready: sandbox-verified ticket-to-PR coding agent on Token Factory"
persona: "Burned coding-agent skeptic"
sponsor_tracks:
  - "Coding and Agentic Engineering"
grounded: true
---

# Merge-Ready — winning project plan

> Hand-selected (Stage-4 fallback): sweep LLM transport returned persistent provider 500s, so
> selection was done by hand from `pitch_candidates.json` (validated). Winner: pitch-06 (9.2),
> grounded in r/AI_Agents 2026-08 evidence. Runner-up: pitch-01 (9.0) — folds in as the cost-ledger
> angle of the same build.

## Executive Pitch

Small teams are starting to run coding tickets to merged PR unattended — but only when execution
feedback constrains the agent, not when prompts get cleverer. Merge-Ready is a ticket-to-PR coding
agent built for the **Coding and Agentic Engineering** track: it takes a repo ticket, plans the patch
with **Nemotron-3-Ultra via the Nebius Token Factory** OpenAI-compatible API, drafts diffs with
**Nemotron-3-Nano**, then executes and tests every candidate patch inside a branchable **Token Factory
Sandbox** that rolls back on red builds. Only green, test-passing diffs reach a pull request, each
carrying its plan, test log, and token-cost receipt.

It wins Technological Implementation through genuine Sandbox execution with rollback plus Ultra/Nano
reasoning-budget routing; Design through a complete ticket-to-merged-PR product loop with a live
working copy; Potential Impact through one specific user whose repo rot is measured in reverted PRs;
and Quality of the Idea through a non-obvious use — Sandboxes as the product and routing as the
pricing story, not a chatbot with a model key.

## Problem Framing

Paraphrased evidence (r/AI_Agents, 2026-08): practitioners report demo agents that plan, call tools,
write code and open PRs yet collapse near real production, with most companies adopting agents but
few running them in production; one small team ran 63 tickets from intake to merged PR unattended
over four months and found the breakthrough was constraining the agent (in their case removing a
tool), not prompt tuning; others describe agents that quietly lose the thread while continuing to
burn tokens. Severity: every untested AI diff is a future revert, and repo trust erodes with each
one. Workaround cost today: senior review time per diff plus reverted-PR churn. This pain is the
ideal vehicle for the Coding track because the track's core verb — agents that write, run, and test
code in Token Factory Sandboxes — is literally the missing piece in the evidence.

## AI Solution

Merge-Ready runs a four-capability loop, each mapped to the mandatory stack. (1) Intake and planning:
Nemotron-3-Ultra via Token Factory chat completions decomposes the ticket against the repo context
into a patch plan with file-level steps. (2) Drafting: Nemotron-3-Nano generates candidate diffs per
step, keeping fast calls cheap. (3) Verification: each diff executes in an isolated Token Factory
Sandbox branch running the repo's own test suite; red builds roll back instantly and feed the failure
back for one re-draft; only green diffs compose the PR. (4) Ledger: every run records model choice,
tests passed, and tokens burned, with auto-downgrade rules so a week's credit survives the week.

Why this stack wins the chosen track: the runtime Token Factory inference call plus Sandbox
write-run-test execution satisfies the "runs on" rule twice over; Nemotron Ultra/Nano routing is the
non-obvious technical core the track exists to reward; and the ledger turns the brief's credit
program into a demoable feature rather than a footnote.

## Why Now

Could this have been built two years ago with a form and a database and no AI model? No. It needs
tool-using code models with reasoning-budget control plus Git-branchable cloud Sandboxes with
instant rollback behind one OpenAI-compatible endpoint — a combination only now shippable, with
Nemotron 3's MoE hybrid architecture (256K context, NVFP4 efficiency) making the Ultra/Nano cost
ladder practical. The track timing is uniquely winnable now because Token Factory Sandboxes and the
Builder credit program turned agent-execution infrastructure from platform-team privilege into a
hackathon starter kit.

## Target Persona

The burned coding-agent skeptic: a senior dev (r/AI_Agents, r/programming, r/coding threads,
2026-04–08) who inherited AI-generated repos, rewrote them by hand, and trusts only green builds.
Focusing on this ONE persona maximizes Potential Impact and Design scores: the demo speaks their
language (diffs, test logs, reverts), and every feature traces to a quoted frustration instead of a
generic "developers" audience.

## Business Value

Specific user: senior devs and small teams running AI-assisted repos. TAM: teams paying for coding
agents plus reverted-PR rework — estimate, validate via IDEA-03 gallery scan and post-launch
interviews; no invented market figure is claimed here. Revenue model: per-seat SaaS for the
ticket-to-PR service plus overage on managed Sandbox minutes. Why AI: only tool-using Nemotron
models can plan multi-file patches, and only Sandbox execution can verify them — forms and databases
cannot write or test code. Track ROI: focusing on the single Coding track concentrates all
Sandbox/branching evidence where the rubric rewards it; chasing two tracks would dilute the execution
story that is this entry's entire edge. The Tavily bonus is claimed functionally (grounding ticket
context in current docs) without changing tracks.

## Architecture

Data flow: ticket + repo snapshot → Ultra planner (plan with file steps) → Nano drafters (diffs) →
Sandbox executor (branch, run suite, rollback or accept) → PR composer (plan + tests + cost receipt)
→ ledger UI. Agent/LLM responsibilities: Ultra owns decomposition and re-draft decisions; Nano owns
diff generation; a deterministic orchestrator (no LLM) owns branch lifecycle and merge gating, so a
model failure can never merge red code. Prompt boundaries: planner system prompt carries repo style
guide; drafter prompts carry single-file scope; no prompt ever authorizes merging. Corpus/docs needed:
repo under test, its suite, ticket text, optional Tavily-fetched docs. UI states: intake, planning
trace, sandbox matrix (branch × test result), PR preview with receipt, ledger dashboard.

Mandatory-stack wiring: LLM → Nemotron-3-Ultra and Nemotron-3-Nano via Token Factory
`https://api.tokenfactory.<region>.nebius.com/v1/` chat completions with `NEBIUS_API_KEY`; Agent
runtime → orchestrator plus Sandbox API (Contree SDK/MCP) for branch/run/rollback; Infra → Nebius
Serverless Endpoint serving the app with the 3-minute video showing the Token Factory call trace and
a live green-PR merge. Bonus integration: Tavily for ticket-context grounding (functional runtime
call, also gates the $3k bonus) — no other bonus pursued, not worth dilution.

### Hackathon Requirements & Compliance Matrix

| Requirement | Brief Verbatim | How This Plan Satisfies It | Judging Axis Evidenced |
|---|---|---|---|
| Mandatory Technologies | "All submissions must run on either Nebius Token Factory or Nebius AI Cloud and use at least one NVIDIA open source model" | Runtime Token Factory inference calls (Ultra + Nano) + Sandbox execution; ≥1 NVIDIA model throughout | Technological Implementation |
| Prize Tracks | "Coding and Agentic Engineering Track — agents that write, run, and test code in Token Factory Sandboxes" | Single-track focus; Sandbox write-run-test IS the product | Quality of the Idea |
| Judging Axes+Weights | Four equally weighted: Technological Implementation / Design / Potential Impact / Quality of the Idea | Each section evidences one axis; ledger + trace serve Implementation, loop serves Design | All four |
| Submission Gate | Working demo URL + public OSI-licensed repo with README + <3:00 public YouTube demo with Token Factory/Nemotron audio + feedback + track pick | Demo URL live through judging; repo with Apache-2.0/MIT at top; video opens on a live merge | Design |
| Rules | Original sole-owned work; pre-existing work only if significantly updated in-window with explanation | Built in-window; third-party SDKs only with authorization; no sponsor-funded derivation | (Eligibility) |

### Sponsored Track Strategy (1–2 tracks)

Focus: 1 track. Justification: the brief's submission form takes a single track pick, and the
strategy playbook caps focus at 1–2 to avoid dilution; this idea's entire edge (Sandbox execution
with rollback) lives inside the Coding track, so a second track would only blur the story. For the
Coding and Agentic Engineering track: the win-probability fit is maximal because the entry
demonstrates the track's exact verb with the sponsor's own Sandboxes imported and actually called
(branch, run, rollback — not a single API call), and the demo makes Sandbox execution the co-star
via the branch×test-result matrix on screen and in video audio.

### Bonus/Submission Gate (inside Architecture, final paragraph)

Submission gate satisfied via: public demo URL (live through judging), public repo with OSI license
visible at top plus README run instructions, <3:00 YouTube video opening on a live green-PR merge
with audio covering Token Factory and Nemotron usage, in-window-update explanation (new build),
feedback section completed (also gates Most Valuable Feedback), track pick set. Bonus pursued:
Best Use of Tavily via functional runtime grounding calls. No other bonus — not worth dilution.

## Suggested Module Emphasis

Advisory prose only (no manifest — ADV owns component decisions). Emphasize resilience wrappers with
golden caches around every Token Factory and Tavily call because live-inference demos die on venue
Wi-Fi; a context buffer for Ultra's long planner inputs; the cost guardrail tracking per-run token
spend against the $50 Builder credits because the ledger is a judged feature; platform deploy plus
mock-envelope UI streaming so the demo runs offline; dev-tooling verification (evals on planner
quality, track staleness) because prompt changes mid-event must not regress the demo; provenance and
submission formatting because the OSI license file, README, and video-audio proof are Stage-One
gates; synthetic data only if the demo repo needs a seeded fixture corpus.
