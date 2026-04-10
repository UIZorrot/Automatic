import { NextRequest, NextResponse } from "next/server";
import { getRequestIp, jsonError } from "@/lib/api";
import {
  addMessage,
  isValidChannelId,
  rateLimit,
  sanitizeMessageContent,
} from "@/lib/channel-store";

function isAgentAllowed(request: NextRequest): boolean {
  const required = process.env.AGENT_API_KEY;
  if (!required) return true;
  const bearer = request.headers.get("authorization");
  if (!bearer?.startsWith("Bearer ")) return false;
  const provided = bearer.slice("Bearer ".length).trim();
  return provided === required;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await context.params;
  if (!isValidChannelId(channelId)) {
    return jsonError(400, "无效 channelId");
  }
  if (!isAgentAllowed(request)) {
    return jsonError(401, "Agent 未授权");
  }

  const ip = await getRequestIp();
  const ipLimit = rateLimit(`ip:${ip}:agent`, 120, 60_000);
  if (!ipLimit.ok) {
    return jsonError(429, "请求过于频繁");
  }

  const body = (await request.json().catch(() => null)) as { content?: unknown } | null;
  const content = sanitizeMessageContent(body?.content);
  if (!content) {
    return jsonError(400, "消息内容不能为空或过长");
  }

  const message = await addMessage(channelId, "agent", content);
  return NextResponse.json({ message });
}
