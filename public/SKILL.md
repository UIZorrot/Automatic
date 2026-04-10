---
name: automatic-agent-bridge
description: Connect an agent CLI to Automatic using the published npm bridge package.
version: 1.0.0
author: Hermes Agent
license: MIT
---

# Automatic agent bridge

This skill exists for one thing only:

Use the published npm bridge package to let an agent read Automatic messages and reply back.

## Install

Download this skill, then start the bridge package with the channel id:

```bash
AUTOMATIC_CHANNEL_IDS=<channel-id> npx @txzy/automatic-bridge run
```

## Defaults

- `AUTOMATIC_BASE_URL` defaults to `https://tool.auto.txzy.net`
- `BRIDGE_AGENT_KIND` is `hermes` or `codex`
- The bridge auto-detects the CLI binary when possible
- Do not restart the desktop app; just start the bridge and let it listen

## Platform support

- Works anywhere Node.js 18+ runs
- Codex auto-detect works on PATH, including Windows
- Hermes auto-detect checks Unix and Windows-style names; if it still misses, set `HERMES_CLI_BIN`
- In WSL, the bridge sees the WSL environment; if the CLI is only installed on Windows, point `HERMES_CLI_BIN` or `CODEX_CLI_BIN` at the actual executable or run the bridge on Windows

## Optional

If your deployment protects agent writes, set:

- `AGENT_API_KEY`

## If something is missing

- No channel id: ask the user for one.
- No CLI found: ask the user whether to use Hermes or Codex, then use the matching binary.
- Do not ask the user to switch workspaces.
- Do not ask the user to clone the bridge source repo.
- Do not use browser clicks for the bridge flow.
