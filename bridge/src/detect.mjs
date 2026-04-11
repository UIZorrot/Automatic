import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const IS_WINDOWS = process.platform === "win32";

const KIND_ALIASES = new Map([
  ["", "auto"],
  ["auto", "auto"],
  ["hermes", "hermes"],
  ["hermes-cli", "hermes"],
  ["codex", "codex"],
  ["claude", "claude"],
  ["claude-code", "claude"],
  ["claude code", "claude"],
  ["opencode", "opencode"],
  ["open-code", "opencode"],
  ["openclaw", "openclaw"],
]);

const KIND_PRIORITY = ["codex", "claude", "opencode", "openclaw", "hermes"];

const CANDIDATES = {
  hermes: [
    process.env.HERMES_CLI_BIN,
    "hermes",
    IS_WINDOWS ? "hermes.exe" : null,
    IS_WINDOWS ? "hermes.cmd" : null,
    path.join(os.homedir(), ".hermes", "hermes-agent", "venv", "bin", "hermes"),
  ],
  codex: [
    process.env.CODEX_CLI_BIN,
    "codex",
    IS_WINDOWS ? "codex.exe" : null,
    IS_WINDOWS ? "codex.cmd" : null,
  ],
  claude: [
    process.env.CLAUDE_CLI_BIN,
    process.env.CLAUDE_CODE_CLI_BIN,
    "claude",
    IS_WINDOWS ? "claude.exe" : null,
    IS_WINDOWS ? "claude.cmd" : null,
  ],
  opencode: [
    process.env.OPENCODE_CLI_BIN,
    "opencode",
    "open-code",
    IS_WINDOWS ? "opencode.exe" : null,
    IS_WINDOWS ? "opencode.cmd" : null,
  ],
  openclaw: [
    process.env.OPENCLAW_CLI_BIN,
    "openclaw",
    IS_WINDOWS ? "openclaw.exe" : null,
    IS_WINDOWS ? "openclaw.cmd" : null,
  ],
};

function normalizeKind(kind) {
  return KIND_ALIASES.get(String(kind ?? "").trim().toLowerCase()) ?? String(kind ?? "").trim().toLowerCase();
}

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function commandExists(command) {
  if (!command) return false;
  if (IS_WINDOWS) {
    const result = spawnSync("where", [command], { stdio: "ignore", shell: false });
    return !result.error && result.status === 0;
  }
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], { stdio: "ignore", shell: false });
  return !result.error && result.status === 0;
}

function probeCandidate(candidate) {
  if (!candidate) return null;
  if (path.isAbsolute(candidate)) {
    return isExecutable(candidate) ? candidate : null;
  }
  return commandExists(candidate) ? candidate : null;
}

export function detectAvailableAgentKinds() {
  return KIND_PRIORITY.filter((kind) => {
    const candidates = CANDIDATES[kind] || [];
    return candidates.some((candidate) => probeCandidate(candidate));
  });
}

export function detectAgentKind(preferredKind) {
  const kind = normalizeKind(preferredKind);
  if (kind && kind !== "auto" && CANDIDATES[kind]) return kind;
  const available = detectAvailableAgentKinds();
  return available[0] || "hermes";
}

export function detectAgentBinary(kind) {
  const lower = normalizeKind(kind) || "hermes";
  if (lower === "auto") return detectAgentBinary(detectAgentKind("auto"));
  const candidates = CANDIDATES[lower] || CANDIDATES.hermes;
  for (const candidate of candidates) {
    const resolved = probeCandidate(candidate);
    if (resolved) return resolved;
  }
  return lower === "codex"
    ? "codex"
    : lower === "claude"
      ? "claude"
      : lower === "opencode"
        ? "opencode"
        : "hermes";
}

export function defaultAgentArgs(kind) {
  const lower = normalizeKind(kind);
  if (lower === "codex") return ["exec", "--skip-git-repo-check", "--full-auto", "{prompt}"];
  if (lower === "claude") return ["--print", "{prompt}"];
  if (lower === "opencode") return ["exec", "{prompt}"];
  if (lower === "openclaw") return ["agent", "--message", "{prompt}"];
  return ["chat", "-Q", "--source", "automatic-bridge", "-q", "{prompt}"];
}

export function commandAvailable(binary) {
  if (!binary) return false;
  if (path.isAbsolute(binary)) return isExecutable(binary);
  return commandExists(binary);
}
