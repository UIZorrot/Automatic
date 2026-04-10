import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { ensureDbReady, getSchemaName } from "./db";
import type { ChannelMessage, Sender } from "./types";

type Listener = (message: ChannelMessage) => void;

type StoreState = {
  listeners: Map<string, Map<number, Listener>>;
  listenerSeq: number;
  rateLimits: Map<string, number[]>;
};

type MessageRow = {
  id: string;
  channel_id: string;
  sender: Sender;
  content: string;
  timestamp: string;
};

const CHANNEL_ID_RE = /^[a-z0-9]{32}$/;
const MAX_MESSAGE_LENGTH = 2000;

function createStoreState(): StoreState {
  return {
    listeners: new Map<string, Map<number, Listener>>(),
    listenerSeq: 1,
    rateLimits: new Map<string, number[]>(),
  };
}

const globalStore = globalThis as typeof globalThis & {
  __channelStoreState?: StoreState;
};

const store = globalStore.__channelStoreState ?? createStoreState();
globalStore.__channelStoreState = store;

export function isValidChannelId(channelId: string): boolean {
  return CHANNEL_ID_RE.test(channelId);
}

export function sanitizeMessageContent(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const content = raw.trim();
  if (!content) return null;
  if (content.length > MAX_MESSAGE_LENGTH) return null;
  return content;
}

export async function addMessage(
  channelId: string,
  sender: Sender,
  content: string,
): Promise<ChannelMessage> {
  const pool = await ensureDbReady();
  const schema = getSchemaName();
  const result = await pool.query<MessageRow>(
    `
      INSERT INTO "${schema}".channel_messages(channel_id, sender, content)
      VALUES ($1, $2, $3)
      RETURNING id, channel_id, sender, content, "timestamp"
    `,
    [channelId, sender, content],
  );
  const row = result.rows[0];
  const message: ChannelMessage = {
    id: Number(row.id),
    channelId: row.channel_id,
    sender: row.sender,
    content: row.content,
    timestamp: row.timestamp,
  };

  if (sender === "agent") {
    const scoped = store.listeners.get(channelId);
    if (scoped) {
      for (const listener of scoped.values()) {
        listener(message);
      }
    }
  }
  return message;
}

export async function getMessages(
  channelId: string,
  sinceId: number,
  sender: Sender | "all" = "all",
): Promise<ChannelMessage[]> {
  const pool = await ensureDbReady();
  const schema = getSchemaName();
  const params: Array<number | string> = [channelId, sinceId];
  let sql = `
    SELECT id, channel_id, sender, content, "timestamp"
    FROM "${schema}".channel_messages
    WHERE channel_id = $1 AND id > $2
  `;

  if (sender !== "all") {
    params.push(sender);
    sql += ` AND sender = $3`;
  }
  sql += ` ORDER BY id ASC`;

  const result = await pool.query<MessageRow>(sql, params);

  return result.rows.map((row: MessageRow) => ({
    id: Number(row.id),
    channelId: row.channel_id,
    sender: row.sender,
    content: row.content,
    timestamp: row.timestamp,
  }));
}

export function subscribeAgentMessages(
  channelId: string,
  listener: Listener,
): () => void {
  const scoped = store.listeners.get(channelId) ?? new Map<number, Listener>();
  if (!store.listeners.has(channelId)) {
    store.listeners.set(channelId, scoped);
  }
  const id = store.listenerSeq++;
  scoped.set(id, listener);

  return () => {
    const current = store.listeners.get(channelId);
    if (!current) return;
    current.delete(id);
    if (current.size === 0) {
      store.listeners.delete(channelId);
    }
  };
}

export async function hasRoomPassword(channelId: string): Promise<boolean> {
  const pool = await ensureDbReady();
  const schema = getSchemaName();
  const result = await pool.query<{
    password_salt: string | null;
    password_hash: string | null;
  }>(
    `
      SELECT password_salt, password_hash
      FROM "${schema}".channel_rooms
      WHERE channel_id = $1
      LIMIT 1
    `,
    [channelId],
  );
  const row = result.rows[0];
  if (!row) return false;
  return Boolean(row.password_salt && row.password_hash);
}

export async function setRoomPassword(
  channelId: string,
  plainPassword: string,
): Promise<void> {
  const pool = await ensureDbReady();
  const schema = getSchemaName();
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plainPassword, salt, 64).toString("hex");
  await pool.query(
    `
      INSERT INTO "${schema}".channel_rooms(channel_id, password_salt, password_hash, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (channel_id) DO UPDATE
      SET password_salt = EXCLUDED.password_salt,
          password_hash = EXCLUDED.password_hash,
          updated_at = NOW()
    `,
    [channelId, salt, hash],
  );
}

export async function verifyRoomPassword(
  channelId: string,
  plainPassword: string,
): Promise<boolean> {
  const pool = await ensureDbReady();
  const schema = getSchemaName();
  const result = await pool.query<{
    password_salt: string | null;
    password_hash: string | null;
  }>(
    `
      SELECT password_salt, password_hash
      FROM "${schema}".channel_rooms
      WHERE channel_id = $1
      LIMIT 1
    `,
    [channelId],
  );
  const row = result.rows[0];
  if (!row?.password_salt || !row.password_hash) return false;
  const actual = Buffer.from(row.password_hash, "hex");
  const check = scryptSync(plainPassword, row.password_salt, 64);
  if (actual.length !== check.length) return false;
  return timingSafeEqual(actual, check);
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const start = now - windowMs;
  const values = store.rateLimits.get(key) ?? [];
  const filtered = values.filter((v) => v > start);
  if (filtered.length >= limit) {
    const oldest = filtered[0];
    return { ok: false, retryAfterMs: oldest + windowMs - now };
  }
  filtered.push(now);
  store.rateLimits.set(key, filtered);
  return { ok: true, retryAfterMs: 0 };
}
