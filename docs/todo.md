# TODO（MVP 到可上线）

## 阶段 A：文档与设计
- [x] 输出完整项目计划（含可选房间密码设计）
- [x] 明确 API 清单与调用方边界（User / Agent）
- [x] 定义安全边界：密码只影响用户侧，不影响 Agent

## 阶段 B：项目初始化
- [x] 初始化 Next.js 15（App Router + TypeScript）
- [x] 配置 Tailwind CSS
- [ ] 集成 shadcn/ui 基础组件
- [x] 增加环境变量模板（`.env.example`）

## 阶段 C：前端页面
- [x] 首页 `/`：输入 channelId、随机生成、跳转
- [x] 聊天页 `/c/[channelId]`：消息列表、发送输入框
- [x] 密码卡片：设置密码/输入密码/登录状态
- [x] SSE 接收 Agent 消息，失败自动轮询兜底

## 阶段 D：后端 API
- [x] `POST /api/channels/[channelId]/user-message`
- [x] `POST /api/channels/[channelId]/agent-message`
- [x] `GET /api/channels/[channelId]/messages`
- [x] `GET /api/channels/[channelId]/stream`
- [x] `POST /api/channels/[channelId]/auth/set-password`
- [x] `POST /api/channels/[channelId]/auth/login`
- [x] `POST /api/channels/[channelId]/auth/logout`
- [x] `GET /api/channels/[channelId]/auth/status`

## 阶段 E：数据与安全
- [ ] Redis KV 封装（消息、房间元信息、限流计数）
- [x] 密码哈希存储（bcrypt/scrypt）
- [x] 房间级 + IP 级限流
- [x] 请求体校验与统一错误响应

## 阶段 F：Agent 接入
- [x] 编写 `docs/web_channel_skill.md`（协议型 skill）
- [ ] 给出 OpenClaw/Hermes 使用示例
- [x] 约定轮询间隔、重试、去重策略

## 阶段 G：验证与发布
- [x] 本地运行自测（双端对话打通）
- [x] 诊断/构建检查并修复问题
- [ ] 输出部署步骤（Vercel + KV）
- [ ] 输出后续升级路线（Postgres/Prisma）
