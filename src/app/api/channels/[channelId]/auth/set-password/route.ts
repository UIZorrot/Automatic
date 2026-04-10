import { NextRequest, NextResponse } from "next/server";
import { createChannelAuthToken, getChannelCookieName } from "@/lib/channel-auth";
import { ensureUserRoomAccess, jsonError } from "@/lib/api";
import {
  hasRoomPassword,
  isValidChannelId,
  setRoomPassword,
} from "@/lib/channel-store";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await context.params;
  if (!isValidChannelId(channelId)) return jsonError(400, "无效 channelId");

  const alreadyProtected = await hasRoomPassword(channelId);
  if (alreadyProtected) {
    const access = await ensureUserRoomAccess(channelId);
    if (!access.ok) return jsonError(401, "该房间已设置密码，需先登录");
  }

  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password.trim() : "";
  if (password.length < 4 || password.length > 64) {
    return jsonError(400, "密码长度需在 4-64 之间");
  }

  await setRoomPassword(channelId, password);

  const response = NextResponse.json({ ok: true, hasPassword: true });
  response.cookies.set({
    name: getChannelCookieName(channelId),
    value: createChannelAuthToken(channelId),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 24 * 60 * 60,
  });
  return response;
}
