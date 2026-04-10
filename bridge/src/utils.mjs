import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const PREFIX = "[automatic-bridge]";

export function log(...args) {
  console.log(PREFIX, new Date().toISOString(), ...args);
}

export function warn(...args) {
  console.warn(PREFIX, new Date().toISOString(), ...args);
}

export function parseList(value) {
  return String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseIntValue(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function truncate(text, limit) {
  const string = String(text ?? "");
  if (string.length <= limit) return string;
  return `${string.slice(0, Math.max(0, limit - 1))}…`;
}

export function expandHome(input) {
  const value = String(input ?? "");
  if (!value.startsWith("~")) return value;
  return path.join(os.homedir(), value.slice(1));
}

export async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return JSON.parse(text);
}

export async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function homeConfigDir() {
  return path.join(os.homedir(), ".config", "automatic-bridge");
}

export function defaultStateFile() {
  return path.join(homeConfigDir(), "state.json");
}

export function defaultConfigFile() {
  return path.join(homeConfigDir(), "config.json");
}

export function splitCommandLine(value) {
  return parseList(value).filter(Boolean);
}

export function replacePlaceholders(template, values) {
  return String(template)
    .replaceAll("{channelId}", values.channelId ?? "")
    .replaceAll("{message}", values.message ?? "")
    .replaceAll("{history}", values.history ?? "")
    .replaceAll("{prompt}", values.prompt ?? "");
}

export function makePrompt(template, values) {
  return replacePlaceholders(template, values);
}
