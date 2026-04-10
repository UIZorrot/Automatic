import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { defaultAgentArgs, detectAgentBinary } from "./detect.mjs";
import { getMessages, postAgentMessage, postUserMessage } from "./client.mjs";
import { log, makePrompt, parseIntValue, splitCommandLine, truncate } from "./utils.mjs";

export function buildTranscript(messages, limit) {
  const tail = messages.slice(Math.max(0, messages.length - limit));
  return tail
    .map((message) => {
      const role = message.sender === "agent" ? "AGENT" : "USER";
      return `${role}: ${message.content}`;
    })
    .join("\n");
}

export function createState(channelId, config) {
  return {
    channelId,
    history: [],
    seenIds: new Set(),
    lastId: 0,
    errorStreak: 0,
    stopped: false,
    historyLimit: config.historyLimit,
    replyLimit: config.replyLimit,
    apiKey: config.apiKey,
    agentKind: config.agentKind,
    agentBin: config.agentBin,
    agentArgs: config.agentArgs,
    promptTemplate: config.promptTemplate,
  };
}

function appendUniqueMessage(state, message) {
  if (state.seenIds.has(message.id)) return false;
  state.seenIds.add(message.id);
  state.history.push(message);
  return true;
}

function resolveAgentCommand(state, prompt) {
  const kind = String(state.agentKind || "hermes").toLowerCase();
  const bin = state.agentBin || detectAgentBinary(kind);
  const templateArgs = state.agentArgs?.length ? state.agentArgs : defaultAgentArgs(kind);
  const args = [];
  let insertedPrompt = false;
  for (const part of templateArgs) {
    if (part === "{prompt}") {
      args.push(prompt);
      insertedPrompt = true;
    } else {
      args.push(part);
    }
  }
  if (!insertedPrompt) args.push(prompt);
  return { kind, bin, args };
}

function parseAgentOutput(kind, output) {
  const text = String(output ?? "").replace(/\r/g, "").trim();
  if (!text) return "";

  if (kind === "codex") {
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i];
      if (!line.startsWith("tokens used") && !line.startsWith("warning:")) {
        return line;
      }
    }
    return lines[lines.length - 1] || "";
  }

  const lines = text.split("\n");
  const cleaned = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (cleaned.length > 0 && cleaned[cleaned.length - 1] !== "") {
        cleaned.push("");
      }
      continue;
    }
    if (trimmed.startsWith("session_id:")) break;
    if (trimmed.startsWith("╭") || trimmed.startsWith("╰") || trimmed.startsWith("│")) continue;
    cleaned.push(line.trimEnd());
  }
  while (cleaned.length && cleaned[0] === "") cleaned.shift();
  while (cleaned.length && cleaned[cleaned.length - 1] === "") cleaned.pop();
  return cleaned.join("\n").trim();
}

function runAgent(state, prompt) {
  return new Promise((resolve, reject) => {
    const { kind, bin, args } = resolveAgentCommand(state, prompt);
    const child = spawn(bin, args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    const timeoutMs = parseIntValue(process.env.BRIDGE_AGENT_TIMEOUT_MS, 120_000);
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 3000).unref?.();
      reject(new Error(`${kind} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`${kind} exited with code ${code}: ${stderr.trim() || stdout.trim()}`));
        return;
      }
      const reply = parseAgentOutput(kind, stdout || stderr);
      resolve(reply);
    });
  });
}

export async function bootstrapChannel(state, baseUrl) {
  const data = await getMessages(baseUrl, state.channelId, 0, "all");
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  state.history = [];
  state.seenIds = new Set();
  for (const message of messages) appendUniqueMessage(state, message);
  state.lastId = messages.length ? messages[messages.length - 1].id : 0;
  log(`channel=${state.channelId}`, `bootstrapped last_id=${state.lastId} history=${state.history.length}`);
}

export async function processUserMessage(state, baseUrl, message) {
  const transcript = buildTranscript(state.history, state.historyLimit);
  const prompt = makePrompt(state.promptTemplate, {
    channelId: state.channelId,
    message: message.content,
    history: transcript || "(no prior conversation)",
    prompt: "",
  });
  log(`channel=${state.channelId}`, `asking agent for user message #${message.id}`);
  const replyRaw = await runAgent(state, prompt);
  const reply = truncate(replyRaw.trim(), state.replyLimit);
  if (!reply) {
    log(`channel=${state.channelId}`, `agent returned empty reply for message #${message.id}`);
    return null;
  }
  const result = await postAgentMessage(baseUrl, state.channelId, reply, state.apiKey);
  const posted = result?.message;
  if (posted) appendUniqueMessage(state, posted);
  log(`channel=${state.channelId}`, `posted agent reply${posted?.id ? ` #${posted.id}` : ""}`);
  return posted ?? result ?? null;
}

export async function stepChannel(state, baseUrl) {
  const data = await getMessages(baseUrl, state.channelId, state.lastId, "all");
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  if (!messages.length) return [];

  const userMessages = [];
  for (const message of messages) {
    appendUniqueMessage(state, message);
    if (message.id > state.lastId) state.lastId = message.id;
    if (message.sender === "user") userMessages.push(message);
  }

  const results = [];
  for (const userMessage of userMessages) {
    results.push(await processUserMessage(state, baseUrl, userMessage));
  }
  return results;
}

export async function runLoop(state, baseUrl, pollIntervalMs) {
  while (!state.stopped) {
    try {
      await stepChannel(state, baseUrl);
      state.errorStreak = 0;
      await sleep(pollIntervalMs);
    } catch (error) {
      state.errorStreak += 1;
      const backoff = Math.min(15_000, pollIntervalMs * Math.min(8, 2 ** state.errorStreak));
      log(`channel=${state.channelId}`, `poll failed`, error?.message || error, `backoff=${backoff}ms`);
      await sleep(backoff);
    }
  }
}

export async function runSmoke(baseUrl, state, probeText, timeoutMs = 60_000) {
  const probe = probeText || `automatic-bridge-smoke-${Date.now()}`;
  const startAt = Date.now();
  const created = await postUserMessage(baseUrl, state.channelId, probe);
  const createdId = created?.message?.id ?? created?.id ?? null;
  log(`channel=${state.channelId}`, `probe sent${createdId ? ` #${createdId}` : ""}`, JSON.stringify(probe));

  while (Date.now() - startAt < timeoutMs) {
    const result = await stepChannel(state, baseUrl);
    if (result.length > 0) return { probe, created, result };
    await sleep(1000);
  }

  throw new Error(`Smoke test timed out after ${timeoutMs}ms`);
}
