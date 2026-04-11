import { NextRequest, NextResponse } from "next/server";
import { ensureRoomReadAccess, jsonError } from "@/lib/api";
import { getMessages, isValidChannelId } from "@/lib/channel-store";
import type { Sender } from "@/lib/types";

function parseSender(input: string | null): Sender | "all" {
  if (input === "user" || input === "agent" || input === "all") return input;
  return "user";
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await context.params;
  if (!isValidChannelId(channelId)) {
    return jsonError(400, "无效 channelId");
  }

  const url = new URL(request.url);
  const sinceId = Number.parseInt(url.searchParams.get("since_id") ?? "0", 10);
  const role = parseSender(url.searchParams.get("role"));

  if (role === "all" || role === "agent") {
    const access = await ensureRoomReadAccess(channelId);
    if (!access.ok) return jsonError(401, access.reason ?? "未授权");
  }

  const messages = await getMessages(
    channelId,
    Number.isNaN(sinceId) ? 0 : sinceId,
    role,
  );
  return NextResponse.json({ messages });
}
