Step {{step_id}} for file {{file}} failed verification.
Intent: {{intent}}
Acceptance: {{acceptance}}

Current file content:
{{file_text}}

Previous diff that failed:
{{previous_diff}}

Failing log (truncated to 4000 chars):
{{failing_log}}

Return exactly one corrected CandidateDiff JSON object for the same stepId {{step_id}} and file {{file}}.
