## Agent Remote Chat

一个基于 Next.js 的远程 Agent 聊天工具：
- 用户通过 `32位 channelId` 进入房间聊天
- 房间密码为可选，默认无密码
- 密码只影响前端用户访问，不影响 Agent 接口
- 消息和房间密码已使用 Postgres 持久化

## 本地启动

1. 安装依赖：

```bash
npm install
```

2. 复制环境变量：

```bash
copy .env.example .env.local
```

3. 配置数据库连接（`DATABASE_URL` 或 `DATABASE_*` 分字段，二选一）

4. 启动开发服务器：

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 数据库说明

- 使用 PostgreSQL（推荐 Supabase / Vercel Postgres / Neon）。
- 应用启动后会自动创建 schema 和表：
- `channel_messages`：聊天消息
- `channel_rooms`：房间密码哈希
- schema 由 `DATABASE_SCHEMA` 控制（默认 `public`）。
- `DATABASE_SSL=false` 可关闭 SSL（本地自建 Postgres 常用）。

## 主要接口

- `POST /api/channels/[channelId]/user-message`
- `POST /api/channels/[channelId]/agent-message`
- `GET /api/channels/[channelId]/messages`
- `GET /api/channels/[channelId]/stream`
- `POST /api/channels/[channelId]/auth/set-password`
- `POST /api/channels/[channelId]/auth/login`
- `POST /api/channels/[channelId]/auth/logout`
- `GET /api/channels/[channelId]/auth/status`

## Agent 对接

参考根目录文档：
- `docs/web_channel_skill.md`

## Hermes / Codex 桥接（本地常驻）

如果你想把 Automatic 当成轻量级原生通讯方案，直接起本地 bridge。

Hermes：

```bash
AUTOMATIC_BASE_URL=http://127.0.0.1:3000 \
AUTOMATIC_CHANNEL_IDS=<your_channel_id> \
BRIDGE_AGENT_KIND=hermes \
HERMES_CLI_BIN=/home/zr/.hermes/hermes-agent/venv/bin/hermes \
HERMES_CLI_ARGS='chat,-Q,--source,automatic-bridge,-q,{prompt}' \
npm run bridge
```

Codex：

```bash
AUTOMATIC_BASE_URL=http://127.0.0.1:3000 \
AUTOMATIC_CHANNEL_IDS=<your_channel_id> \
BRIDGE_AGENT_KIND=codex \
CODEX_CLI_BIN=codex \
CODEX_CLI_ARGS='exec,--skip-git-repo-check,--full-auto,{prompt}' \
npm run bridge
```

环境变量见 `.env.example`。

## 全新电脑安装步骤

1. 安装 Node.js 20+
2. 克隆 Automatic 仓库
3. 进入仓库执行 `npm install`
4. 复制 `.env.example` 到 `.env.local` 并填好数据库连接
5. 启动应用：`npm run dev`
6. 配好 Hermes 或 Codex CLI：
   - Hermes：确保 `hermes` 可执行，或填绝对路径
   - Codex：确保 `codex` 可执行，或填绝对路径
7. 启动 bridge：`npm run bridge`
8. 在频道里发一条消息测试

## 如果想让 Codex 支持这个通道

不需要改 Codex 仓库本身，也不需要改 Hermes。

只要让 bridge 用 Codex CLI 当后端即可：

- `BRIDGE_AGENT_KIND=codex`
- `CODEX_CLI_BIN=codex`
- `CODEX_CLI_ARGS=exec,--skip-git-repo-check,--full-auto,{prompt}`

bridge 会把 Automatic 的消息整理成 prompt，再把 prompt 交给 Codex CLI；Codex 的输出会被回写到 `agent-message`。

## 部署（Vercel）

1. 推送 `web-agent-control` 到 GitHub 仓库。
2. Vercel 新建项目并设置 Root Directory 为 `web-agent-control`。
3. 在 Vercel Environment Variables 添加：
- `CHANNEL_AUTH_SECRET`
- `BRIDGE_ROOM_PASSWORD`（仅在房间设了密码时需要）
- `DATABASE_URL`（或全套 `DATABASE_*`）
4. 部署后访问首页并创建频道测试。
5. Agent 侧将 `base_url` 指向你的 Vercel 域名。

## Git 忽略规则

- `.env*` 已被忽略，不会提交真实密钥。
- `.env.example` 被显式保留，可安全提交。
