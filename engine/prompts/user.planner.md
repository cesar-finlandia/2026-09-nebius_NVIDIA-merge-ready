Ticket {{ticket_id}}: {{ticket_title}}
{{ticket_body}}

Packed repository context (strategy {{pack_strategy}}, {{pack_tokens}} tokens, dropped: {{dropped_files}}):
{{packed_context}}

Grounding notes:
{{grounding_notes}}

Return a PatchPlan JSON object with fields summary (string) and steps (array of 1..{{max_steps}} items, each with id, file, intent, acceptance). One file per step.
