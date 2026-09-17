// SPDX-License-Identifier: Apache-2.0
// Test/screenshot server launcher. Optional env:
//   API_PORT (default 8787), API_CWD (chdir target before listening —
//   the E2E harness points it at examples/mergeready/fixture-repo so the
//   UI's snapshotDir "." resolves to the green-capable fixture repo).
const cwd = process.env["API_CWD"];
if (cwd) process.chdir(cwd);
const { createServer } = await import("../src/mergeready/api/server.js");
const port = Number(process.env["API_PORT"] ?? "8787");
const srv = createServer({ port });
await srv.listen();
console.log(`mergeready-api listening on ${port} cwd=${process.cwd()}`);
