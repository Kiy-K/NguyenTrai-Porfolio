import { NextResponse } from 'next/server';
import {
  getActiveAdminSession,
  getClientIpFromHeaders,
  verifyAdminPassword,
} from '@/lib/admin-auth';
import { redis } from '@/lib/redis';
import { consumeRateLimit } from '@/lib/rate-limit';
import { enforceSameOrigin } from '@/lib/request-security';

interface ReadFeedbackPayload {
  password: string;
  limit?: number;
}

interface FeedbackHashRecord {
  id: string;
  nameHash: string;
  classHash: string;
  emailHash: string;
  text: string;
  rating: number | null;
  videoId: string | null;
  createdAt: string;
  createdAtUnix: number;
}

const FEEDBACK_KEY_PREFIX = 'feedback:';
const DEDUPE_KEY_PREFIX = 'feedback:dedupe:';

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    if (!process.env.UPSTASH_REDIS_REST_URL) {
      return NextResponse.json({ error: 'Chưa cấu hình Redis' }, { status: 500 });
    }

    const ip = getClientIpFromHeaders(request.headers);
    const session = await getActiveAdminSession(ip);
    if (!session) {
      return NextResponse.json({ error: 'Phiên admin không hợp lệ hoặc đã hết hạn.' }, { status: 401 });
    }

    const rateLimit = await consumeRateLimit({
      key: `admin:feedback:read:${ip}`,
      limit: 60,
      windowSeconds: 10 * 60,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Bạn truy vấn quá nhanh. Vui lòng thử lại sau.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    const { password, limit } = (await request.json()) as ReadFeedbackPayload;
    const isValidPassword = await verifyAdminPassword(password || '');
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Mật khẩu admin không đúng.' }, { status: 403 });
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const keys = ((await redis.keys(`${FEEDBACK_KEY_PREFIX}*`)) as string[]) || [];
    const feedbackKeys = keys.filter(
      (key) =>
        key.startsWith(FEEDBACK_KEY_PREFIX) &&
        !key.startsWith(DEDUPE_KEY_PREFIX) &&
        key.split(':').length === 2
    );

    const rows = await Promise.all(
      feedbackKeys.map(async (key) => {
        const record = await redis.hgetall<Record<string, string>>(key);
        return record || null;
      })
    );

    const feedback: FeedbackHashRecord[] = rows
      .filter((row): row is Record<string, string> => Boolean(row?.id))
      .map((row) => ({
        id: row.id,
        nameHash: row.nameHash || '',
        classHash: row.classHash || '',
        emailHash: row.emailHash || '',
        text: row.text || '',
        rating: row.rating ? Number(row.rating) : null,
        videoId: row.videoId || null,
        createdAt: row.createdAt || '',
        createdAtUnix: Number(row.createdAtUnix || 0),
      }))
      .sort((a, b) => b.createdAtUnix - a.createdAtUnix)
      .slice(0, safeLimit);

    return NextResponse.json(
      {
        success: true,
        count: feedback.length,
        feedback,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error reading feedback hashes:', error);
    return NextResponse.json({ error: 'Không thể đọc dữ liệu feedback' }, { status: 500 });
  }
}
