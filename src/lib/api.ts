import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { getChannelCookieName, verifyChannelAuthToken } from "./channel-auth";
import { hasRoomPassword } from "./channel-store";

export function jsonError(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

export async function getRequestIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = h.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export async function ensureUserRoomAccess(channelId: string): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const isProtected = await hasRoomPassword(channelId);
  if (!isProtected) return { ok: true };
  const cookieStore = await cookies();
  const token = cookieStore.get(getChannelCookieName(channelId))?.value;
  const valid = verifyChannelAuthToken(token, channelId);
  if (!valid) return { ok: false, reason: "需要房间密码登录" };
  return { ok: true };
}

export async function ensureRoomReadAccess(channelId: string): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const isProtected = await hasRoomPassword(channelId);
  if (!isProtected) return { ok: true };

  const cookieStore = await cookies();
  const token = cookieStore.get(getChannelCookieName(channelId))?.value;
  if (verifyChannelAuthToken(token, channelId)) {
    return { ok: true };
  }

  return { ok: false, reason: "需要房间密码登录" };
}
