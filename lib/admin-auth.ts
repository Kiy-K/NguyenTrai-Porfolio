import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { redis } from '@/lib/redis';
import bcrypt from 'bcrypt';

export const ADMIN_SESSION_COOKIE = 'admin_session';
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 3;

const ADMIN_CREDENTIALS_KEY = 'admin:credentials:v1';
const BCRYPT_ROUNDS = 12;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export const getClientIpFromHeaders = (headers: Headers): string => {
  const forwardedFor = headers.get('x-forwarded-for');
  const realIp = headers.get('x-real-ip');
  const fromForwarded = forwardedFor?.split(',')[0]?.trim();
  return fromForwarded || realIp?.trim() || 'unknown';
};

export const hashIp = (ip: string): string => sha256(ip);

export const getAdminCredentials = async () => {
  const existing = await redis.hgetall<Record<string, string>>(ADMIN_CREDENTIALS_KEY);
  if (!existing?.passwordHash) {
    return null;
  }

  return {
    passwordHash: existing.passwordHash,
    createdAt: existing.createdAt || '',
  };
};

export const bootstrapAdminCredentials = async () => {
  const existing = await getAdminCredentials();
  if (existing) {
    return { created: false as const, password: null };
  }

  const password = randomBytes(18).toString('base64url');
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await redis.hset(ADMIN_CREDENTIALS_KEY, {
    passwordHash,
    createdAt: new Date().toISOString(),
  });

  return { created: true as const, password };
};

export const createAdminSession = async (ip: string) => {
  const sessionId = randomUUID();
  const createdAtUnix = Date.now();
  const expiresAtUnix = createdAtUnix + ADMIN_SESSION_TTL_SECONDS * 1000;
  const ipHash = hashIp(ip);

  const sessionKey = `admin:session:${sessionId}`;
  const ipKey = `admin:ip:${ipHash}:${sessionId}`;

  await redis.hset(sessionKey, {
    sessionId,
    ipHash,
    createdAtUnix: String(createdAtUnix),
    expiresAtUnix: String(expiresAtUnix),
  });

  await redis.expire(sessionKey, ADMIN_SESSION_TTL_SECONDS);
  await redis.set(ipKey, String(createdAtUnix), { ex: ADMIN_SESSION_TTL_SECONDS });

  return {
    sessionId,
    ipHash,
    createdAt: new Date(createdAtUnix).toISOString(),
    expiresAt: new Date(expiresAtUnix).toISOString(),
  };
};

export const getActiveAdminSession = async (ip: string) => {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!sessionId) return null;

  const session = await redis.hgetall<Record<string, string>>(`admin:session:${sessionId}`);
  if (!session?.sessionId || !session?.ipHash) {
    return null;
  }

  const expectedIpHash = hashIp(ip);
  if (session.ipHash !== expectedIpHash) {
    return null;
  }

  const expiresAtUnix = Number(session.expiresAtUnix || 0);
  if (!Number.isFinite(expiresAtUnix) || Date.now() > expiresAtUnix) {
    await redis.del(`admin:session:${sessionId}`);
    return null;
  }

  return {
    sessionId,
    expiresAtUnix,
    ipHash: session.ipHash,
  };
};

export const hashPassword = async (password: string): Promise<string> => {
  const normalized = password.trim();
  if (!normalized) {
    throw new Error('Cannot hash empty password');
  }
  return bcrypt.hash(normalized, BCRYPT_ROUNDS);
};

export const verifyAdminPassword = async (password: string): Promise<boolean> => {
  const normalized = password.trim();
  if (!normalized) return false;

  const creds = await getAdminCredentials();
  if (!creds?.passwordHash) return false;

  try {
    return await bcrypt.compare(normalized, creds.passwordHash);
  } catch {
    return false;
  }
};
