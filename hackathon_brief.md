# hackathon_brief.md — 2026-09-nebius_NVIDIA (Nebius x NVIDIA Global AI Hackathon, Devpost)

> **Provenance:** transcribed on 2026-09-03 (UTC) — DEFINITIVE kickoff-day version.
> Source: *Hackathon-page* https://nebiusglobalaihackathon.devpost.com/ + all tabs read on 2026-09-03:
> Overview (`/`), Rules (`/rules`), Resources (`/resources`), Schedule (`/details/dates`),
> Updates (`/updates` + update `/updates/46184-...`), Discussions (`/forum_topics` + topic `/forum_topics/45074-...`).
> Binding linked pages consulted: Nebius Builder Program (https://dev.nebius.com/builders),
> Token Factory docs/API reference, Nemotron-on-Token-Factory pages (see §2 Official resources).
> Convention: items marked `[unconfirmed]` were not published on the event site as of transcription time —
> resolve via kickoff stream / Q&A / Discord before building on them.
> Discord (https://discord.gg/ZdC3rXMJH per Resources tab) could not be verified without login — treated as `[unconfirmed]`.
> No kickoff live-stream replay was published on the Devpost tabs as of transcription time — `[unconfirmed]`.
> Purpose: single paste-input for `src/profile` (Event Profile Extractor) and `src/pgm`
> (Problem Grounding Engine), per TU16 (`docs/tutorials/TU16-mock-hackathon-walkthrough.md`).
> Classification: **DEFINED** — the binding challenge, 4 tracks, mandated stack, deliverables,
> judging criteria and rules are published (quoted in §4).

---

# Nebius x NVIDIA Global AI Hackathon — Official Brief

**Build the next frontier of AI on open infrastructure**

🌎 Online Hackathon · 💻 Global / Public · 📅 Submission Period 2026-08-26 → 2026-10-30 · 🏆 $50,000 cash + 4× NVIDIA Jetson Orin Nano + swag (see §2 Prizes table)

> Intro (summary): online global hackathon run by Nebius with NVIDIA on Devpost for AI builders, ML engineers and founders to ship practical high-performance AI on open independent infrastructure — NVIDIA open-source models served on Nebius through Nebius Token Factory, on high-performance GPU infrastructure. 2103 participants listed on 2026-09-03. IRL companion series "Builders & Brews: Hack Edition" (Nebius + Tavily) in 20 cities; attendance optional, unlocks City Winner eligibility + extra credits (amounts `[unconfirmed]`).

## Challenge / tracks — summary only (see §4 for verbatim)

- Binding rule in one line: every submission must run on Nebius Token Factory or Nebius AI Cloud AND use ≥1 NVIDIA open-source model — see §4 for verbatim definition of "runs on" + the 4 tracks.
- 4 tracks (pick one per submission): (1) Coding and Agentic Engineering, (2) Best Apps and Agents, (3) Personal AI, (4) Physical AI — see §4 for verbatim per-track requirements; no separate sponsor sub-challenge list — bonus awards (Tavily, City, Feedback) act as opt-in overlays, see Prizes table.

## Mandated technology + credits/keys — summary only (see §4 for verbatim + claiming steps)

- Mandated stack in one line: runtime call to Token Factory inference API (OpenAI-compatible, `NEBIUS_API_KEY`) OR deploy/run on AI Cloud compute (Serverless Jobs / Serverless Endpoints / DevPods), plus ≥1 NVIDIA open-source model (Nemotron family incl. Nemotron 3 Nano/Super/Ultra, Llama-3.1-Nemotron-Ultra, plus GROOT/Cosmos/Sonic for Physical AI) — see §4 for verbatim + model notes.
- Credits in one line: $25 Token Factory via promo form (code `NEBIUS-DEVPOST-GLOBAL26`) + $25 Token Factory + $25 Tavily + $1 Academy cert via Nebius Builder Program; extra IRL-event credits `[unconfirmed]` — see §4 for verbatim claiming procedure.

## Sponsors & mandated technology (names only — see §4 for verbatim)

- **Nebius Token Factory** — inference API + Sandboxes; starter credits via promo form + Builder Program
- **Nebius AI Cloud** — Serverless Endpoints / Serverless Jobs / DevPods compute
- **NVIDIA Nemotron** — Nemotron 3 Nano / Super / Ultra + Llama-3.1-Nemotron-Ultra (+ GROOT / Cosmos / Sonic for Physical AI)
- **Tavily** — web search/extraction API; functional runtime call gates the $3k bonus
- **NVIDIA NemoClaw** — OpenShell sandboxes + Hermes/OpenClaw agents for the Personal AI track

## Official resources

- Event tabs: Overview https://nebiusglobalaihackathon.devpost.com/ · Rules https://nebiusglobalaihackathon.devpost.com/rules · Resources https://nebiusglobalaihackathon.devpost.com/resources · Schedule https://nebiusglobalaihackathon.devpost.com/details/dates · Updates https://nebiusglobalaihackathon.devpost.com/updates · Discussions https://nebiusglobalaihackathon.devpost.com/forum_topics
- Nebius for AI Builders: https://dev.nebius.com/
- Nebius Builder Program (credits + office hours + community): https://dev.nebius.com/builders
- Nebius Discord Server (per Resources tab): https://discord.gg/ZdC3rXMJH (alt invite seen on docs site: https://discord.com/invite/nN58zxSTFR) — content `[unconfirmed]` without login
- Token Factory promo-credit form: https://nebius.com/promo-code?utm_promo_event_code=2026-devpost-global-ai-hack&utm_promo_code_type=Token_Factory&utm_promo_activation_code=NEBIUS-DEVPOST-GLOBAL26 (activation code `NEBIUS-DEVPOST-GLOBAL26`)
- Token Factory login / API keys: https://tokenfactory.nebius.com/ · AI Cloud console: https://console.nebius.com/
- Token Factory docs: https://docs.tokenfactory.nebius.com · API reference: https://docs.tokenfactory.nebius.com/api-reference/introduction · OpenAPI: https://api.tokenfactory.nebius.com/openapi.json · Cookbook (Nemotron models): https://github.com/nebius/token-factory-cookbook/tree/main/models/nemotron · Nemotron on Token Factory: https://nebius.com/services/token-factory/nemotron
- AI Cloud docs: https://docs.nebius.com · Status: https://status.nebius.com/ · GitHub: https://github.com/nebius/
- In-person series index: https://luma.com/builderandbrews (20 city links in §4)
- Build Session Sep 8 (Update 2026-09-01): "Live-Coding Your First App with Nebius", Tue 2026-09-08 09:00 PT / 12:00 ET, registration via Zoom link on Updates tab
- Contact: janet@devpost.com (hackathon manager per Overview); support@devpost.com (per Rules §15)

## Prizes

Total advertised: "**$50,000** in cash" (header) / "$50,000+ in prizes + other prizes" (Prizes section). Cash sums exactly to $50,000; hardware (4× Jetson Orin Nano) + swag packs are on top.

| Prize | Items | Qty | Eligibility pool |
|---|---|---|---|
| Grand Prize | $20,000 USD | 1 | All eligible submissions |
| 2nd Place | $10,000 USD | 1 | All eligible submissions |
| 3rd Place | $6,000 USD | 1 | All eligible submissions |
| Coding and Agentic Engineering Track Winner | NVIDIA Jetson Orin Nano | 1 | Eligible submissions in that track |
| Best Apps and Agents Track Winner | NVIDIA Jetson Orin Nano | 1 | Eligible submissions in that track |
| Personal AI Track Winner | NVIDIA Jetson Orin Nano | 1 | Eligible submissions in that track |
| Physical AI Track Winner | NVIDIA Jetson Orin Nano | 1 | Eligible submissions in that track |
| Best Use of Tavily | $3,000 USD | 1 | Eligible submissions making a functional runtime call to the Tavily API |
| City Winner Awards | $500 USD each (20× = $10,000) | 20 | Eligible submissions from entrants attending a participating IRL city event (Tokyo, Da Nang, Seoul, Kuala Lumpur, Singapore, Taipei, Tel Aviv, London, Copenhagen, Stockholm, Warsaw, Amsterdam, Berlin, Paris, Mexico City, New York City, Toronto, Boston, San Francisco, Los Angeles) |
| Most Valuable Feedback | $100 USD + NVIDIA swag pack each (10× = $1,000 + swag) | 10 | Eligible submissions completing the feedback section |

Multiple-prize rule (Rules §8): "Each Project is eligible for one (1) Overall Award OR one (1) Track Award and one (1) Bonus Award." Prizes non-transferable; substitution of equal/greater value at sponsor discretion; no prize awarded absent eligible submissions/entrants; verification + affidavits required; delivery within 60 days of completed forms; winners bear fees/taxes (W-9 / W-8BEN). See §4 for verbatim.

## Schedule (all dates ISO; PDT = UTC-7, PST = UTC-8)

| Period | Begins | Ends |
|---|---|---|
| Submissions | 2026-08-26 09:00 PDT = 2026-08-26 16:00 UTC | **2026-10-30 10:00 PDT = 2026-10-30 17:00 UTC** (hard deadline) |
| Judging (Schedule tab) | 2026-11-02 09:00 PST = 2026-11-02 17:00 UTC | 2026-12-15 12:00 PST = 2026-12-15 20:00 UTC |
| Judging (Rules §1 text — conflicts, see note) | 2026-12-01 09:00 PT = 2026-12-01 17:00 UTC | 2026-12-15 12:00 PT = 2026-12-15 20:00 UTC |
| Winners announced | — | on/around 2027-01-11 12:00 PST = 2027-01-11 20:00 UTC |

Note: Rules §1 says Judging Period starts 2026-12-01, Schedule tab says 2026-11-02 — end date agrees. Treat end + submission deadline as authoritative; start-of-judging discrepancy is non-blocking `[unconfirmed]` — confirm via forum if needed.
IRL Builders & Brews dates (local city dates as published, year 2026): Tokyo Sep 9 · Da Nang Sep 10 · Seoul Sep 11 · Kuala Lumpur Sep 12 · Singapore Sep 14 · Tel Aviv Sep 15 · London Sep 15 · Copenhagen Sep 16 · Stockholm Sep 18 · Taipei Sep 19 · Warsaw Sep 22 · Mexico City Sep 23 · Amsterdam Sep 25 · NYC Sep 25 · Toronto Sep 29 · Berlin Sep 29 · Paris Oct 1 · Boston Oct 2 · SF Oct 9 · LA Oct 13. No attendance required to enter or to win City awards beyond being associated with a city — see §4 verbatim.
Build Session: 2026-09-08 09:00 PDT = 2026-09-08 16:00 UTC (Zoom webinar).

## Teams & participation

- Who can participate: age-of-majority individuals; teams of eligible individuals; organizations (corp/non-profit/LLC/partnership/other legal entities existing at entry). One individual may join multiple teams AND enter solo. Team/org must appoint one Representative to submit. See §4 for verbatim.
- Excluded: residents/orgs domiciled where US/local law prohibits (listed examples: Brazil, Quebec, Russia, Crimea, Cuba, Iran, North Korea + any OFAC-comprehensively-sanctioned country); promotion entities + their employees/agents/households; judges + their employers; affiliates; conflicts of interest. See §4 for verbatim.
- Team-size cap: `[unconfirmed]` — no numeric cap published on tabs read (contrast lablab 1–6). Solo explicitly viable (individual entry allowed; no team required).
- Format: fully online + public; optional IRL meetups. Registration via "Join Hackathon" (free Devpost account) stays open through the Submission Period — only the deadline is fixed.
- Entry requires joining Nebius Builder Program for credits (per Rules §4) + completing all required fields on "Enter a Submission" during the Submission Period.

## Submission fields (EXACT checklist — Devpost "Enter a Submission")

1. Working project meeting Project Requirements (runs on Token Factory or AI Cloud + ≥1 NVIDIA open-source model + fits one track)
2. Track selection (the one best-fit track of the 4)
3. Text description — features and functionality (overview says: what you created, why, how it works; rules require: highlight NVIDIA model usage, where Token Factory accelerated workflow, any other Nebius tools/services used)
4. Working-demo URL — hosted application / test build link (NOT required for Physical AI submissions); private sites must include login credentials in testing instructions; must stay available free of charge without restriction until Judging Period ends
5. Public code repository URL (GitHub, GitLab, or Bitbucket) — public; must contain all source/assets/instructions to run; must include an open-source license file (e.g. Apache 2.0, MIT, MPL 2.0) detectable/visible at top of repo (About section); must include README with setup + run guidance
6. Demonstration video — public YouTube link: <3 minutes (judges not required to watch beyond 3:00); must show project functioning on target device with audio covering Token Factory + NVIDIA model usage; no third-party trademarks/copyrighted music unless permitted; Physical AI: ≥1 minute of physical hardware/robot operating, or key application modules in action if no hardware
7. Feedback on Nebius Token Factory, AI Cloud, and any NVIDIA tools/models/technologies used (also gates Most Valuable Feedback prize)
8. If project pre-existed the Submission Period: written explanation of significant updates during the Submission Period
9. If IRL Builders & Brews attended: city selection (gates City Winner Award)
10. (Conditional, per rules) English translation of video/description/testing instructions if any submission material is not in English

Multiple submissions allowed per entrant if each is unique/substantially different (sponsor + Devpost discretion). See §4 for verbatim + testing/language/IP/financial-support clauses.

## Judging criteria

Two-stage judging (see §4 for verbatim). Stage One: pass/fail baseline viability (fits theme + reasonably applies required APIs/SDKs). Stage Two: all passers scored on 4 **equally weighted** criteria (i.e. 25% each by construction):

| Axis | What judges look for |
|---|---|
| Technological Implementation | How well built; how effectively it uses Nebius Token Factory or AI Cloud model(s) and NVIDIA Nemotron / other NVIDIA open-source models as part of the solution |
| Design | Complete, coherent product experience, not just a technical proof of concept |
| Potential Impact | Credible, specific case for solving a real problem for a real audience; solution actually addresses it based on what's demonstrated |
| Quality of the Idea | Creative, non-obvious use of Token Factory / AI Cloud + NVIDIA models; team shows genuine understanding of problem space |

Tie-break: highest score on first-listed criterion, then next, then judges vote. Feedback prize judged separately on completeness/viability/potential impact of the feedback. Judges panel `[unconfirmed]` — site says "will be announced soon!".

## Rules highlights — summary only (see §4 for verbatim)

- In one line: original sole-owned work; open-source-license repo required; pre-existing work allowed only if significantly updated in-window with written explanation; no sponsor/administrator-funded or contracted work; third-party SDKs/data only with authorization; English (or with translation); Devpost ToS incorporated — see §4 for verbatim (IP, testing access, modifications, publicity, liability, disputes/NY law/arbitration).

---

## My annotations (NOT part of the official brief)

### Recommended play: Best Apps and Agents track, solo, Nemotron on Token Factory

- **Specific user persona:** a solo technical founder / freelance AI engineer who prototypes client demos weekly and burns hours wiring inference keys, model swaps, and background jobs per demo.
- **What it does (example shape, not committed):** a "ship-it" agent app: natural-language task → Nemotron-3-Ultra (reasoning) plans, Nemotron-3-Nano/Super (fast calls) executes via Token Factory Sandboxes/API, Tavily grounds external facts (also gates $3k bonus), Nebius Serverless Endpoints serves the app and Serverless Jobs handles async work; every run shows model choice + Token Factory trace in the UI and video audio.
- **Why AI / why now:** Nemotron 3 family (Nano/Super/Ultra, 262K/256K context) is newly served OpenAI-compatibly on Nebius with per-token pricing + sandboxes — model-routing (heavy reasoner vs cheap fast calls) is now a shippable cost/latency story, not a research project; judges explicitly score "effective use of Token Factory + Nemotron."
- **Business value:** named user above; willingness-to-pay = saved GPU/dev hours per prototype; revenue sketch = per-workspace SaaS + overage on managed runs; TAM anchor `[unconfirmed]` — pin via PGM Reddit mining (r/SaaS, r/startups, r/LocalLlama-style builder subs) at Hour 0.
- **Demo story (3:00 hard cap):** 0:00–0:20 live app solving a real task; 0:20–1:30 split-screen trace (Ultra plan → Nano/Super calls → Tavily grounding → Serverless job); 1:30–2:30 before/after cost-latency panel + README/license/test-build links; 2:30–3:00 "built with Token Factory + Nemotron" audio close + feedback note. Golden fallback: DEMODRIVE capture + localhost mock replay.
- **Judging-axis strategy (artifact → axis):** Technological Implementation → DECKGEN slot quoting runtime Token Factory call + model IDs + Serverless use, SUBMIT fields echoing same; Design → SCRIPT-timed coherent product flow + deployed URL live at judging; Potential Impact → FAQDEF-cited Reddit pain + one specific persona/business panel in deck; Quality of Idea → prior-art scan (Devpost gallery + Discord) proving non-obvious routing angle, disclosed in PROVO/SUBMIT.

### PGM steering: non-obvious requirement (my instruction to the pipeline, NOT an official rule)

- Quality of the Idea demands a *creative, non-obvious* use of Token Factory / AI Cloud + Nemotron.
  Compliant-but-obvious (single-model chatbot, summarizer, model-in-a-UI, bolt-on Tavily call) must lose
  at idea selection regardless of track fit. Mine pains that NEED one of: (N1) Ultra/Super/Nano routing
  by reasoning budget; (N2) Sandboxes write-run-test with branch/rollback; (N3) 256K–1M long-context
  collapsing multi-dashboard work; (N4) Serverless Jobs async muscle + Endpoints serving; (N5) NemoClaw /
  OpenShell private agent with policy + SKILL.md persistence; (N6) fine-tuned Nemotron on Token Factory.
  Search the pain, not the technology (pain-owner subs, never fan subs). Detail + rewritten Stage-1
  prompt: `pgm-nonobvious-analysis.md`, `pgm-stage1-nonobvious-template.md` (same folder).

### Chassis module mapping (grounded in `contracts/component-catalog.json`)

- Mandated LLM (Token Factory OpenAI-compat, Nemotron/NVIDIA OSS) → **resilience** (`withResilience` + golden cache, `RES_FORCED_DEGRADED` kill-switch) + **context** buffer (long Nemotron contexts) + **cost** guardrail (Ultra vs Nano/Super routing budget). Env: `NEBIUS_API_KEY` (custom; catalog has no Nebius entry — do NOT force-fit `OPENAI_API_KEY`, keep separate); providers: `nebius-token-factory`, `nvidia-nemotron`.
- Optional Tavily (bonus $3k) → same **resilience** wrapper + env `TAVILY_API_KEY`; only include if grounding is idiomatic (bonus requires *functional runtime* call).
- Deploy/async (Serverless Endpoints/Jobs, DevPods) → **platform** (`platform/deploy`, `platform/transport`, `platform/ui`); env per catalog `VERCEL_TOKEN/VERCEL_PROJECT_ID` only if Vercel used — Nebius deploy uses its own console/API key `[unconfirmed exact var]`; providers: `nebius-ai-cloud`.
- Voice/vision (Sonic/Cosmos/GROOT) → **media** (`media/stt/vision/tts`) ONLY for Physical AI; skip otherwise per GOV-MIN-03.
- Standard spine regardless of track: **dev-tooling** (mock/eval/doctor/track/bench), **provenance** (prov disclosure + submit formatter — repo license + pre-existing-work explanation live here), **ideation** (deckgen/script/demodrive/faqdef vs 3-min video + feedback field), **profile/pgm** (Hour 0 only, rationale-skipped post-assembly), **data** (synthetic only if demo needs seeded corpus), **assembly-advisory** (pre-assembly only).
- Physical AI needs real hardware or module-action footage — solo without hardware should avoid this track (video rule + hardware-access clause).

### Constraints I care about

- Solo entry allowed (individual entry explicitly permitted; no team-size cap published). Online/global except sanctioned/excluded regions. Goal: complete working pitched submission, not prizes.
- Demo must survive bad Wi-Fi: offline golden path mandatory (mock envelopes + `RES_FORCED_DEGRADED=1` cache + DEMODRIVE capture EARLY); live URL optional-but-scored — ship it, but never depend on it on stage.
- Credit claiming (do Day 0): (1) promo form → $25 Token Factory with code `NEBIUS-DEVPOST-GLOBAL26`; (2) Builder Program registration → another $25 Token Factory + $25 Tavily + $1 Academy cert + office hours/community; (3) IRL event top-up `[unconfirmed]` amount. Budget $50 Token Factory for the whole build — route bulk calls to Nano/Super, reserve Ultra for reasoning slices, wrap all calls in cost guardrail.
- Hard deadline: **2026-10-30 10:00 PDT = 2026-10-30 17:00 UTC** (Devpost "Enter a Submission"; drafts freezable before, unchangeable after except sponsor-permitted IP/PII fixes). Do NOT confuse with Nov/Dec judging or 2027-01-11 winners date.
- Disclosure posture differs from lablab: no separate "disclosure statement" field — but repo must carry an OSI license file + README, and pre-existing projects MUST include in-window-update explanation; unauthorized third-party SDK/data and sponsor-funded prior work disqualify. Keep PROVO-grade provenance anyway.

### Open questions for kickoff stream / Q&A / Discord (all `[unconfirmed]`)

1. Max team size (none published)? 2. Exact IRL extra-credit amounts + claim flow? 3. Judges list + whether "equally weighted" means 25.0% each? 4. Whether multiple tracks per submission allowed or strictly one? 5. NVIDIA-employed eligibility edge (open forum question, 0 comments)? 6. Devpost submission field IDs/labels verbatim at submit time? 7. Kickoff stream replay URL/slides?

---

## Hackathon Rules - Requirements - Tracks

*Sole source-of-truth for binding challenge/tracks/requirements/rules. Verbatim quotes below; checklists already tabulated in §2 are not re-listed here (see §2 for prizes, schedule table, teams summary, submission checklist, judging table, resources).*

**Source identity (verbatim):** "Nebius x NVIDIA Global AI Hackathon" / "Build the next frontier of AI on open infrastructure". "Welcome to the Nebius x NVIDIA Global AI Hackathon — Build a working AI system on open, independent infrastructure, and own the whole thing. The NVIDIA x Nebius Global AI Hackathon is for AI builders, ML engineers, founders, and anyone shipping practical, high-performance AI. You'll build with NVIDIA open source models served on Nebius through Nebius Token Factory, on high performance GPU infrastructure."

**The Challenge (verbatim):** "All submissions must run on either Nebius Token Factory or Nebius AI Cloud and use at least one NVIDIA open source model. Everything else is up to you."

**"Runs on" definition (verbatim, Rules §4):** "Runs on Nebius Token Factory or Nebius AI Cloud" means the project makes a runtime call to the Token Factory inference API, or is deployed/run using Nebius AI Cloud compute (Serverless Jobs, Serverless Endpoints, or DevPods)."

**What to Create (verbatim, Rules §4):** "Entrants must create a working software application that runs on either Nebius Token Factory or Nebius AI Cloud and uses at least one NVIDIA open source model, and that fits into one of the four hackathon tracks below (each a 'Project')."

**Tracks (verbatim):**

1. "Coding and Agentic Engineering Track — Build coding agents and developer tools: agents that write, run, and test code in Token Factory Sandboxes."
2. "Best Apps and Agents Track — Build any app or agent someone would actually use, from a productivity tool or copilot to a workflow that runs itself. Power it with Nemotron models on Nebius through Token Factory. Reach for Nemotron 3 Ultra when you need serious reasoning, and let Nano or Super handle the fast, everyday calls, so your app stays responsive and your credits stretch further. We encourage you to deploy your application with Nebius Serverless Endpoints, or use Nebius Serverless Jobs for background processing and asynchronous workflows, though neither is required."
3. "Personal AI Track — Build an always-on, private assistant that works for you while keeping your data under your control. Give it persistent memory, reusable skills, access to the tools and information you choose, and the ability to carry out tasks across your daily workflows. Use at least one NVIDIA open source model, and use tools such as NVIDIA NemoClaw, OpenShell, Hermes Agent, and Nebius Serverless to bring personal AI to assemble, secure, and run your own personal AI system."
4. "Physical AI Track — Build embodied and edge agents that sense and act in the real world: robotics, IoT, and on-device intelligence, powered by Nemotron, GROOT, Cosmos and Sonic models and coordinated through an agent runtime. Use Nebius Serverless Jobs to run simulations, generate synthetic data, evaluate robot policies, or process sensor data at scale, and Nebius Serverless Endpoints to serve real-time inference when needed. Your demonstration video must include at least a 1-minute clip showing the physical hardware/robot actually operating, or — if your Project has no physical hardware component — the key application modules in action."

*Summary: one submission = one track (form says "Identify which track"); no mandatory deploy target except Physical AI's 1-minute footage rule; Coding track is the only one naming Sandboxes.*

**Mandated technology + credits (verbatim):**

- "Entrants can join the [Nebius Builder Program](https://dev.nebius.com/builders) and get credits for Nebius Token Factory, Tavily, and Nebius Academy — plus training, office hours, and access to the builder community."
- Resources tab: "1. [Fill out this form](https://nebius.com/promo-code?utm_promo_event_code=2026-devpost-global-ai-hack&utm_promo_code_type=Token_Factory&utm_promo_activation_code=NEBIUS-DEVPOST-GLOBAL26) for $25 Token Factory credits — Be sure to enter NEBIUS-DEVPOST-GLOBAL26 as your activation code" + "2. Get another $25 Token Factory credits by [joining the Nebius Builders Program](https://dev.nebius.com/builders) for free credits (Token Factory, Tavily, Nebius Academy) plus office hours". Builder Program page confirms early-preview bundle: $25 Token Factory + $25 Tavily + $1 Academy certification.
- "Attendees can also unlock additional Nebius AI Cloud, Token Factory, Tavily credits to keep building after the event." (amount `[unconfirmed]`).
- Model references as published: "Nemotron models on Nebius through Token Factory", "Nemotron 3 Ultra … Nano or Super", "Nemotron, GROOT, Cosmos and Sonic models", "NVIDIA Nemotron or other NVIDIA open source models", "NVIDIA NemoClaw, OpenShell, Hermes Agent". Concrete servable IDs (docs/cookbook, informative not binding): `nvidia/nemotron-3-super-120b-a12b` pattern; Nano 30B-A3B (262K), Nano-Omni (300K), Super 120B-A12B (256K), Ultra 550B-A55B (256K), Llama-3.1-Nemotron-Ultra-253B-v1 (128K). Base URL pattern `https://api.tokenfactory.us-central1.nebius.com/v1/` (region prefix may vary); auth via `Authorization: Bearer <NEBIUS_API_KEY>`, OpenAI-compatible (`/v1/chat/completions`, `/v1/completions`).
- Bonus overlay: "Best Use of Tavily — All Eligible Submissions that make a functional, runtime call to the Tavily API as part of its solution." (single call is not enough — must be functional/runtime).

**Submission/testing/language/IP/support (verbatim excerpts, Rules §4):**

- "Provide a URL to a working demo, hosted application, or test build of your Project (not required for Physical AI submissions…)." / "Include a text description that should explain the features and functionality of your Project." / "Provide a URL to your public code repository for judging and testing on either GitHub, GitLab or Bitbucket." / "The repository must contain all necessary source code, assets, and instructions required for the project to be functional." / "The repository must be public and open source by including an open source license file (such as Apache 2.0, MIT, or MPL 2.0). This license should be detectable and visible at the top of the repository page (in the About section)." / "Include a README with setup instructions and clear guidance for running your project." / "Make sure to highlight how you've used NVIDIA Nemotron or other NVIDIA open source models and where Token Factory accelerated your workflow and any other Nebius Tools or Services used."
- Video: "should be less than three (3) minutes. Judges are not required to watch beyond three minutes" / "should include footage that shows the Project functioning on the device for which it was built" / "must be uploaded to and made publicly visible on YouTube and a link to the video must be provided" / "must not include third party trademarks, or copyrighted music or other material unless the Entrant has permission".
- "The Project must be capable of being successfully installed and running consistently on the platform for which it is intended and must function as depicted in the video and/or expressed in the text description."
- "Projects must be either newly created by the Entrant or, if the Entrant's Project existed prior to the Hackathon Submission Period, must have been significantly updated after the start of the Hackathon Submission Period."
- "If a Project integrates any third-party SDK, APIs and/or data, Entrant must be authorized to use them in accordance with any terms and conditions or licensing requirements of the tool."
- Testing access: "Access must be provided … free of charge and without any restriction, for testing, evaluation and use by the Sponsor, Administrator and Judges until the Judging Period ends." + "If Entrant's website is private, Entrant must include login credentials in its testing instructions." Hardware-access clause for proprietary/wearable hardware applies on request.
- "All Submission materials must be in English or, if not in English, the Entrant must provide an English translation…"
- "An Entrant may submit more than one Submission, however, each Submission must be unique and substantially different…" / "Be the original work of the Entrant, be solely owned by the Entrant, and not violate the IP rights of any other person or entity." / Open-source reuse allowed "provided the Entrant complies with applicable open source licenses and, as part of the Submission, creates software that enhances and builds upon the features and functionality included in the underlying open source product."
- "A Project must not have been developed, or derived from a Project developed, with financial or preferential support from the Sponsor or Administrator."

**Eligibility (verbatim excerpts, Rules §3):** open to age-of-majority individuals, teams of eligible individuals, and organizations existing at entry; Representative required for team/org; one person may join multiple teams + enter solo. NOT open to residents/orgs where prohibited "including, but not limited to, Brazil, Quebec, Russia, Crimea, Cuba, Iran, and North Korea and any other country which is comprehensively sanctioned by the U.S. Treasury's Office of Foreign Assets Control", promotion entities/employees/agents/households, anyone involved in production/distribution, any judge or judge's employer, affiliates, conflicts of interest. (See §2 for team-cap `[unconfirmed]` note.)

**Judging (verbatim excerpts, Rules §6):** "Stage One) The first stage will determine via pass/fail whether the ideas meet a baseline level of viability, in that the Project reasonably fits the theme and reasonably applies the required APIs/SDKs featured in the Hackathon." / "Stage Two) All Submissions that pass Stage One will be evaluated in Stage Two based on the following equally weighted criteria" — Technological Implementation / Design / Potential Impact / Quality of the Idea (wording per §2 table). "Feedback Submission Criteria. Eligible Feedback Submissions will be evaluated based on the completeness, viability, and potential impact of the feedback."

**Post-deadline (verbatim, Rules §5):** "Once the Submission Period has ended, you may not make any changes or alterations to your Submission, but you may continue to update the Project in your Devpost portfolio." Sponsor/Devpost may permit narrow fixes "for the purpose of adding, removing or replacing material that potentially infringes a third party mark or right, discloses personally identifiable information, or is otherwise inappropriate."

**Could not verify (explicit):** kickoff live-stream replay/slides (nothing on tabs 2026-09-03); Discord channel contents (login-walled); IRL extra-credit amounts; judges identities ("will be announced soon!"); Devpost submit-form field IDs (visible only after Join); any video-cap change beyond written <3:00 rule; any deadline change beyond 2026-10-30 10:00 PDT.
