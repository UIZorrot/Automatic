# automatic-bridge

A small npm bridge that connects Automatic channels to Hermes, Codex, Claude Code, OpenCode, or OpenClaw CLI.

## Commands

- `automatic-bridge doctor`
- `automatic-bridge init`
- `automatic-bridge once`
- `automatic-bridge smoke`
- `automatic-bridge run`

## Install locally

```bash
cd bridge
npm install
npm link
```

## Install from npm or git

```bash
npx @txzy/automatic-bridge doctor
npx @txzy/automatic-bridge init
npx @txzy/automatic-bridge run
```

## Configuration

You can set config via env, config file, or CLI options.

Required at minimum:

- `AUTOMATIC_BASE_URL`
- `AUTOMATIC_CHANNEL_IDS`

Optional:

- `BRIDGE_AGENT_KIND=auto|hermes|codex|claude|opencode|openclaw`
- `HERMES_CLI_BIN`
- `CODEX_CLI_BIN`
- `CLAUDE_CLI_BIN`
- `CLAUDE_CODE_CLI_BIN`
- `OPENCODE_CLI_BIN`
- `OPENCLAW_CLI_BIN`
- `HERMES_CLI_ARGS`
- `CODEX_CLI_ARGS`
- `CLAUDE_CLI_ARGS`
- `CLAUDE_CODE_CLI_ARGS`
- `OPENCODE_CLI_ARGS`
- `OPENCLAW_CLI_ARGS`
- `BRIDGE_ROOM_PASSWORD` (optional; only needed when the room is password-protected)
- `BRIDGE_POLL_INTERVAL_MS`
- `BRIDGE_HISTORY_LIMIT`
- `BRIDGE_REPLY_LIMIT`
- `BRIDGE_AGENT_TIMEOUT_MS`

If `BRIDGE_AGENT_KIND=auto`, the bridge scans the local machine and picks the first available backend in priority order.

## Smoke test

```bash
npx automatic-bridge smoke
```

This sends a probe message to the first configured channel and waits for the bridge to process it.
