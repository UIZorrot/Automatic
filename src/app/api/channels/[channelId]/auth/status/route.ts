import { NextResponse } from "next/server";
import { ensureUserRoomAccess, jsonError } from "@/lib/api";
import { hasRoomPassword, isValidChannelId } from "@/lib/channel-store";

export async function GET(
  _: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await context.params;
  if (!isValidChannelId(channelId)) return jsonError(400, "无效 channelId");

  const hasPassword = await hasRoomPassword(channelId);
  if (!hasPassword) {
    return NextResponse.json({
      ok: true,
      hasPassword: false,
      authorized: true,
    });
  }

  const access = await ensureUserRoomAccess(channelId);
  return NextResponse.json({
    ok: true,
    hasPassword: true,
    authorized: access.ok,
  });
}
