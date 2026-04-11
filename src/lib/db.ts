import { Pool } from "pg";

type DbState = {
  pool: Pool;
  initialized: boolean;
};

const globalDb = globalThis as typeof globalThis & {
  __webChannelDb?: DbState;
};

function getSchema(): string {
  return process.env.DATABASE_SCHEMA ?? "public";
}

function getConnectionString(): string {
  const host = process.env.DATABASE_HOST;
  const user = process.env.DATABASE_USER;
  const port = process.env.DATABASE_PORT ?? "5432";
  const database = process.env.DATABASE_NAME;
  const password = process.env.DATABASE_PASSWORD;

  if (host && user && database && password) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  }

  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  throw new Error("数据库配置缺失，请设置 DATABASE_URL 或 DATABASE_* 环境变量。");
}

function getDbState(): DbState {
  if (globalDb.__webChannelDb) return globalDb.__webChannelDb;
  const sslEnabled = (process.env.DATABASE_SSL ?? "true").toLowerCase() !== "false";
  const pool = new Pool({
    connectionString: getConnectionString(),
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
  });
  const state: DbState = { pool, initialized: false };
  globalDb.__webChannelDb = state;
  return state;
}

export async function ensureDbReady(): Promise<Pool> {
  const state = getDbState();
  if (state.initialized) return state.pool;

  const schema = getSchema();
  await state.pool.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await state.pool.query(`
    CREATE TABLE IF NOT EXISTS "${schema}".channel_messages (
      id BIGSERIAL PRIMARY KEY,
      channel_id VARCHAR(64) NOT NULL,
      sender VARCHAR(16) NOT NULL,
      content TEXT NOT NULL,
      "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await state.pool.query(`
    CREATE INDEX IF NOT EXISTS idx_channel_messages_channel_id_id
    ON "${schema}".channel_messages(channel_id, id)
  `);
  await state.pool.query(`
    CREATE INDEX IF NOT EXISTS idx_channel_messages_channel_sender_id
    ON "${schema}".channel_messages(channel_id, sender, id)
  `);
  await state.pool.query(`
    CREATE TABLE IF NOT EXISTS "${schema}".channel_rooms (
      channel_id VARCHAR(64) PRIMARY KEY,
      password_salt TEXT NULL,
      password_hash TEXT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  state.initialized = true;
  return state.pool;
}

export function getSchemaName(): string {
  return getSchema();
}
