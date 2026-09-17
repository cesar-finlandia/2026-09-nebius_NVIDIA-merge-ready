export interface Checkpoint {
  tag: string;
  imageId: string;
  createdAt: string;
}
export interface SandboxRunResult {
  branchTag: string;
  parentTag: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  verifiedSha: string;
  rolledBack: boolean;
}
export interface BaselineArgs {
  traceId: string;
  repoSnapshot: { root: string; files: { path: string; bytes: number; text: string }[]; testCommand: string; baseImage: string };
}
export interface BranchArgs {
  traceId: string;
  stepId: string;
  parentTag: string;
  file: string;
  unifiedDiff: string;
  testCommand: string;
  timeoutSeconds: number;
}
