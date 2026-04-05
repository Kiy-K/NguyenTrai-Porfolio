import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

interface FeedbackEntry {
  id: string;
  name: string;
  message: string;
  createdAt: string;
}

const FEEDBACK_KEY = 'portfolio_feedback_v1';

export async function POST(request: Request) {
  try {
    if (!process.env.UPSTASH_REDIS_REST_URL) {
      return NextResponse.json({ error: 'Chưa cấu hình Redis' }, { status: 500 });
    }

    const { name, message } = await request.json();

    if (!name?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ họ tên và nội dung góp ý.' },
        { status: 400 }
      );
    }

    const entry: FeedbackEntry = {
      id: Date.now().toString(),
      name: name.trim(),
      message: message.trim(),
      createdAt: new Date().toISOString(),
    };

    const existing = (await redis.get<{ entries: FeedbackEntry[] }>(FEEDBACK_KEY)) || {
      entries: [],
    };

    const entries = Array.isArray(existing.entries) ? existing.entries : [];
    entries.unshift(entry);

    await redis.set(FEEDBACK_KEY, { entries });

    return NextResponse.json({ success: true, entryId: entry.id }, { status: 201 });
  } catch (error) {
    console.error('Error saving feedback:', error);
    return NextResponse.json({ error: 'Không thể lưu góp ý' }, { status: 500 });
  }
}
