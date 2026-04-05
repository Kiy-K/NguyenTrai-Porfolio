import { NextResponse } from 'next/server';
import {
  getActiveAdminSession,
  getClientIpFromHeaders,
  verifyAdminPassword,
} from '@/lib/admin-auth';
import { redis } from '@/lib/redis';
import { consumeRateLimit } from '@/lib/rate-limit';
import { enforceSameOrigin } from '@/lib/request-security';
import { FEEDBACK_KEY_PREFIX, searchFeedbackByNewest } from '@/lib/feedback-search';

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

const DEDUPE_KEY_PREFIX = 'feedback:dedupe:';

function toFeedbackRecord(row: Record<string, string>): FeedbackHashRecord | null {
  if (!row.id) return null;
  const ratingValue = row.rating ? Number(row.rating) : NaN;

  return {
    id: row.id,
    nameHash: row.nameHash || '',
    classHash: row.classHash || '',
    emailHash: row.emailHash || '',
    text: row.text || '',
    rating: Number.isFinite(ratingValue) ? ratingValue : null,
    videoId: row.videoId || null,
    createdAt: row.createdAt || '',
    createdAtUnix: Number(row.createdAtUnix || 0),
  };
}

async function readFeedbackHashesByKeys(keys: string[], limit: number): Promise<FeedbackHashRecord[]> {
  if (keys.length === 0) return [];

  const rows = await Promise.all(
    keys.map(async (key) => {
      const record = await redis.hgetall<Record<string, string>>(key);
      return record || null;
    })
  );

  return rows
    .filter((row): row is Record<string, string> => Boolean(row?.id))
    .map((row) => toFeedbackRecord(row))
    .filter((row): row is FeedbackHashRecord => Boolean(row))
    .sort((a, b) => b.createdAtUnix - a.createdAtUnix)
    .slice(0, limit);
}

async function readLegacyFeedback(limit: number): Promise<FeedbackHashRecord[]> {
  const keys = ((await redis.keys('feedback:*')) as string[]) || [];
  const feedbackKeys = keys.filter(
    (key) =>
      key.startsWith('feedback:') &&
      !key.startsWith(DEDUPE_KEY_PREFIX) &&
      key.startsWith(FEEDBACK_KEY_PREFIX) === false &&
      key.split(':').length === 2
  );

  return readFeedbackHashesByKeys(feedbackKeys, limit);
}

async function readFeedbackBySearchPrefix(limit: number): Promise<FeedbackHashRecord[]> {
  const keys = ((await redis.keys(`${FEEDBACK_KEY_PREFIX}*`)) as string[]) || [];
  return readFeedbackHashesByKeys(keys, limit);
}

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
    let feedback: FeedbackHashRecord[] = [];
    try {
      const indexedRows = await searchFeedbackByNewest(safeLimit);
      feedback = indexedRows
        .map((row) => toFeedbackRecord(row))
        .filter((row): row is FeedbackHashRecord => Boolean(row))
        .slice(0, safeLimit);
    } catch (searchError) {
      console.error('Error querying RediSearch feedback index. Falling back to legacy scan.', searchError);
      const [indexedPrefixFallback, legacyFallback] = await Promise.all([
        readFeedbackBySearchPrefix(safeLimit),
        readLegacyFeedback(safeLimit),
      ]);
      feedback = [...indexedPrefixFallback, ...legacyFallback]
        .sort((a, b) => b.createdAtUnix - a.createdAtUnix)
        .slice(0, safeLimit);
    }

    // Include legacy feedback keys if indexed results are fewer than requested limit.
    if (feedback.length < safeLimit) {
      const legacyRows = await readLegacyFeedback(safeLimit);
      const seen = new Set(feedback.map((item) => item.id));
      for (const item of legacyRows) {
        if (seen.has(item.id)) continue;
        feedback.push(item);
        seen.add(item.id);
        if (feedback.length >= safeLimit) break;
      }
    }

    feedback.sort((a, b) => b.createdAtUnix - a.createdAtUnix);

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
