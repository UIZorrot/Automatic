# Hermes × Automatic：本地桥接方案说明

本文档说明如何把 Automatic 做成 Hermes 的轻量级原生通讯方案，目标是尽量替代 Telegram 这类重型消息工具。

## 结论先说

Automatic 不是一个给 Hermes 加“插件”的问题，而是一个“常驻消息桥（bridge / adapter）”的问题。

如果只写 skill 或提示词：
- 可以让 Hermes“知道怎么用” Automatic
- 但不能让 Hermes“自动收到消息”
- 也不能保证消息一来就被处理

如果要接近 Telegram 的体验：
- 必须有一个常驻 bridge
- bridge 负责自动收消息、喂给 Hermes、再把 Hermes 回复写回 Automatic

## 目标

把 Automatic 做成 Hermes 的一个本地通信通道，让它具备下面的行为：

1. 用户在 Automatic 频道发消息
2. Bridge 自动收到消息
3. Hermes 自动接到这条消息并生成回复
4. Bridge 自动把回复发回 Automatic
5. 前端通过 SSE 或消息列表看到 agent 回复

这才是“像 Telegram 一样”的体验。

## 为什么 plugin 不够

plugin / skill 的问题在于：

- 它是“能力补充”，不是“常驻收件人”
- 它通常依赖 Hermes 已经在运行，并且有人把输入送进去
- 它不能单独解决“消息到达 agent 这一刻”

而你现在真正缺的是：

- 一个一直在线的接收器
- 一个把频道消息转成 Hermes 输入的中间层
- 一个把 Hermes 输出转回频道的发送器

所以，核心不是 plugin，而是 bridge。

## 推荐架构

### 1) Automatic 负责消息通道

Automatic 已经提供了这些接口：

- `POST /api/channels/[channelId]/user-message`
- `POST /api/channels/[channelId]/agent-message`
- `GET /api/channels/[channelId]/messages`
- `GET /api/channels/[channelId]/stream`

其中：

- `user-message`：用户发给 Agent
- `agent-message`：Agent 回给用户
- `messages`：用于轮询拉取历史或增量消息
- `stream`：用于前端实时展示 agent 消息

### 2) Bridge 负责自动化

Bridge 是一个本地常驻进程，职责是：

- 轮询或订阅 `user-message` 的结果
- 检测到新用户消息后，自动调用 Hermes
- 拿到 Hermes 回复后，调用 `agent-message`

### 3) Hermes 负责推理

Hermes 不需要知道 Automatic 的细节。
Hermes 只需要像“正常接收一条消息”一样工作。

## 消息流

推荐的最小闭环：

1. 用户发消息到 Automatic
   - `POST /api/channels/{channelId}/user-message`

2. Bridge 收到新用户消息
   - `GET /api/channels/{channelId}/messages?role=user&since_id={last_id}`
   - 或者如果后续做得更好，就直接订阅一个推送型接口

3. Bridge 调用 Hermes
   - 把用户消息作为输入交给 Hermes
   - 让 Hermes 生成回复

4. Bridge 回写到 Automatic
   - `POST /api/channels/{channelId}/agent-message`

5. 前端通过 SSE 展示
   - `GET /api/channels/{channelId}/stream`

## 现在这套方案的现实状态

当前 Automatic 更像：

- 消息存储
- 前端展示
- agent 回写接口

它还不是完整的“自动化消息系统”，原因是：

- agent 消息的收发还没有一个独立、持续运行的 bridge
- 用户消息到 Hermes 之间还需要人工触发或外部守护进程
- 轮询有延迟，不是真正意义上的即时投递

所以：

- 可以用
- 但还不能完全替代 Telegram 的丝滑感

## 最小可用方案（推荐先做这个）

### 方案 A：本地轮询 bridge

这是最容易落地的版本。

Bridge 做两件事：

1. 每 1~2 秒轮询一次：
   - `GET /messages?role=user&since_id=...`
2. 发现新消息后：
   - 调 Hermes
   - 再 `POST /agent-message`

优点：
- 简单
- 不需要改 Hermes 核心
- 不需要改 Automatic 数据库结构

缺点：
- 有轻微延迟
- 不是严格实时

### 方案 B：推送型 bridge

如果后面想更像 Telegram：

- 让 Automatic 在用户消息写入时，同时推送给 bridge
- bridge 立即唤醒 Hermes

这会更顺滑，但实现复杂度更高。

## 为什么我建议先做 bridge，不做 plugin

因为你说得很对：

- 你大概率不会去 Hermes 仓库提 PR
- 你只是想自己用
- 你要的是“能跑、能自动收消息、能自动回复”

那最合适的是：

- 不动 Hermes 仓库
- 在本地起一个 bridge
- 把 Automatic 当成 Hermes 的消息输入输出层

这比 plugin 更直接，也更稳定。

## 推荐落地路径

1. 保持 Automatic 现有接口不变
2. 写一个本地 bridge 进程
3. bridge 轮询 `user` 消息
4. bridge 把消息送给 Hermes
5. Hermes 回复后，bridge 调 `agent-message`
6. 前端继续用 SSE 展示结果

## 需要注意的缺陷

当前体系还有几个天然限制：

- 轮询会带来延迟
- 如果 bridge 断了，消息不会自动处理
- 如果未来是多实例部署，内存级订阅不可靠
- 如果想做到真正“像 Telegram”，后面最好改成推送式或消息队列式架构

## 结论

Automatic 可以成为 Hermes 的轻量级原生通讯方案，但前提不是 plugin，而是一个常驻 bridge。

换句话说：

- plugin 解决“会不会用”
- bridge 解决“能不能自动收到并回复”

你现在需要的是后者。
