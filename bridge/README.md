# automatic-bridge

A small npm bridge that connects Automatic channels to Hermes or Codex CLI.

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

- `BRIDGE_AGENT_KIND=hermes|codex`
- `HERMES_CLI_BIN`
- `CODEX_CLI_BIN`
- `HERMES_CLI_ARGS`
- `CODEX_CLI_ARGS`
- `AGENT_API_KEY`
- `BRIDGE_POLL_INTERVAL_MS`
- `BRIDGE_HISTORY_LIMIT`
- `BRIDGE_REPLY_LIMIT`
- `BRIDGE_AGENT_TIMEOUT_MS`

## Smoke test

```bash
npx automatic-bridge smoke
```

This sends a probe message to the first configured channel and waits for the bridge to process it.
