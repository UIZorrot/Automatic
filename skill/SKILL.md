---
name: automatic-agent-self-bootstrap
description: Self-bootstrap and operate an Automatic bridge on a clean machine so an agent like Hermes, Codex, or Claude can connect to Automatic, read user messages, and post replies back without browser automation.
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [automatic, bridge, self-bootstrap, codex, hermes-cli, agent-message, user-message, sse, http]
---

# Automatic agent self-bootstrap

Use this skill when you need an agent to set up and run an Automatic channel bridge on a fresh machine.

## Goal

Make Automatic behave like a lightweight messaging channel for an agent process:

- receive user messages from Automatic
- call the configured agent CLI
- post agent replies back to Automatic
- verify the flow with headless HTTP/SSE, not browser clicks

## When to use

- You are on a clean machine and want the agent to configure itself.
- You want Codex, Hermes, Claude Code, or another CLI agent to work through Automatic.
- You want a repeatable setup path for install, config, smoke test, and long-running operation.

## Preconditions

Check these first:

- Node.js is installed and reasonably current.
- `curl` is available.
- The Automatic repo is cloned locally.
- The agent CLI binary exists and is executable.
- You know the Automatic base URL and target channel IDs.

## Recommended layout

Keep the bridge as a standalone npm package inside the repo, for example:

- `bridge/package.json`
- `bridge/bin/automatic-bridge.js`
- `bridge/src/*.mjs`

Expose the CLI as:

- `npx automatic-bridge doctor`
- `npx automatic-bridge init`
- `npx automatic-bridge smoke`
- `npx automatic-bridge once`
- `npx automatic-bridge run`

The root app can still keep convenience scripts that call the bridge bin, but the bridge itself should be publishable as a separate package.

## Required environment variables

Set these before running the bridge:

- `AUTOMATIC_BASE_URL=http://127.0.0.1:3000`
- `AUTOMATIC_CHANNEL_IDS=<channelId1,channelId2,...>`
- `BRIDGE_AGENT_KIND=hermes|codex|claude`
- `BRIDGE_POLL_INTERVAL_MS=1500`
- `BRIDGE_HISTORY_LIMIT=12`
- `BRIDGE_REPLY_LIMIT=1900`
- `BRIDGE_AGENT_TIMEOUT_MS=120000`
- `AGENT_API_KEY` optional, only if your deployment protects `agent-message`
- `HERMES_CLI_BIN=/path/to/hermes` or `CODEX_CLI_BIN=codex`
- `HERMES_CLI_ARGS=chat,-Q,--source,automatic-bridge,-q,{prompt}`
- `CODEX_CLI_ARGS=exec,--skip-git-repo-check,--full-auto,{prompt}`

Note: the bridge package should auto-detect the CLI binary when possible, then fall back to these env vars or config file values.

## Self-bootstrap flow

1. Verify prerequisites.
   - Check Node, curl, repo access, and CLI binary path.
2. Enter the bridge package.
   - `cd bridge`
3. Install if needed.
   - `npm install` (or rely on `npx` if published)
4. Initialize config.
   - `npx automatic-bridge init`
5. Smoke test.
   - `npx automatic-bridge smoke`
6. Start the bridge.
   - `npx automatic-bridge run`
7. Validate message flow.
   - Confirm a user message appears in Automatic.
   - Confirm the bridge posts a corresponding agent reply.
   - Confirm history is readable through `/api/channels/{channelId}/messages`.

## Bridge behavior

The bridge should use these Automatic endpoints:

- `POST /api/channels/{channelId}/user-message`
- `POST /api/channels/{channelId}/agent-message`
- `GET /api/channels/{channelId}/messages`
- `GET /api/channels/{channelId}/stream`

Bridge loop:

1. Fetch history and remember the last seen message ID.
2. Poll for new messages with `since_id`.
3. Ignore messages already processed.
4. When a new user message arrives:
   - build a prompt from recent transcript + latest user text
   - call the configured agent CLI
   - trim or normalize the reply if needed
   - post the reply back as an agent message
5. Sleep, then repeat.

## Prompt construction rules

- Keep prompts deterministic and concise.
- Include just enough recent context to answer correctly.
- Use a `{prompt}` placeholder for CLI invocation instead of shell-concatenating raw text.
- Prefer non-interactive CLI flags so the bridge can run unattended.

## Verification

A valid setup should pass these checks:

- `node --check bridge/bin/automatic-bridge.js`
- `npx automatic-bridge doctor` completes and reports a reachable setup
- `npx automatic-bridge smoke` completes without crashing
- Sending a user message produces a visible agent reply
- `GET /api/channels/{channelId}/messages?role=all` shows both sides
- Restarting the bridge does not resend old messages

## Common failure modes

- Wrong CLI binary path
- Missing environment variables
- Wrong argument order for the agent CLI
- Duplicate message processing after restart
- Using browser automation instead of the HTTP/SSE API
- Assuming SSE alone is the source of truth for the bridge

## Opinionated guidance

- Keep the bridge separate from the main app code.
- Keep the skill focused on setup and operational conventions.
- Package the runtime bridge as an npm CLI if you want easy installs, versioning, and cleaner reuse across machines.
- If you support multiple agent CLIs, keep the same bridge contract and swap only the invocation layer.

## Minimal success criteria

A fresh machine is considered ready when:

- dependencies install cleanly
- the bridge starts
- a user message is received
- an agent reply is posted back
- history reflects both sides correctly
