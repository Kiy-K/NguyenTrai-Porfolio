'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import StatusMessage from '@/components/admin/StatusMessage';

interface AdminFeedbackRecord {
  id: string;
  nameHash: string;
  classHash: string;
  emailHash: string;
  text: string;
  rating: number | null;
  videoId: string | null;
  createdAt: string;
}

export default function FeedbackPanel() {
  const [feedbackAdminPassword, setFeedbackAdminPassword] = useState('');
  const [feedbackLimit, setFeedbackLimit] = useState(50);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [feedbackRecords, setFeedbackRecords] = useState<AdminFeedbackRecord[]>([]);
  const [feedbackStatus, setFeedbackStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const handleReadFeedback = async () => {
    const normalizedPassword = feedbackAdminPassword.trim();
    if (!normalizedPassword) {
      setFeedbackStatus({ type: 'error', message: 'Vui lòng nhập mật khẩu admin để đọc feedback.' });
      return;
    }

    setIsFeedbackLoading(true);
    setFeedbackStatus({ type: null, message: '' });

    try {
      const res = await fetch('/api/admin/feedback/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: normalizedPassword, limit: feedbackLimit }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể tải feedback.');
      }

      const feedback = Array.isArray(data.feedback) ? (data.feedback as AdminFeedbackRecord[]) : [];
      setFeedbackRecords(feedback);
      setFeedbackStatus({
        type: 'success',
        message: `Đã tải ${feedback.length} feedback (dữ liệu hash).`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Không thể tải feedback.';
      setFeedbackStatus({ type: 'error', message });
      setFeedbackRecords([]);
    } finally {
      setIsFeedbackLoading(false);
    }
  };

  return (
        <section className="bg-white rounded-sm shadow-sm border border-[#D4C4A8] overflow-hidden p-6 mb-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-[#8B3A3A]" />
            <h2 className="text-xl font-bold text-[#2C1E16] font-playfair">Feedback Hashes (Admin)</h2>
          </div>

          <p className="text-sm text-[#5C4033] mb-4">
            Dữ liệu hiển thị chỉ gồm hash và nội dung feedback, không chứa PII thô.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="md:col-span-2">
              <label htmlFor="feedback-password" className="block text-sm font-bold text-[#2C1E16] mb-2 font-playfair">
                Mật khẩu admin
              </label>
              <input
                id="feedback-password"
                autoComplete="current-password"
                type="password"
                value={feedbackAdminPassword}
                onChange={(e) => setFeedbackAdminPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu admin để đọc feedback"
                className="w-full px-4 py-3 border-2 border-[#D4C4A8] rounded-lg focus:ring-2 focus:ring-[#B8860B] focus:border-[#B8860B] outline-none transition-all bg-[#F4EBD0] text-[#2C1E16] font-playfair"
              />
            </div>
            <div>
              <label htmlFor="feedback-limit" className="block text-sm font-bold text-[#2C1E16] mb-2 font-playfair">Giới hạn</label>
              <input
                id="feedback-limit"
                type="number"
                min={1}
                max={200}
                value={feedbackLimit}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (!Number.isFinite(next)) return;
                  setFeedbackLimit(Math.min(Math.max(next, 1), 200));
                }}
                className="w-full px-4 py-3 border-2 border-[#D4C4A8] rounded-lg focus:ring-2 focus:ring-[#B8860B] focus:border-[#B8860B] outline-none transition-all bg-[#F4EBD0] text-[#2C1E16] font-playfair"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={handleReadFeedback}
              disabled={isFeedbackLoading}
              className={`px-4 py-2 rounded-md text-white font-medium text-sm transition-colors ${
                isFeedbackLoading ? 'bg-[#8B3A3A]/70 cursor-not-allowed' : 'bg-[#8B3A3A] hover:bg-[#6D2D2D]'
              }`}
            >
              {isFeedbackLoading ? 'Đang tải...' : 'Tải feedback đã hash'}
            </button>
            <span className="text-sm text-[#5C4033]">Số bản ghi hiện có: {feedbackRecords.length}</span>
          </div>

          <StatusMessage status={feedbackStatus} />

          {feedbackRecords.length > 0 && (
            <div className="overflow-x-auto border border-[#D4C4A8] rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-[#F4EBD0] text-[#2C1E16]">
                  <tr>
                    <th className="text-left p-3 font-bold">UUID</th>
                    <th className="text-left p-3 font-bold">Name Hash</th>
                    <th className="text-left p-3 font-bold">Class Hash</th>
                    <th className="text-left p-3 font-bold">Email Hash</th>
                    <th className="text-left p-3 font-bold">Text</th>
                    <th className="text-left p-3 font-bold">Rating</th>
                    <th className="text-left p-3 font-bold">Video ID</th>
                    <th className="text-left p-3 font-bold">Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbackRecords.map((record) => (
                    <tr key={record.id} className="border-t border-[#D4C4A8] align-top">
                      <td className="p-3 font-mono text-xs text-[#2C1E16]">{record.id}</td>
                      <td className="p-3 font-mono text-xs text-[#5C4033]">{record.nameHash}</td>
                      <td className="p-3 font-mono text-xs text-[#5C4033]">{record.classHash || '-'}</td>
                      <td className="p-3 font-mono text-xs text-[#5C4033]">{record.emailHash}</td>
                      <td className="p-3 text-[#2C1E16] min-w-[280px]">{record.text}</td>
                      <td className="p-3 text-[#2C1E16]">{record.rating ?? '-'}</td>
                      <td className="p-3 font-mono text-xs text-[#5C4033]">{record.videoId || '-'}</td>
                      <td className="p-3 text-[#2C1E16] whitespace-nowrap">{record.createdAt || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

  );
}
