import { redis } from '@/lib/redis';

interface ConsumeRateLimitInput {
  key: string;
  limit: number;
  windowSeconds: number;
}

interface ConsumeRateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

export async function consumeRateLimit({
  key,
  limit,
  windowSeconds,
}: ConsumeRateLimitInput): Promise<ConsumeRateLimitResult> {
  const safeLimit = Math.max(1, Math.floor(limit));
  const safeWindowSeconds = Math.max(1, Math.floor(windowSeconds));
  const now = Date.now();
  const windowMs = safeWindowSeconds * 1000;
  const bucket = Math.floor(now / windowMs);
  const redisKey = `ratelimit:${key}:${bucket}`;

  const currentCount = await redis.incr(redisKey);
  if (currentCount === 1) {
    await redis.expire(redisKey, safeWindowSeconds + 2);
  }

  const remaining = Math.max(0, safeLimit - currentCount);
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((bucket * windowMs + windowMs - now) / 1000)
  );

  return {
    allowed: currentCount <= safeLimit,
    limit: safeLimit,
    remaining,
    retryAfterSeconds,
  };
}
