import { NextResponse } from 'next/server';
import { createHmac, randomUUID } from 'crypto';
import { redis } from '@/lib/redis';
import { consumeRateLimit } from '@/lib/rate-limit';
import { getClientIpFromHeaders } from '@/lib/admin-auth';
import { FEEDBACK_KEY_PREFIX, ensureFeedbackSearchIndex } from '@/lib/feedback-search';

interface FeedbackPayload {
  name: string;
  class?: string;
  email?: string;
  text: string;
  rating?: number;
  videoId?: string;
}

const FEEDBACK_DEDUPE_TTL_SECONDS = 300;
const DEFAULT_DEV_PEPPER = 'dev-only-insecure-feedback-pepper-change-me';

const getFeedbackPepper = () =>
  (process.env.FEEDBACK_HASH_PEPPER ||
    process.env.ADMIN_AUTH_PEPPER ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    DEFAULT_DEV_PEPPER)
    .trim();

const hashSensitiveValue = (value: string) =>
  createHmac('sha256', getFeedbackPepper()).update(value).digest('hex');

const sanitizeFeedbackText = (value: string): string =>
  value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/(?:\+?\d[\d .-]{7,}\d)/g, '[redacted-phone]');

export async function POST(request: Request) {
  try {
    if (!process.env.UPSTASH_REDIS_REST_URL) {
      return NextResponse.json({ error: 'Chưa cấu hình Redis' }, { status: 500 });
    }

    await ensureFeedbackSearchIndex();

    const ip = getClientIpFromHeaders(request.headers);
    const ipRateLimit = await consumeRateLimit({
      key: `feedback:submit:${ip}`,
      limit: 20,
      windowSeconds: 10 * 60,
    });
    if (!ipRateLimit.allowed) {
      return NextResponse.json(
        { error: 'Bạn gửi góp ý quá nhanh. Vui lòng thử lại sau.' },
        { status: 429, headers: { 'Retry-After': String(ipRateLimit.retryAfterSeconds) } }
      );
    }

    const { name, class: className, email, text, rating, videoId } =
      (await request.json()) as FeedbackPayload;

    if (!name?.trim() || !text?.trim()) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ họ tên và nội dung góp ý.' },
        { status: 400 }
      );
    }

    if (rating !== undefined) {
      const normalizedRating = Number(rating);
      if (!Number.isFinite(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
        return NextResponse.json({ error: 'Điểm đánh giá không hợp lệ.' }, { status: 400 });
      }
    }

    const trimmedName = name.trim();
    const normalizedClass = (className || '').trim();
    const normalizedEmail = (email || '').trim().toLowerCase();
    const trimmedText = text.trim();

    if (trimmedName.length > 120) {
      return NextResponse.json({ error: 'Tên quá dài.' }, { status: 400 });
    }

    if (normalizedClass.length > 80) {
      return NextResponse.json({ error: 'Tên lớp quá dài.' }, { status: 400 });
    }

    if (normalizedEmail.length > 320) {
      return NextResponse.json({ error: 'Email quá dài.' }, { status: 400 });
    }

    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Email không hợp lệ.' }, { status: 400 });
    }

    if (trimmedText.length > 2000) {
      return NextResponse.json({ error: 'Nội dung góp ý quá dài.' }, { status: 400 });
    }

    const nameHash = hashSensitiveValue(trimmedName);
    const classHash = hashSensitiveValue(normalizedClass.toLowerCase());
    const emailHash = hashSensitiveValue(normalizedEmail);
    const sanitizedText = sanitizeFeedbackText(trimmedText);

    // Anti-duplication window: same identity in a short time bucket is considered spam.
    const bucket = Math.floor(Date.now() / 1000 / FEEDBACK_DEDUPE_TTL_SECONDS);
    const dedupeKey = `feedback:dedupe:${hashSensitiveValue(`${nameHash}:${emailHash}:${bucket}`)}`;
    const dedupeResult = await redis.set(dedupeKey, '1', {
      nx: true,
      ex: FEEDBACK_DEDUPE_TTL_SECONDS,
    });

    if (!dedupeResult) {
      return NextResponse.json(
        { error: 'Bạn vừa gửi góp ý gần đây. Vui lòng thử lại sau vài phút.' },
        { status: 429 }
      );
    }

    const id = randomUUID();
    const createdAtUnix = Date.now();
    const createdAt = new Date(createdAtUnix).toISOString();
    const key = `${FEEDBACK_KEY_PREFIX}${id}`;

    const payload: Record<string, string> = {
      id,
      nameHash,
      classHash,
      emailHash,
      text: sanitizedText,
      createdAt,
      createdAtUnix: String(createdAtUnix),
    };
    if (rating !== undefined) {
      payload.rating = String(Number(rating));
    }
    const normalizedVideoId = videoId?.trim();
    if (normalizedVideoId) {
      payload.videoId = normalizedVideoId;
    }

    await redis.hset(key, payload);

    return NextResponse.json({ success: true, uuid: id, id, createdAt }, { status: 201 });
  } catch (error) {
    console.error('Error saving feedback:', error);
    return NextResponse.json({ error: 'Không thể lưu góp ý' }, { status: 500 });
  }
}
