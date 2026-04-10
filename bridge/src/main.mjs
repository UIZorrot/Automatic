import path from "node:path";
import { commandAvailable, detectAgentBinary, detectAgentKind } from "./detect.mjs";
import { getAuthStatus } from "./client.mjs";
import { loadConfig, writeInitConfig } from "./config.mjs";
import { bootstrapChannel, createState, runLoop, runSmoke, stepChannel } from "./runner.mjs";
import { defaultConfigFile, log, pathExists } from "./utils.mjs";

function printUsage() {
  console.log(`automatic-bridge

Usage:
  automatic-bridge doctor [--config <path>]
  automatic-bridge init [--config <path>] [--force]
  automatic-bridge once [--config <path>]
  automatic-bridge smoke [--config <path>] [--probe-text <text>]
  automatic-bridge run [--config <path>]

Options are also read from env and config file.
`);
}

function parseArgv(argv) {
  const args = [...argv];
  const command = args.find((arg) => !arg.startsWith("--")) || "help";
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;
    const [flag, inline] = arg.slice(2).split(/=(.*)/s, 2);
    const key = flag.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (inline !== undefined) {
      options[key] = inline;
      continue;
    }
    const next = args[i + 1];
    if (next && !next.startsWith("--")) {
      options[key] = next;
      i += 1;
    } else {
      options[key] = true;
    }
  }
  return { command, options };
}

function summarizeConfig(config) {
  return {
    configPath: config.configPath,
    baseUrl: config.baseUrl,
    channelIds: config.channelIds,
    agentKind: config.agentKind,
    agentBin: config.agentBin,
    agentArgs: config.agentArgs,
    pollIntervalMs: config.pollIntervalMs,
    historyLimit: config.historyLimit,
    replyLimit: config.replyLimit,
    agentTimeoutMs: config.agentTimeoutMs,
    statePath: config.statePath,
    apiKeyPresent: Boolean(config.apiKey),
  };
}

async function commandDoctor(config) {
  const report = {
    ...summarizeConfig(config),
    cliDetected: {
      kind: detectAgentKind(config.agentKind),
      binary: detectAgentBinary(config.agentKind),
    },
    checks: [],
  };

  if (!config.channelIds.length) {
    report.checks.push({ ok: false, check: "channelIds", message: "No channel IDs configured" });
  } else {
    report.checks.push({ ok: true, check: "channelIds", message: config.channelIds.join(",") });
  }

  report.checks.push({
    ok: Boolean(config.baseUrl),
    check: "baseUrl",
    message: config.baseUrl,
  });

  report.checks.push({
    ok: Boolean(config.agentBin),
    check: "agentBin",
    message: config.agentBin,
  });

  report.checks.push({
    ok: commandAvailable(config.agentBin),
    check: "agentBin:available",
    message: commandAvailable(config.agentBin) ? "available" : "not found",
  });

  if (config.channelIds[0]) {
    try {
      const auth = await getAuthStatus(config.baseUrl, config.channelIds[0]);
      report.checks.push({ ok: true, check: "auth/status", message: auth });
    } catch (error) {
      report.checks.push({ ok: false, check: "auth/status", message: error?.message || String(error) });
    }
  }

  const ok = report.checks.every((check) => check.ok);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = ok ? 0 : 1;
}

async function commandInit(config, options) {
  const targetPath = path.resolve(String(options.configPath || config.configPath || defaultConfigFile()));
  const force = Boolean(options.force);
  if (!force && await pathExists(targetPath)) {
    console.log(`[automatic-bridge] config exists: ${targetPath} (use --force to overwrite)`);
    return;
  }
  const payload = await writeInitConfig(targetPath, config);
  console.log(JSON.stringify({ written: targetPath, config: payload }, null, 2));
}

async function loadStates(config) {
  return config.channelIds.map((channelId) => createState(channelId, config));
}

async function bootstrapAll(states, config) {
  for (const state of states) {
    await bootstrapChannel(state, config.baseUrl);
  }
}

async function commandOnce(config) {
  const states = await loadStates(config);
  await bootstrapAll(states, config);
  let processed = 0;
  for (const state of states) {
    const results = await stepChannel(state, config.baseUrl);
    processed += results.filter(Boolean).length;
  }
  console.log(JSON.stringify({ ok: true, processed, channels: config.channelIds }, null, 2));
}

async function commandSmoke(config, options) {
  if (!config.channelIds.length) {
    throw new Error("smoke requires at least one channel id");
  }
  const state = createState(config.channelIds[0], config);
  await bootstrapChannel(state, config.baseUrl);
  const probeText = options.probeText || `automatic-bridge-smoke-${Date.now()}`;
  const result = await runSmoke(config.baseUrl, state, probeText, Number(options.timeoutMs || config.agentTimeoutMs || 60_000));
  console.log(JSON.stringify({ ok: true, probeText, result: { created: Boolean(result.created), replyCount: result.result.length } }, null, 2));
}

async function commandRun(config) {
  if (!config.channelIds.length) {
    throw new Error("No channel IDs configured");
  }
  const states = await loadStates(config);
  await bootstrapAll(states, config);
  const shutdown = () => {
    log("shutdown requested");
    for (const state of states) state.stopped = true;
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  await Promise.all(states.map((state) => runLoop(state, config.baseUrl, config.pollIntervalMs)));
}

export async function main(argv = process.argv.slice(2)) {
  const { command, options } = parseArgv(argv);
  if (command === "help" || options.help || options.h) {
    printUsage();
    return;
  }

  const config = await loadConfig(options, { argv });

  switch (command) {
    case "doctor":
      await commandDoctor(config);
      return;
    case "init":
      await commandInit(config, options);
      return;
    case "once":
      await commandOnce(config);
      return;
    case "smoke":
      await commandSmoke(config, options);
      return;
    case "run":
      await commandRun(config);
      return;
    default:
      printUsage();
      process.exitCode = 1;
  }
}
