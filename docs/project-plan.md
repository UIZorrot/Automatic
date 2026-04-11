# Agent Remote Chat 项目完整计划

## 1. 目标与原则
- 目标：提供一个公开网页，用户通过 `channelId` 与 Agent 远程聊天。
- 原则：优先最小可用（MVP），先跑通，再增强。
- 约束：房间密码是“可选项”，默认无密码；密码仅用于前端用户访问控制，与 Agent 无关。

## 2. 核心需求拆分
- 公共首页：输入 `32位 channelId` 或一键随机生成。
- 聊天页：`/c/[channelId]`，可设置/输入房间密码，展示消息并发送消息。
- Agent 接入：Agent 拿到 `backendBaseUrl + channelId` 即可收发消息。
- 后端接口：统一放在 `app/api/channels/[channelId]/...` 下。

## 3. 安全模型（按你的新要求）
- `channelId`：房间标识，可公开分享。
- `roomPassword`（可选）：仅用于“前端用户进入房间和调用用户侧接口”。
- Agent 不需要、也不感知 `roomPassword`。
- 未设置密码时：房间默认开放。
- 设置密码后：前端必须先验证，后续请求带短时会话令牌（HttpOnly Cookie）。
- 结果：没有密码无法登录房间，也无法调用用户侧 Next.js 接口。

## 4. API 设计（MVP）
目录：`app/api/channels/[channelId]/...`

1) `POST /user-message`
- 作用：用户发送消息给 Agent。
- 调用方：前端。
- 鉴权：需要通过“房间访问校验”（无密码房间可直接通过；有密码需已登录会话）。

2) `POST /agent-message`
- 作用：Agent 发送消息给用户。
- 调用方：Agent Skill。
- 鉴权：受密码保护的房间需先登录后再读写；不再使用单独的全局机器密钥。

3) `GET /messages`
- 作用：Agent 拉取用户消息（轮询）。
- 调用方：Agent Skill。
- 参数：`since_id`（推荐）或 `since_ts`（兼容）。

4) `GET /stream`
- 作用：前端实时接收 Agent 消息（SSE）。
- 调用方：前端。
- 鉴权：同用户侧接口，需通过房间访问校验。

新增（为支持可选密码）：

5) `POST /auth/set-password`
- 作用：进入房间后设置密码（仅首次或覆盖策略按配置）。
- 调用方：前端。
- 说明：默认无密码，用户可主动设置。

6) `POST /auth/login`
- 作用：提交房间密码，换取会话 Cookie。
- 调用方：前端。

7) `POST /auth/logout`
- 作用：清理房间会话。

8) `GET /auth/status`
- 作用：判断当前浏览器是否已通过该房间访问验证。

## 5. 数据层方案
### 5.1 MVP（推荐）
- 使用 Redis（Upstash/Vercel KV）：
  - `channel:{id}:messages`（List/Stream）
  - `channel:{id}:meta`（Hash：是否有密码、密码哈希、创建时间）
  - `channel:{id}:ratelimit:*`
- 优势：实现快、SSE/轮询都方便。

### 5.2 后续升级
- 切到 Postgres（Prisma）做长期持久化与检索。

## 6. 前端页面与交互
### 6.1 首页 `/`
- 输入框：支持粘贴 `channelId`。
- 按钮：生成 32 位随机 `a-z0-9` 字符串。
- 按钮：进入房间。

### 6.2 聊天页 `/c/[channelId]`
- 顶部状态：房间 ID、密码状态（未设置/已设置）。
- 密码区：
  - 未设置时：显示“可选设置密码”入口。
  - 已设置时：未登录显示密码输入；登录后显示“已解锁”。
- 消息区：区分 `User`/`Agent`。
- 发送区：输入框 + 发送按钮。
- 实时：SSE 失败后自动切换到轮询兜底。

## 7. 关键实现细节
- `channelId` 校验：仅允许 `^[a-z0-9]{32}$`。
- 密码哈希：`scrypt` 或 `bcrypt`（不存明文）。
- 会话策略：
  - Cookie 名：按房间隔离（例如 `ch_auth_<shortId>`）。
  - 有效期：24 小时（可配置）。
- 消息模型（统一）：
  - `id`, `channelId`, `sender(user|agent)`, `content`, `timestamp`
- 防滥用：
  - 每房间每分钟 30 条（用户侧）。
  - 每 IP 每分钟限制。
  - 单条消息长度上限（如 2000）。

## 8. Agent Skill 方案
### 8.1 推荐先用 `web_channel_skill.md`
- 内容：接口调用规范 + 轮询建议 + 错误重试。
- 适用：OpenClaw/Hermes 已有 HTTP 能力。

### 8.2 可选 `web_channel_skill.py`
- 封装 `send_to_user` / `poll_user_messages`。
- 内置重试、超时、去重。

## 9. 交付里程碑
- M1：项目初始化 + 首页 + 聊天页骨架。
- M2：4 个主接口打通（无密码流程）。
- M3：可选密码功能（set/login/status/logout）完成。
- M4：限流 + 输入校验 + 错误处理。
- M5：Skill 文档 + 部署说明。

## 10. 风险与应对
- SSE 在 serverless 可能偶发断流：客户端自动重连 + 轮询兜底。
- channelId 泄露导致房间暴露：通过可选密码与会话校验缓解。
- 接口被滥刷：限流 + 可选全局 Agent Key + 基础日志。

## 11. 成功标准
- 用户可在手机/桌面进入公共网页并与 Agent 连续对话。
- 无密码房间开箱即用；设置密码后未授权访问被拦截。
- Agent 不需要知道密码，仍可正常接收用户消息并回复。
