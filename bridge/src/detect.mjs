import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CANDIDATES = {
  hermes: [
    process.env.HERMES_CLI_BIN,
    "hermes",
    path.join(os.homedir(), ".hermes", "hermes-agent", "venv", "bin", "hermes"),
  ],
  codex: [
    process.env.CODEX_CLI_BIN,
    "codex",
  ],
};

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function commandExists(command) {
  const result = spawnSync(command, ["--help"], { stdio: "ignore", shell: false });
  return !result.error && result.status !== 127;
}

function probeCandidate(candidate) {
  if (!candidate) return null;
  if (path.isAbsolute(candidate)) {
    return isExecutable(candidate) ? candidate : null;
  }
  return commandExists(candidate) ? candidate : null;
}

export function detectAgentKind(preferredKind) {
  const kind = String(preferredKind || "").toLowerCase();
  if (kind === "codex") return "codex";
  if (kind === "hermes") return "hermes";
  if (probeCandidate(process.env.CODEX_CLI_BIN) || commandExists("codex")) return "codex";
  return "hermes";
}

export function detectAgentBinary(kind) {
  const lower = String(kind || "hermes").toLowerCase();
  const candidates = CANDIDATES[lower] || CANDIDATES.hermes;
  for (const candidate of candidates) {
    const resolved = probeCandidate(candidate);
    if (resolved) return resolved;
  }
  return lower === "codex" ? "codex" : "hermes";
}

export function defaultAgentArgs(kind) {
  if (String(kind).toLowerCase() === "codex") {
    return ["exec", "--skip-git-repo-check", "--full-auto", "{prompt}"];
  }
  return ["chat", "-Q", "--source", "automatic-bridge", "-q", "{prompt}"];
}

export function commandAvailable(binary) {
  if (!binary) return false;
  if (path.isAbsolute(binary)) return isExecutable(binary);
  return commandExists(binary);
}
