import fs from "node:fs/promises";
import path from "node:path";
import { defaultAgentArgs, detectAgentBinary, detectAgentKind } from "./detect.mjs";
import { defaultConfigFile, defaultStateFile, parseIntValue, parseList, pathExists, readJson, splitCommandLine, writeJson } from "./utils.mjs";

const KIND_BIN_KEYS = {
  hermes: ["HERMES_CLI_BIN"],
  codex: ["CODEX_CLI_BIN"],
  claude: ["CLAUDE_CLI_BIN", "CLAUDE_CODE_CLI_BIN"],
  opencode: ["OPENCODE_CLI_BIN"],
  openclaw: ["OPENCLAW_CLI_BIN"],
};

const KIND_ARGS_KEYS = {
  hermes: ["HERMES_CLI_ARGS"],
  codex: ["CODEX_CLI_ARGS"],
  claude: ["CLAUDE_CLI_ARGS", "CLAUDE_CODE_CLI_ARGS"],
  opencode: ["OPENCODE_CLI_ARGS"],
  openclaw: ["OPENCLAW_CLI_ARGS"],
};

function pickConfiguredValue(raw, keys) {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== "") return raw[key];
  }
  return undefined;
}

function resolveConfiguredByKind(raw, kind, table) {
  const normalized = String(kind || "").trim().toLowerCase();
  const keys = table[normalized];
  if (keys) {
    const value = pickConfiguredValue(raw, keys);
    if (value !== undefined) return value;
  }
  return undefined;
}

function resolveOption(options, ...names) {
  for (const name of names) {
    if (options[name] !== undefined && options[name] !== null && options[name] !== "") return options[name];
  }
  return undefined;
}

function normalizeChannelIds(value) {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  return parseList(value);
}

function normalizeConfig(raw) {
  const requestedKind = String(raw.agentKind || raw.BRIDGE_AGENT_KIND || "auto").trim().toLowerCase() || "auto";
  const agentKind = detectAgentKind(requestedKind);
  const agentBin =
    raw.agentBin ||
    resolveConfiguredByKind(raw, agentKind, KIND_BIN_KEYS) ||
    detectAgentBinary(agentKind);
  const agentArgs = Array.isArray(raw.agentArgs)
    ? raw.agentArgs
    : splitCommandLine(
        raw.agentArgs ||
          resolveConfiguredByKind(raw, agentKind, KIND_ARGS_KEYS) ||
          defaultAgentArgs(agentKind).join(","),
      );

  return {
    baseUrl: String(raw.baseUrl || raw.AUTOMATIC_BASE_URL || "https://tool.auto.txzy.net").replace(/\/$/, ""),
    channelIds: normalizeChannelIds(raw.channelIds || raw.AUTOMATIC_CHANNEL_IDS || raw.AUTOMATIC_CHANNEL_ID),
    agentKind,
    agentBin,
    agentArgs,
    pollIntervalMs: parseIntValue(raw.pollIntervalMs ?? raw.BRIDGE_POLL_INTERVAL_MS, 1500),
    historyLimit: parseIntValue(raw.historyLimit ?? raw.BRIDGE_HISTORY_LIMIT, 12),
    replyLimit: parseIntValue(raw.replyLimit ?? raw.BRIDGE_REPLY_LIMIT, 1900),
    agentTimeoutMs: parseIntValue(raw.agentTimeoutMs ?? raw.BRIDGE_AGENT_TIMEOUT_MS, 120_000),
    roomPassword: String(raw.roomPassword ?? raw.BRIDGE_ROOM_PASSWORD ?? raw.password ?? ""),
    promptTemplate: String(raw.promptTemplate || raw.HERMES_PROMPT_TEMPLATE || "You are an AI assistant connected to Automatic channel {channelId}. Reply as the agent in a lightweight channel.\n\nRecent conversation:\n{history}\n\nLatest user message:\n{message}\n\nReply concisely and naturally as the agent."),
    configPath: raw.configPath || raw.AUTOMATIC_BRIDGE_CONFIG || defaultConfigFile(),
    statePath: raw.statePath || raw.BRIDGE_STATE_FILE || defaultStateFile(),
  };
}

function readCliOptions(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const [flag, inline] = arg.slice(2).split(/=(.*)/s, 2);
    const key = flag.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (inline !== undefined) {
      options[key] = inline;
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      options[key] = next;
      i += 1;
    } else {
      options[key] = true;
    }
  }
  return options;
}

export async function loadConfig(argvOptions = {}, extra = {}) {
  const cliOptions = { ...readCliOptions(extra.argv || []), ...argvOptions };
  const configPath = path.resolve(String(resolveOption(cliOptions, "configPath", "config") || defaultConfigFile()));
  let fileConfig = {};
  if (await pathExists(configPath)) {
    try {
      fileConfig = await readJson(configPath);
    } catch {
      fileConfig = {};
    }
  }

  const env = process.env;
  const combined = {
    ...fileConfig,
    ...env,
    ...cliOptions,
    configPath,
  };

  const cfg = normalizeConfig(combined);
  const cliChannelIds = resolveOption(cliOptions, "channelIds", "channelIdsCsv", "AUTOMATIC_CHANNEL_IDS");
  cfg.channelIds = normalizeChannelIds(cliChannelIds || fileConfig.channelIds || env.AUTOMATIC_CHANNEL_IDS || env.AUTOMATIC_CHANNEL_ID);
  const singleChannelId = resolveOption(cliOptions, "channelId");
  if (singleChannelId) cfg.channelIds = [String(singleChannelId)];
  if (cliChannelIds) cfg.channelIds = normalizeChannelIds(cliChannelIds);
  const cliBaseUrl = resolveOption(cliOptions, "baseUrl");
  if (cliBaseUrl) cfg.baseUrl = String(cliBaseUrl).replace(/\/$/, "");
  const cliAgentKind = resolveOption(cliOptions, "agentKind");
  if (cliAgentKind) cfg.agentKind = detectAgentKind(String(cliAgentKind));
  const cliAgentBin = resolveOption(cliOptions, "agentBin");
  if (cliAgentBin) cfg.agentBin = String(cliAgentBin);
  const cliAgentArgs = resolveOption(cliOptions, "agentArgs");
  if (cliAgentArgs) cfg.agentArgs = splitCommandLine(cliAgentArgs);
  const cliPollIntervalMs = resolveOption(cliOptions, "pollIntervalMs");
  if (cliPollIntervalMs) cfg.pollIntervalMs = parseIntValue(cliPollIntervalMs, cfg.pollIntervalMs);
  const cliHistoryLimit = resolveOption(cliOptions, "historyLimit");
  if (cliHistoryLimit) cfg.historyLimit = parseIntValue(cliHistoryLimit, cfg.historyLimit);
  const cliReplyLimit = resolveOption(cliOptions, "replyLimit");
  if (cliReplyLimit) cfg.replyLimit = parseIntValue(cliReplyLimit, cfg.replyLimit);
  const cliAgentTimeoutMs = resolveOption(cliOptions, "agentTimeoutMs");
  if (cliAgentTimeoutMs) cfg.agentTimeoutMs = parseIntValue(cliAgentTimeoutMs, cfg.agentTimeoutMs);
  const cliRoomPassword = resolveOption(cliOptions, "roomPassword", "password");
  if (cliRoomPassword) cfg.roomPassword = String(cliRoomPassword);
  const cliPromptTemplate = resolveOption(cliOptions, "promptTemplate");
  if (cliPromptTemplate) cfg.promptTemplate = String(cliPromptTemplate);
  const cliStatePath = resolveOption(cliOptions, "statePath");
  if (cliStatePath) cfg.statePath = String(cliStatePath);
  cfg.configPath = configPath;
  return cfg;
}

export async function writeInitConfig(targetPath, config) {
  const payload = {
    baseUrl: config.baseUrl,
    channelIds: config.channelIds,
    agentKind: config.agentKind,
    agentBin: config.agentBin,
    agentArgs: config.agentArgs,
    pollIntervalMs: config.pollIntervalMs,
    historyLimit: config.historyLimit,
    replyLimit: config.replyLimit,
    agentTimeoutMs: config.agentTimeoutMs,
    roomPassword: config.roomPassword,
    promptTemplate: config.promptTemplate,
    statePath: config.statePath,
  };
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await writeJson(targetPath, payload);
  return payload;
}
