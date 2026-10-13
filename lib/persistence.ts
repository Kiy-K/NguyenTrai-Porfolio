import { neon } from '@neondatabase/serverless';
import { redis } from '@/lib/redis';
import type { Product } from '@/data/products';

const CONTENT_KEY = 'portfolio_data_v4';
const CREDENTIALS_KEY = 'admin:credentials:v1';
type Content = { products: Product[] };
type HashRecord = Record<string, string>;

export function usesPostgres(): boolean {
  const backend = process.env.PERSISTENCE_BACKEND;
  if (backend && backend !== 'redis' && backend !== 'postgres') throw new Error('Invalid persistence backend');
  return backend === 'postgres';
}

function database() {
  // APP_DATABASE_URL holds the least-privilege runtime role; DATABASE_URL is the integration-managed owner.
  const url = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('APP_DATABASE_URL or DATABASE_URL is required for PostgreSQL persistence');
  try {
    if (!['postgres:', 'postgresql:'].includes(new URL(url).protocol)) throw new Error();
  } catch {
    throw new Error('APP_DATABASE_URL/DATABASE_URL must be a valid PostgreSQL connection URL');
  }
  return neon(url);
}

export async function readContent(): Promise<Content | null> {
  if (!usesPostgres()) return redis.get<Content>(CONTENT_KEY);
  const sql = database();
  const [row] = await sql`SELECT payload FROM portfolio.state WHERE key = ${CONTENT_KEY}`;
  if (!row?.payload || !Array.isArray(row.payload.products)) throw new Error('Imported content is missing or invalid');
  return row.payload as Content;
}

export async function writeContent(content: Content): Promise<void> {
  if (!usesPostgres()) { await redis.set(CONTENT_KEY, content); return; }
  const sql = database();
  const rows = await sql`UPDATE portfolio.state SET payload = ${JSON.stringify(content)}::jsonb WHERE key = ${CONTENT_KEY} RETURNING key`;
  if (!rows.length) throw new Error('Imported content is missing');
}

export async function appendProduct(product: Product): Promise<void> {
  if (!usesPostgres()) {
    const content = await readContent() || { products: [] };
    content.products ||= [];
    content.products.push(product);
    await writeContent(content);
    return;
  }
  const sql = database();
  const rows = await sql`UPDATE portfolio.state
    SET payload = jsonb_set(payload, '{products}', COALESCE(payload->'products', '[]'::jsonb) || ${JSON.stringify([product])}::jsonb)
    WHERE key = ${CONTENT_KEY} RETURNING key`;
  if (!rows.length) throw new Error('Imported content is missing');
}

export async function readCredentials(): Promise<HashRecord | null> {
  if (!usesPostgres()) return redis.hgetall<HashRecord>(CREDENTIALS_KEY);
  const sql = database();
  const [row] = await sql`SELECT payload FROM portfolio.state WHERE key = ${CREDENTIALS_KEY}`;
  return row?.payload as HashRecord || null;
}

export async function createCredentials(fields: HashRecord): Promise<boolean> {
  if (!usesPostgres()) {
    const created = await redis.eval(`
      if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
      redis.call('HSET', KEYS[1], unpack(ARGV))
      return 1
    `, [CREDENTIALS_KEY], Object.entries(fields).flat());
    return created === 1;
  }
  const sql = database();
  const rows = await sql`INSERT INTO portfolio.state (key, payload) VALUES (${CREDENTIALS_KEY}, ${JSON.stringify(fields)}::jsonb)
    ON CONFLICT (key) DO NOTHING RETURNING key`;
  return rows.length === 1;
}

export async function updateCredentials(fields: HashRecord): Promise<void> {
  if (!usesPostgres()) { await redis.hset(CREDENTIALS_KEY, fields); return; }
  const sql = database();
  const rows = await sql`UPDATE portfolio.state SET payload = payload || ${JSON.stringify(fields)}::jsonb
    WHERE key = ${CREDENTIALS_KEY} RETURNING key`;
  if (!rows.length) throw new Error('Imported credentials are missing');
}

export async function writeFeedback(sourceKey: string, payload: HashRecord): Promise<void> {
  if (!usesPostgres()) { await redis.hset(sourceKey, payload); return; }
  const timestamp = Number(payload.createdAtUnix || 0);
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) throw new Error('Invalid feedback timestamp');
  const sql = database();
  await sql`INSERT INTO portfolio.feedback (source_key, payload, created_at_unix)
    VALUES (${sourceKey}, ${JSON.stringify(payload)}::jsonb, ${timestamp})`;
}

export async function readPostgresFeedback(limit: number): Promise<HashRecord[]> {
  const sql = database();
  const safeLimit = Math.min(Math.max(Math.floor(limit) || 50, 1), 200);
  const rows = await sql`SELECT payload FROM (
    SELECT payload, created_at_unix, source_key FROM (
      SELECT DISTINCT ON (payload->>'id') payload, created_at_unix, source_key
      FROM portfolio.feedback WHERE COALESCE(payload->>'id', '') <> ''
      ORDER BY payload->>'id', (source_key LIKE 'feedback:record:%') DESC, created_at_unix DESC, source_key
    ) unique_records
    ORDER BY (source_key LIKE 'feedback:record:%') DESC, created_at_unix DESC, source_key LIMIT ${safeLimit}
  ) selected_records ORDER BY created_at_unix DESC, source_key`;

  return rows.map(row => row.payload as HashRecord);
}
