import { NextResponse } from "next/server";
import { getChannelCookieName } from "@/lib/channel-auth";
import { jsonError } from "@/lib/api";
import { isValidChannelId } from "@/lib/channel-store";

export async function POST(
  _: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await context.params;
  if (!isValidChannelId(channelId)) return jsonError(400, "无效 channelId");

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: getChannelCookieName(channelId),
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
