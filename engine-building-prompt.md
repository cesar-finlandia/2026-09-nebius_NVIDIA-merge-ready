# TASK — Generate the Master Blueprint + Design Plans for this hackathon entry

You are a principal engineer preparing a hackathon entry for implementation by
**low-intelligence AI models** driven by `run_sweep.sh --planner` and
`run_sweep.sh --sequence`. Your job: read the material below, then produce ONE
Master Blueprint plus a set of chassis-format design plans that those sweeps will
implement verbatim. The goal is simple and absolute: **maximize the probability
of winning the grand prize AND the Coding and Agentic Engineering track prize**
(Nebius x NVIDIA Global AI Hackathon — four tracks, one primary track per entry).

## READ FIRST (in this order)

1. `hackathon-projects/2026-09-nebius_NVIDIA/winning_project_plan.md` — the selected idea, architecture spec,
   and suggested module emphasis (centralized layout; legacy private/pgm/ is deprecated). This is the source of truth for WHAT we build.
2. `hackathon-projects/2026-09-nebius_NVIDIA/proposal.json` — Component Advisor output: which chassis modules
   were selected/excluded and why. If it is absent, read
   `contracts/component-catalog.json` and assume all twelve components with the
   advisor's minimal-viable defaults.
3. `contracts/component-catalog.json` — what each selected chassis module
   already provides (do NOT redesign chassis behavior; compose it).
4. The chassis design plan for EACH selected module. Mapping (module → plans in
   `design_documents/design_plans/`):

   | module | design plan(s) |
   |---|---|
   | resilience | DP-A-resilience-layer.md |
   | platform | DP-B-platform-layer.md |
   | ideation | DP-D1-ideation-hour0.md, DP-D2a-deckgen-script.md, DP-D2b-demodrive-faqdef.md |
   | context | DP-E-context-buffer-manager.md |
   | dev-tooling | DP-F1-local-dev-single-checks.md, DP-F2-local-dev-cross-checks.md |
   | cost | DP-I-cost-usage-guardrail.md |
   | provenance | DP-J-provenance-disclosure-toolkit.md |
   The table is pre-filtered to the modules marked included:true in hackathon-projects/2026-09-nebius_NVIDIA/proposal.json (centralized layout; legacy private/pgm/proposal.json is deprecated).
   Read ONLY the rows whose module is included:true in `hackathon-projects/2026-09-nebius_NVIDIA/proposal.json`;
   skip excluded modules entirely — never design against a module the manifest excludes.
   **Precedence rule: if this prompt's enumerations conflict with
   `hackathon-projects/2026-09-nebius_NVIDIA/proposal.json`, the manifest wins.**
   Your plans must CALL INTO these modules, never re-implement them.
5. `design_documents/lablab_hackathon_strategy_blueprint.md` — §5 (rules
   confirmations) and §7 (the per-hackathon playbook you are automating).
  6. `hackathon-projects/2026-09-nebius_NVIDIA/event_profile.json` — NOTE: this file was
     NOT produced for this event (profile extraction skipped: no LLM keys at Hour 0).
     Fall back to `hackathon_brief.md` §2 (prizes, schedule table, submission checklist,
     judging table, resources) as the source for tracks, criteria, and deadlines.

## MANDATORY COMPLIANCE — DISQUALIFICATION-LEVEL (extract before any design)
Before drafting any blueprint section, scan `hackathon-projects/2026-09-nebius_NVIDIA/winning_project_plan.md` + its
source `hackathon-projects/2026-09-nebius_NVIDIA/hackathon_brief.md` (§4 Hackathon Rules - Requirements - Tracks) and the live *Hackathon-page* https://nebiusglobalaihackathon.devpost.com for verbatim. This event is Nebius x NVIDIA on Devpost — do not copy WebMCP/Gemini/ADK/GCP requirements from other hackathons.
- MANDATORY TECHNOLOGIES (Stage One pass/fail): **runtime call to the Nebius Token Factory inference API (OpenAI-compatible, `NEBIUS_API_KEY`) OR deploy/run on Nebius AI Cloud compute (Serverless Jobs / Serverless Endpoints / DevPods), PLUS at least one NVIDIA open-source model.** For this entry: **Nemotron-3-Ultra (planning/reasoning) + Nemotron-3-Nano (fast drafting) via Token Factory chat completions, plus Token Factory Sandboxes branch/test/rollback execution.** Verify exact servable model IDs against https://docs.tokenfactory.nebius.com before freezing. No Gemini/Vertex/Cloud Run/Firestore anywhere — emitting those names is a disqualification-level error.
- PRIZE TRACKS: **exactly 1 primary track for this entry: Coding and Agentic Engineering** ("agents that write, run, and test code in Token Factory Sandboxes"). Overall cash (Grand $20k / 2nd $10k / 3rd $6k) is judged across all entries; track winner receives an NVIDIA Jetson Orin Nano. Bonus overlays (not tracks): Best Use of Tavily ($3k, functional runtime Tavily call — this entry grounds ticket context with Tavily), City Winner, Most Valuable Feedback. Judging: Stage One pass/fail (fits theme + reasonably applies required APIs), Stage Two **four equally weighted** — Technological Implementation / Design / Potential Impact / Quality of the Idea (non-obvious Nemotron + Token Factory use).
- SUBMISSION GATE: **working demo URL** live and free through judging (login credentials in form if private); **text description** highlighting NVIDIA model usage + where Token Factory accelerated the workflow; **public OSI-licensed repo** (Apache-2.0/MIT, license visible at top) with README setup/run guidance; **demonstration video <3 minutes, public YouTube**, opening on the working product with **audio covering Token Factory + Nemotron usage**; completed Devpost form incl. track pick + feedback section by **2026-10-30 10:00 PDT (17:00 UTC)**; multiple submissions allowed only if unique/substantially different (this entry's sibling entry-2 differs in product, track, video, evidence).
- BONUS: **Best Use of Tavily pursued functionally** (ticket-context grounding calls, not a bolt-on); no other bonus — not worth dilution.
These are Stage-One pass/fail — a missing mandatory tech = disqualified regardless of idea quality. Therefore:
- §1 Requirements MUST trace each mandatory tech from the brief to a winning-plan section and to a Judging axis: "Nemotron-3-Ultra planning + Nemotron-3-Nano drafting via Token Factory → Technological Implementation; Sandbox branch/test/rollback execution → Technological Implementation + Quality of the Idea; per-run cost ledger → Potential Impact; live green-PR merge + <3min video proof → Design".
- §2 Architecture MUST name the chosen mandatory stack (Ultra/Nano model IDs + Token Factory call method, Sandbox branch/run/rollback API, Serverless Endpoint serving with video capture plan showing the Token Factory call trace and a live merge) and diagram wiring. Never name Gemini/Vertex/Cloud Run/Firestore — they are not part of this event.
- §3 Design-plan map MUST allocate a work unit to each mandatory proof artifact (Sandbox-verified deploy, diagram, <3min video merge segment with Token Factory/Nemotron audio, spin-up).
- sponsor_tracks choice must be justified as the highest win-probability track for this idea — not "empty" when brief names tracks.
- Bonus is opt-in only: Tavily is pursued functionally in this entry; any other bonus only when its prize outweighs dilution, otherwise explicitly state "no other bonus".

## DELIVERABLES (exact paths) — exactly THREE artifacts, nothing else

This chat produces ONLY the blueprint, the plan-generation prompts, and the
sequential-run config. The fully defined design plans are authored LATER, one
per fresh chat window, by executing the prompts you create here.

1. `private/design_documents/master_blueprint_entry.md` — the entry's master
    blueprint:
    - §1 Requirements: functional + non-functional, each traced back to
      winning_project_plan.md sections and event judging criteria.
    - §2 Architecture: components, data flow, envelope/transport wiring from
      engine to the assembled UI (EventEnvelope shape, useEventStream()), plus
      an explicit inter-module contract table: every cross-module function/type/file
      is owned by exactly one module — with file path, export name, and
      input/output shape — so consumers know what to import and never re-implement
      or stub it.
    - §3 Design-plan map: EVERY design plan needed to build the entry — one row
      per plan with id (`DP-<TOPIC>`), title, scope boundaries, the interfaces
      it owns (inputs/outputs/paths), its consumers, its dependencies on other plans,
      and the requirements each of its work units must fulfill when written. This map
      together with §2 is the single binding contract between all follow-up chats.
    - §3a Inter-module boundary rule (why §2+§3 must be in-depth): the blueprint is
      the ONLY shared context between independent authoring chats. If it is vague,
      one module will expose foo() while another independently creates its own
      foo() or stub and neither is used — resulting in disconnected, duplicate
      implementations. To prevent this, §2+§3 must be exhaustive: every
      provider-consumer pair is named once, with owning module, file, export, and
      shape, so authors import rather than duplicate.
    - §4 Submission checklist mapping: deployed public URL, public repo,
      disclosure doc, deck/script/demo — which design plan produces which.
    - §5 Risks + degraded-demo fallback ladder.
2. `private/design_documents/prompts/PROMPT-DP-<TOPIC>.md` — ONE prompt per
   plan listed in §3. Each must be FULLY SELF-CONTAINED: executing it in a
   FRESH chat window (operator types only "Read and execute
   private/design_documents/prompts/PROMPT-DP-<TOPIC>.md") yields the complete,
   chassis-format design plan at
   `private/design_documents/design_plans/DP-<TOPIC>.md` without reading any
   other file.

**DO NOT write the design plans themselves in this chat.** If your output
contains files under `design_plans/`, you have violated this instruction.
3. `run_sequential_md.conf` (repository root) — the sequential authoring config
consumed by `bash run_sweep.sh --sequencemd`. It contains EXACTLY one line per
plan listed in §3 (e.g. 10 plans → 10 lines, no more, no fewer), each line in
the form `role|private/design_documents/prompts/PROMPT-DP-<TOPIC>.md`
(default role `standard|`, e.g.
`standard|private/design_documents/prompts/PROMPT-DP-AUTH.md`), in the same
order as the §3 design-plan map. This file is what lets the operator author
every plan with a single sweep command instead of opening one chat per plan.

## HARD QUALITY BAR — the implementor is a LOW-INTELLIGENCE model

Encode this bar into §2+§3 of the blueprint AND into every PROMPT-DP-*.md file, so
the author chats produce design plans under which the implementor cannot infer
anything and no two plans duplicate the same cross-module contract:

- fully define every contract: exact file paths, exported names, function
  signatures, input/output JSON shapes — and for cross-module contracts,
  state owning module, file, export, and all consuming modules (single owner,
  N consumers; consumers MUST import, never re-define or stub);
- spell out every algorithm as numbered steps or pseudocode — no "use judgment",
  no "as appropriate", no unstated defaults;
- every work unit ends with one runnable verification command and its expected
  output (for cross-module work units, the command must exercise the actual
  provider→consumer import);
- if a task genuinely requires higher intelligence, split it until it does not,
  or move that part into a prompt template the runtime LLM call receives.

## CONSTRAINTS

- Engine code lives ONLY inside the assembled working copy
  (`../hackathon-entries/<entry>`): `engine/` stubs marked TODO(ENGINE) plus
  new files under `src/`. NEVER modify the chassis repo's `src/`.
- Compose chassis modules via their documented CLIs/APIs; wrap every outbound
  LLM call with `withResilience`; emit progress as EventEnvelopes so the
  platform UI streams it.
- Budget honesty: prefer deterministic code over extra LLM calls; degrade
  gracefully (DegradedResult) instead of crashing mid-demo.

## FINISH

Print the list of generated files (blueprint + PROMPT-DP-*.md + run_sequential_md.conf) and stop. Do NOT
write anything under design_plans/ and do NOT implement anything yourself.
