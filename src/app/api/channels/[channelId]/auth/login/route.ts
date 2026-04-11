import { NextRequest, NextResponse } from "next/server";
import { createChannelAuthToken, getChannelCookieName } from "@/lib/channel-auth";
import { jsonError } from "@/lib/api";
import {
  hasRoomPassword,
  isValidChannelId,
  verifyRoomPassword,
} from "@/lib/channel-store";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await context.params;
  if (!isValidChannelId(channelId)) return jsonError(400, "无效 channelId");

  const requiresPassword = await hasRoomPassword(channelId);
  if (!requiresPassword) {
    return NextResponse.json({ ok: true, hasPassword: false, authorized: true });
  }

  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password) return jsonError(400, "密码不能为空");

  const ok = await verifyRoomPassword(channelId, password);
  if (!ok) return jsonError(401, "密码错误");

  const response = NextResponse.json({ ok: true, hasPassword: true, authorized: true });
  response.cookies.set({
    name: getChannelCookieName(channelId),
    value: createChannelAuthToken(channelId),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}
