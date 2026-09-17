// SPDX-License-Identifier: Apache-2.0
export interface RepoFile {
  path: string;
  bytes: number;
  text: string;
}
export interface RepoSnapshot {
  root: string;
  files: RepoFile[];
  testCommand: string;
  baseImage: string;
}
export const MAX_FILE_BYTES = 204800;
export const EXCLUDED_DIRS: string[] = [
  ".git",
  "node_modules",
  "dist",
  "build",
  "out",
  ".venv",
  "__pycache__",
  ".pytest_cache",
  ".hypothesis",
  ".cache",
  "coverage",
];
export const BINARY_EXTENSIONS: string[] = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".ico",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".mp4",
  ".mp3",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".pyc",
  ".lock",
];
export function detectTestCommand(root: string, files: RepoFile[]): string {
  void root;
  const byPath = new Map(files.map((f) => [f.path, f.text]));
  function getText(name: string): string | undefined {
    const direct = byPath.get(name);
    if (direct !== undefined) return direct;
    let bestKey: string | undefined;
    for (const k of byPath.keys()) {
      if (k === name || k.endsWith("/" + name)) {
        if (bestKey === undefined || k < bestKey) bestKey = k;
      }
    }
    return bestKey === undefined ? undefined : byPath.get(bestKey);
  }
  const pkgText = getText("package.json");
  if (pkgText !== undefined) {
    try {
      const pkg = JSON.parse(pkgText) as { scripts?: unknown };
      const scripts = (pkg as { scripts?: Record<string, unknown> }).scripts;
      const t = scripts?.["test"];
      if (typeof t === "string" && t.trim().length > 0) return t;
    } catch {
      // fall through to next checks
    }
  }
  const pyprojectText = getText("pyproject.toml");
  if (pyprojectText !== undefined && pyprojectText.includes("[tool.pytest]")) {
    return "pytest -q";
  }
  if (getText("pytest.ini") !== undefined) return "pytest -q";
  const makeText = getText("Makefile");
  if (makeText !== undefined) {
    for (const line of makeText.split("\n")) {
      if (line.startsWith("test:")) return "make test";
    }
  }
  return "npm test";
}
export function detectBaseImage(root: string, files: RepoFile[]): string {
  void root;
  const byPath = new Map(files.map((f) => [f.path, f.text]));
  function getText(name: string): string | undefined {
    const direct = byPath.get(name);
    if (direct !== undefined) return direct;
    let bestKey: string | undefined;
    for (const k of byPath.keys()) {
      if (k === name || k.endsWith("/" + name)) {
        if (bestKey === undefined || k < bestKey) bestKey = k;
      }
    }
    return bestKey === undefined ? undefined : byPath.get(bestKey);
  }
  const dockerText = getText("Dockerfile");
  if (dockerText !== undefined) {
    for (const line of dockerText.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.toUpperCase().startsWith("FROM ")) {
        const parts = trimmed.split(/\s+/);
        const img = parts[1];
        if (parts.length >= 2 && img !== undefined && img.length > 0) return img;
      }
    }
  }
  const pyVerText = getText(".python-version");
  if (pyVerText !== undefined) {
    const v = pyVerText.trim();
    if (v.startsWith("3.11")) return "python:3.11-slim";
    if (v.startsWith("3.12")) return "python:3.12-slim";
    return "ubuntu:latest";
  }
  if (getText(".nvmrc") !== undefined) return "node:20-slim";
  return "ubuntu:latest";
}
export async function loadRepoSnapshot(dir: string): Promise<RepoSnapshot> {
  const path = await import("node:path");
  const fs = (await import("node:fs")).promises;
  const root = path.resolve(dir);
  const files: RepoFile[] = [];
  const excluded = new Set(EXCLUDED_DIRS);
  const binary = new Set(BINARY_EXTENSIONS);
  async function visit(curAbs: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(curAbs, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      const full = path.join(curAbs, e.name);
      const rel = path.relative(root, full);
      const relPosix = rel.split(path.sep).join("/");
      const firstSeg = relPosix.split("/")[0] ?? "";
      if (excluded.has(firstSeg)) continue;
      if (e.isDirectory()) {
        await visit(full);
      } else if (e.isFile()) {
        let statSize: number;
        try {
          const st = await fs.stat(full);
          if (!st.isFile()) continue;
          statSize = st.size;
        } catch {
          continue;
        }
        if (statSize > 204800) continue;
        const lower = e.name.toLowerCase();
        const dot = lower.lastIndexOf(".");
        const ext = dot >= 0 ? lower.slice(dot) : "";
        if (ext !== "" && binary.has(ext)) continue;
        let text: string;
        try {
          text = await fs.readFile(full, "utf8");
        } catch {
          continue;
        }
        files.push({ path: relPosix, bytes: statSize, text });
      }
    }
  }
  try {
    await fs.readdir(root, { withFileTypes: true });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "ENOENT" || code === "EACCES") {
      return { root, files: [], testCommand: "npm test", baseImage: "ubuntu:latest" };
    }
  }
  await visit(root);
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { root, files, testCommand: detectTestCommand(root, files), baseImage: detectBaseImage(root, files) };
}
