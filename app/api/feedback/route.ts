import { NextResponse } from 'next/server';
import { createHmac, randomUUID } from 'crypto';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
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
const FEEDBACK_MAX_LENGTH = 2000;

const feedbackSchema = z.object({
  name: z.string().trim().min(1).max(120),
  class: z.string().trim().max(80).optional().default(''),
  email: z
    .string()
    .trim()
    .max(320)
    .email()
    .optional()
    .or(z.literal(''))
    .default(''),
  text: z.string().trim().min(1).max(FEEDBACK_MAX_LENGTH),
  rating: z.number().int().min(1).max(5).optional(),
  videoId: z.string().trim().max(120).optional(),
});

const getFeedbackPepper = () =>
  (process.env.FEEDBACK_HASH_PEPPER ||
    process.env.ADMIN_AUTH_PEPPER ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    DEFAULT_DEV_PEPPER)
    .trim();

const hashSensitiveValue = (value: string) =>
  createHmac('sha256', getFeedbackPepper()).update(value).digest('hex');

const sanitizeFeedbackText = (value: string): string =>
  sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
    parser: { decodeEntities: true },
  }).trim();

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

    const rawPayload = (await request.json()) as FeedbackPayload;
    const payloadResult = feedbackSchema.safeParse({
      ...rawPayload,
      email: rawPayload.email?.trim().toLowerCase() || '',
      rating:
        rawPayload.rating === undefined || rawPayload.rating === null
          ? undefined
          : Number(rawPayload.rating),
    });

    if (!payloadResult.success) {
      return NextResponse.json(
        { error: 'Dữ liệu góp ý không hợp lệ. Vui lòng kiểm tra lại.' },
        { status: 400 }
      );
    }

    const { name, class: className, email, text, rating, videoId } = payloadResult.data;
    const trimmedName = name;
    const normalizedClass = className;
    const normalizedEmail = email;
    const sanitizedText = sanitizeFeedbackText(text);

    if (!sanitizedText) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ họ tên và nội dung góp ý.' },
        { status: 400 }
      );
    }

    const nameHash = hashSensitiveValue(trimmedName);
    const classHash = hashSensitiveValue(normalizedClass.toLowerCase());
    const emailHash = hashSensitiveValue(normalizedEmail);

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
