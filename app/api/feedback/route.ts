import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { redis } from '@/lib/redis';
import { consumeRateLimit } from '@/lib/rate-limit';
import { getClientIpFromHeaders } from '@/lib/admin-auth';

interface FeedbackPayload {
  name: string;
  class?: string;
  email?: string;
  text: string;
  rating?: number;
  videoId?: string;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const FEEDBACK_DEDUPE_TTL_SECONDS = 300;

export async function POST(request: Request) {
  try {
    if (!process.env.UPSTASH_REDIS_REST_URL) {
      return NextResponse.json({ error: 'Chưa cấu hình Redis' }, { status: 500 });
    }

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

    const nameHash = sha256(trimmedName);
    const classHash = sha256(normalizedClass.toLowerCase());
    const emailHash = sha256(normalizedEmail);

    // Anti-duplication window: same identity in a short time bucket is considered spam.
    const bucket = Math.floor(Date.now() / 1000 / FEEDBACK_DEDUPE_TTL_SECONDS);
    const dedupeKey = `feedback:dedupe:${sha256(`${nameHash}:${emailHash}:${bucket}`)}`;
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
    const key = `feedback:${id}`;

    await redis.hset(key, {
      id,
      nameHash,
      classHash,
      emailHash,
      text: trimmedText,
      rating: rating !== undefined ? String(Number(rating)) : '',
      videoId: videoId?.trim() || '',
      createdAt,
      createdAtUnix: String(createdAtUnix),
    });

    return NextResponse.json({ success: true, uuid: id, id, createdAt }, { status: 201 });
  } catch (error) {
    console.error('Error saving feedback:', error);
    return NextResponse.json({ error: 'Không thể lưu góp ý' }, { status: 500 });
  }
}
