import { createHash, createHmac, pbkdf2 as pbkdf2Callback, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { promisify } from 'util';
import { redis } from '@/lib/redis';

export const ADMIN_SESSION_COOKIE = 'admin_session';
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 3;

const ADMIN_CREDENTIALS_KEY = 'admin:credentials:v1';
const PASSWORD_SCHEME = 'pbkdf2-v1';
const LEGACY_PASSWORD_SCHEME = 'sha256-v0';
const pbkdf2 = promisify(pbkdf2Callback);
const SECURITY_ENV_WARN_KEY = '__nguyentrai_security_env_warned__';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const isHex = (value: string) => /^[a-f0-9]+$/i.test(value);

const getSecret = (primary: string, fallback = ''): string => {
  const normalizedPrimary = primary.trim();
  if (normalizedPrimary) return normalizedPrimary;
  const normalizedFallback = fallback.trim();
  if (normalizedFallback) return normalizedFallback;
  return 'dev-only-insecure-secret-change-me';
};

function warnIfSecuritySecretsMissing() {
  if (process.env.NODE_ENV !== 'production') return;

  const globalWithFlag = globalThis as typeof globalThis & {
    [SECURITY_ENV_WARN_KEY]?: boolean;
  };
  if (globalWithFlag[SECURITY_ENV_WARN_KEY]) return;

  const missingSecrets: string[] = [];
  if (!process.env.ADMIN_AUTH_PEPPER?.trim()) missingSecrets.push('ADMIN_AUTH_PEPPER');
  if (!process.env.FEEDBACK_HASH_PEPPER?.trim()) missingSecrets.push('FEEDBACK_HASH_PEPPER');

  if (missingSecrets.length > 0) {
    console.warn(
      `[security] Missing production secret(s): ${missingSecrets.join(
        ', '
      )}. Set strong random values in environment variables.`
    );
  }

  globalWithFlag[SECURITY_ENV_WARN_KEY] = true;
}

warnIfSecuritySecretsMissing();

const getAdminPepper = (): string =>
  getSecret(process.env.ADMIN_AUTH_PEPPER || '', process.env.UPSTASH_REDIS_REST_TOKEN || '');

const hmacSha256 = (value: string, secret: string) =>
  createHmac('sha256', secret).update(value).digest('hex');

const derivePasswordHash = async (password: string, salt: string): Promise<string> => {
  const derivedKey = (await pbkdf2(password, salt, 210_000, 64, 'sha256')) as Buffer;
  return derivedKey.toString('hex');
};

const hashPasswordWithSalt = async (password: string) => {
  const salt = randomBytes(16).toString('hex');
  const passwordHash = await derivePasswordHash(password, salt);
  return { passwordHash, passwordSalt: salt, passwordScheme: PASSWORD_SCHEME };
};

const safeCompare = (submitted: string, stored: string): boolean => {
  if (!submitted || !stored || submitted.length !== stored.length) return false;
  const submittedBuffer = Buffer.from(submitted, 'utf8');
  const storedBuffer = Buffer.from(stored, 'utf8');
  return timingSafeEqual(submittedBuffer, storedBuffer);
};

export const getClientIpFromHeaders = (headers: Headers): string => {
  const forwardedFor = headers.get('x-forwarded-for');
  const realIp = headers.get('x-real-ip');
  const fromForwarded = forwardedFor?.split(',')[0]?.trim();
  return fromForwarded || realIp?.trim() || 'unknown';
};

export const hashIp = (ip: string): string => hmacSha256(ip, getAdminPepper());

export const getAdminCredentials = async () => {
  const existing = await redis.hgetall<Record<string, string>>(ADMIN_CREDENTIALS_KEY);
  if (!existing?.passwordHash) {
    return null;
  }

  return {
    passwordHash: existing.passwordHash,
    passwordSalt: existing.passwordSalt || '',
    passwordScheme: existing.passwordScheme || LEGACY_PASSWORD_SCHEME,
    createdAt: existing.createdAt || '',
  };
};

export const bootstrapAdminCredentials = async () => {
  const existing = await getAdminCredentials();
  if (existing) {
    return { created: false as const, password: null };
  }

  const password = randomBytes(18).toString('base64url');
  const securedCredentials = await hashPasswordWithSalt(password);

  await redis.hset(ADMIN_CREDENTIALS_KEY, {
    passwordHash: securedCredentials.passwordHash,
    passwordSalt: securedCredentials.passwordSalt,
    passwordScheme: securedCredentials.passwordScheme,
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
  if (!/^[a-f0-9-]{36}$/i.test(sessionId)) return null;

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

export const hashPassword = (password: string): string => sha256(password);

export const verifyAdminPassword = async (password: string): Promise<boolean> => {
  const normalized = password.trim();
  if (!normalized) return false;

  const creds = await getAdminCredentials();
  if (!creds?.passwordHash) return false;

  if (creds.passwordScheme === PASSWORD_SCHEME && creds.passwordSalt && isHex(creds.passwordHash)) {
    const submittedHash = await derivePasswordHash(normalized, creds.passwordSalt);
    return safeCompare(submittedHash, creds.passwordHash);
  }

  const submittedLegacyHash = hashPassword(normalized);
  const isLegacyMatch = safeCompare(submittedLegacyHash, creds.passwordHash);
  if (!isLegacyMatch) {
    return false;
  }

  // Silent credential upgrade path from legacy SHA-256 to salted PBKDF2.
  const upgradedCredentials = await hashPasswordWithSalt(normalized);
  await redis.hset(ADMIN_CREDENTIALS_KEY, {
    passwordHash: upgradedCredentials.passwordHash,
    passwordSalt: upgradedCredentials.passwordSalt,
    passwordScheme: upgradedCredentials.passwordScheme,
    createdAt: creds.createdAt || new Date().toISOString(),
  });

  return true;
};
