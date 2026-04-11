# web_channel_skill（Agent 协议版）

这个仓库的目标是：用非常轻量的 HTTP + SSE 通道，替代 Telegram 这类重型工具，让 Agent 和用户直接沟通。

重要约定：
- 浏览器只负责用户侧 UI，不是 Agent 测试入口。
- Agent 必须以“agent 身份”发消息。
- 用户消息走 `user-message`。
- Agent 消息走 `agent-message`。
- 实时接收走 `stream`（SSE）。

当用户提供：
- `base_url`（例如 `https://your-app.vercel.app`）
- `channel_id`（32位小写字母数字）

你应按以下规则与用户聊天。

## 1) Agent 发消息给用户
请求：
- 方法：`POST`
- 地址：`{base_url}/api/channels/{channel_id}/agent-message`
- Header：
- `Content-Type: application/json`
  - 如果是受密码保护的房间，先用房间密码登录拿到会话 cookie
- Body(JSON):

```json
{
  "content": "这里是Agent回复内容"
}
```

说明：
- 这是 Agent 侧接口，写入的消息 sender 应为 `agent`。
- 受密码保护的房间要先登录，之后用会话 cookie 访问。
- 这条接口不依赖浏览器 UI。

## 2) Agent 拉取用户消息（轮询）
请求：
- 方法：`GET`
- 地址：`{base_url}/api/channels/{channel_id}/messages?role=user&since_id={last_id}`

返回示例：

```json
{
  "messages": [
    {
      "id": 12,
      "channelId": "a3f9k2m7p9q1x8v4b6n0z5c7d2e8f1g9",
      "sender": "user",
      "content": "你好",
      "timestamp": "2026-04-09T08:00:00.000Z"
    }
  ]
}
```

## 3) 实时接收
前端用户通过 SSE 监听：
- `GET {base_url}/api/channels/{channel_id}/stream`

Agent 端通常不需要直接订阅 SSE；如果你在做 headless 测试，可以同时监听 `stream` 来确认 agent 消息已到达前端。

## 4) 轮询策略
- 每 `1-2` 秒请求一次用户消息。
- 初始 `last_id=0`。
- 若返回有消息，则更新 `last_id` 为最后一条的 `id`。
- 遇到网络错误时指数退避重试（1s, 2s, 4s，最大 15s）。

## 5) 行为要求
- 只处理 `sender=user` 的新消息。
- 每次需要回复时，都必须以 `agent` 身份调用一次 `agent-message`。
- 不要通过浏览器模拟 Agent 发言；浏览器只适合验证用户侧 UI。
- 房间密码只约束前端用户访问，不影响 Agent 通道本身。

## 6) 最小化调试流程
1. 用户侧发送：`POST /user-message`
2. Agent 轮询：`GET /messages?role=user&since_id=...`
3. Agent 回写：`POST /agent-message`
4. 前端/测试端从 `GET /stream` 或 `GET /messages?role=all` 验证收到 `sender=agent` 的新消息
