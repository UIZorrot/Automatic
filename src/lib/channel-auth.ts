import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const COOKIE_PREFIX = "wc_auth_";

type TokenPayload = {
  channelId: string;
  exp: number;
};

function secret(): string {
  return process.env.CHANNEL_AUTH_SECRET ?? "dev-only-secret-change-me";
}

function b64url(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64url");
}

function decodeB64url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf-8");
}

function sign(payloadB64: string): string {
  return createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

export function getChannelCookieName(channelId: string): string {
  return `${COOKIE_PREFIX}${channelId.slice(0, 12)}`;
}

export function createChannelAuthToken(channelId: string): string {
  const payload: TokenPayload = {
    channelId,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifyChannelAuthToken(
  token: string | undefined,
  channelId: string,
): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const expected = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!timingSafeEqual(a, b)) return false;

  try {
    const payload = JSON.parse(decodeB64url(payloadB64)) as TokenPayload;
    if (payload.channelId !== channelId) return false;
    if (!payload.exp || payload.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}
