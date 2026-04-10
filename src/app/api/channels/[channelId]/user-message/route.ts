import { NextRequest, NextResponse } from "next/server";
import { ensureUserRoomAccess, getRequestIp, jsonError } from "@/lib/api";
import {
  addMessage,
  isValidChannelId,
  rateLimit,
  sanitizeMessageContent,
} from "@/lib/channel-store";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await context.params;
  if (!isValidChannelId(channelId)) {
    return jsonError(400, "无效 channelId");
  }

  const access = await ensureUserRoomAccess(channelId);
  if (!access.ok) {
    return jsonError(401, access.reason ?? "未授权");
  }

  const ip = await getRequestIp();
  const roomLimit = rateLimit(`room:${channelId}:user`, 30, 60_000);
  if (!roomLimit.ok) {
    return jsonError(429, "房间发言过于频繁");
  }
  const ipLimit = rateLimit(`ip:${ip}:user`, 60, 60_000);
  if (!ipLimit.ok) {
    return jsonError(429, "IP 请求过于频繁");
  }

  const body = (await request.json().catch(() => null)) as { content?: unknown } | null;
  const content = sanitizeMessageContent(body?.content);
  if (!content) {
    return jsonError(400, "消息内容不能为空或过长");
  }

  const message = await addMessage(channelId, "user", content);
  return NextResponse.json({ message });
}
