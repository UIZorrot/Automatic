import fs from "node:fs/promises";
import path from "node:path";
import { defaultAgentArgs, detectAgentBinary, detectAgentKind } from "./detect.mjs";
import { defaultConfigFile, defaultStateFile, parseIntValue, parseList, pathExists, readJson, splitCommandLine, writeJson } from "./utils.mjs";

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
  const agentKind = String(raw.agentKind || raw.BRIDGE_AGENT_KIND || detectAgentKind()).toLowerCase();
  const agentBin = raw.agentBin || raw.HERMES_CLI_BIN || raw.CODEX_CLI_BIN || detectAgentBinary(agentKind);
  const agentArgs = Array.isArray(raw.agentArgs)
    ? raw.agentArgs
    : splitCommandLine(raw.agentArgs || raw.HERMES_CLI_ARGS || raw.CODEX_CLI_ARGS || defaultAgentArgs(agentKind).join(","));

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
    apiKey: String(raw.apiKey ?? raw.AGENT_API_KEY ?? ""),
    promptTemplate: String(raw.promptTemplate || raw.HERMES_PROMPT_TEMPLATE || "You are Hermes connected to Automatic channel {channelId}. Reply as the agent in a lightweight channel.\n\nRecent conversation:\n{history}\n\nLatest user message:\n{message}\n\nReply concisely and naturally as the agent."),
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
  if (cliAgentKind) cfg.agentKind = String(cliAgentKind).toLowerCase();
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
  const cliApiKey = resolveOption(cliOptions, "apiKey");
  if (cliApiKey) cfg.apiKey = String(cliApiKey);
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
    apiKey: config.apiKey,
    promptTemplate: config.promptTemplate,
    statePath: config.statePath,
  };
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await writeJson(targetPath, payload);
  return payload;
}
