// DP-PROMPTS W3 — Prompt renderers (C-05). Algorithms A1/A2/A3.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type {
  DrafterInput,
  PlannerInput,
  RedrafterInput,
} from "./schemas.js";

// Prompt templates ship with the entry repo under engine/prompts/. Resolve
// them relative to this module (repo root), not process.cwd(), so the server,
// screenshots and E2E harness may run with any working directory (e.g. the
// fixture repo) without breaking template loading.
const TEMPLATE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "engine", "prompts");

function load(name: string): string {
  return readFileSync(join(TEMPLATE_DIR, name), "utf8");
}

export function renderPlanner(i: PlannerInput): { system: string; user: string } {
  const maxSteps = Math.min(i.maxSteps, 8);
  const sysT = load("system.planner.md");
  const system = sysT
    .split("{{max_steps}}").join(String(maxSteps))
    .split("{{style_guide}}").join(i.styleGuide);
  const usrT = load("user.planner.md");
  const user = usrT
    .split("{{ticket_id}}").join(i.ticketId)
    .split("{{ticket_title}}").join(i.ticketTitle)
    .split("{{ticket_body}}").join(i.ticketBody)
    .split("{{packed_context}}").join(i.packedContext)
    .split("{{max_steps}}").join(String(maxSteps));
  return { system, user };
}

export function renderDrafter(i: DrafterInput): { system: string; user: string } {
  const fileLines = String(i.fileText.split("\n").length);
  const sysT = load("system.drafter.md");
  const system = sysT
    .split("{{file}}").join(i.file)
    .split("{{intent}}").join(i.intent)
    .split("{{acceptance}}").join(i.acceptance)
    .split("{{file_lines}}").join(fileLines);
  const usrT = load("user.drafter.md");
  const user = usrT
    .split("{{step_id}}").join(i.stepId)
    .split("{{file}}").join(i.file)
    .split("{{intent}}").join(i.intent)
    .split("{{acceptance}}").join(i.acceptance)
    .split("{{file_text}}").join(i.fileText)
    .split("{{packed_context}}").join(i.packedContext);
  return { system, user };
}

export function renderRedrafter(i: RedrafterInput): { system: string; user: string } {
  const fileLines = String(i.fileText.split("\n").length);
  const sysT = load("system.redrafter.md");
  const system = sysT.split("{{file}}").join(i.file).split("{{file_lines}}").join(fileLines);
  const usrT = load("user.redrafter.md");
  const user = usrT
    .split("{{step_id}}").join(i.stepId)
    .split("{{file}}").join(i.file)
    .split("{{intent}}").join(i.intent)
    .split("{{acceptance}}").join(i.acceptance)
    .split("{{file_text}}").join(i.fileText)
    .split("{{previous_diff}}").join(i.previousDiff)
    .split("{{failing_log}}").join(i.failingLog.slice(0, 4000));
  return { system, user };
}
