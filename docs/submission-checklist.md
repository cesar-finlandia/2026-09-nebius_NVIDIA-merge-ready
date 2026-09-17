# Submission checklist — Merge-Ready

- [ ] Demo URL maps to the deployed Nebius AI Cloud Serverless Endpoint (from `docs/deploy-nebius.md`; only after the smoke gate prints `smoke-ok`)
- [ ] Public repo URL recorded
- [ ] License visible at top maps to `LICENSE` plus `README.md` lines 1 through 3
- [ ] README present with all eight headings in order
- [ ] Text description naming NVIDIA Nemotron 3 models plus where Token Factory accelerated the workflow
- [ ] YouTube link public with duration at most 3:00 and audio covering Token Factory plus Nemotron
- [ ] Track pick fixed to Coding and Agentic Engineering
- [ ] Feedback section completed
- [ ] City selection if applicable
- [ ] In-window-build explanation recorded

Hard deadline: 2026-10-30 17:00 UTC
T-24h freeze: 2026-10-29 17:00 UTC — re-run A-07 plus lint, freeze code

## Best Use of Tavily (paste into Devpost)

`groundTicket` in `src/mergeready/grounding/tavily.ts` makes the functional
runtime Tavily call: the returned `GroundingBundle` (query + titled results)
feeds the planner prompt (`packPlannerInput`) and renders as citations through
`CitationDisplay` in the planning trace. Proof: the `grounding` envelope in any
run (2 results in replay), uc09's citation assertions, and `submit hygiene`
reporting clean (no key committed — `TAVILY_API_KEY` appears in no tracked
file). Note: `submission.md` is 100% chassis-generated and the generator has
no bonus slot, so this line lives here and not there (DP-SUBMIT forbids
hand-editing generated files).

Ignore assertion: `.gitignore` lists `.env`; operator runs `git check-ignore -v .env`
before submit; `submit hygiene` must report clean; `NEBIUS_API_KEY` plus
`TAVILY_API_KEY` plus `GITHUB_TOKEN` appear in no tracked file.
