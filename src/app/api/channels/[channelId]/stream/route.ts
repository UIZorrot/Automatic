import { NextRequest } from "next/server";
import { ensureUserRoomAccess, jsonError } from "@/lib/api";
import {
  isValidChannelId,
  subscribeAgentMessages,
} from "@/lib/channel-store";

export const runtime = "nodejs";

export async function GET(
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      send("ready", { ok: true });

      const unsubscribe = subscribeAgentMessages(channelId, (message) => {
        send("message", { message });
      });

      const heartbeat = setInterval(() => {
        send("ping", { t: Date.now() });
      }, 15_000);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ignore close race
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
