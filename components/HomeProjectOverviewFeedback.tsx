'use client';

import { FormEvent, useState } from 'react';

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

interface HomeProjectOverviewFeedbackProps {
  mode?: 'overview' | 'feedback' | 'both';
}

export default function HomeProjectOverviewFeedback({ mode = 'both' }: HomeProjectOverviewFeedbackProps) {
  const showOverview = mode === 'overview' || mode === 'both';
  const showFeedback = mode === 'feedback' || mode === 'both';
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!name.trim() || !message.trim()) {
      setSubmitState('error');
      setStatusMessage('Vui lòng nhập đầy đủ họ tên và nội dung góp ý.');
      return;
    }

    setSubmitState('loading');
    setStatusMessage('Đang gửi góp ý...');

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), message: message.trim() }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Không thể gửi góp ý lúc này.');
      }

      setSubmitState('success');
      setStatusMessage('Cảm ơn bạn! Góp ý đã được lưu thành công.');
      setName('');
      setMessage('');
    } catch (error: any) {
      setSubmitState('error');
      setStatusMessage(error.message || 'Có lỗi xảy ra khi gửi góp ý.');
    }
  };

  return (
    <section className="w-full max-w-5xl mx-auto mb-16 font-playfair" id="tong-quan-va-gop-y">
      <div className="bg-white rounded-3xl shadow-md p-8 border border-[#D4C4A8]">
        <h2 className="text-xl font-bold text-[#8B3A3A] mb-6 uppercase tracking-widest text-center font-playfair">
          {showOverview && showFeedback ? '2. Tổng Quan & Góp Ý' : showOverview ? '2. Tổng Quan Dự Án' : '3. Hộp Thư Góp Ý'}
        </h2>

        <div className={`grid gap-8 ${showOverview && showFeedback ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {showOverview && (
            <article className="rounded-2xl border border-[#D4C4A8] bg-[#FFFDF8] p-6">
            <h3 className="text-2xl font-bold text-[#2C1E16] mb-4 font-playfair">Tổng quan dự án</h3>
            <div className="w-16 h-[2px] bg-[#B8860B] mb-5" />
            <p className="text-[#5C4033] leading-relaxed text-lg mb-4 font-playfair">
              Dự án được xây dựng nhằm tôn vinh giá trị văn hóa, lịch sử và tư tưởng nhân nghĩa của Nguyễn Trãi
              thông qua trải nghiệm số hiện đại nhưng vẫn giữ tinh thần cổ điển.
            </p>
            <p className="text-[#5C4033] leading-relaxed text-lg font-playfair">
              Hệ thống cho phép phân loại nội dung theo chuyên mục, trình bày tác phẩm đa phương tiện và tích hợp AI
              để hỗ trợ tóm tắt, gợi ý tiêu đề, giúp người học và người xem tiếp cận nội dung nhanh và sâu hơn.
            </p>
            </article>
          )}

          {showFeedback && (
          <article className="rounded-2xl border border-[#D4C4A8] bg-[#FFFDF8] p-6">
            <h3 className="text-2xl font-bold text-[#2C1E16] mb-4 font-playfair">Hộp thư góp ý</h3>
            <div className="w-16 h-[2px] bg-[#B8860B] mb-5" />

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="feedback-name" className="block text-[#2C1E16] font-semibold mb-2 font-playfair">
                  Họ và tên
                </label>
                <input
                  id="feedback-name"
                  name="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nhập họ và tên của bạn"
                  className="w-full px-4 py-3 border border-[#D4C4A8] rounded-lg bg-white text-[#2C1E16] placeholder-[#8B3A3A]/50 focus:outline-none focus:ring-2 focus:ring-[#B8860B] focus:border-[#B8860B] transition-all font-playfair"
                  required
                />
              </div>

              <div>
                <label htmlFor="feedback-message" className="block text-[#2C1E16] font-semibold mb-2 font-playfair">
                  Nội dung góp ý
                </label>
                <textarea
                  id="feedback-message"
                  name="message"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Nhập góp ý hoặc đề xuất của bạn"
                  className="w-full px-4 py-3 border border-[#D4C4A8] rounded-lg bg-white text-[#2C1E16] placeholder-[#8B3A3A]/50 focus:outline-none focus:ring-2 focus:ring-[#B8860B] focus:border-[#B8860B] transition-all font-playfair resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitState === 'loading'}
                className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#8B3A3A] text-white font-bold tracking-wider uppercase text-sm hover:bg-[#5C4033] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed font-playfair"
              >
                {submitState === 'loading' ? 'Đang gửi...' : 'Gửi góp ý'}
              </button>
            </form>

            {submitState !== 'idle' && (
              <p
                className={`mt-4 text-sm font-medium font-playfair ${
                  submitState === 'success' ? 'text-green-700' : submitState === 'error' ? 'text-red-700' : 'text-[#8B3A3A]'
                }`}
              >
                {statusMessage}
              </p>
            )}
          </article>
          )}
        </div>
      </div>
    </section>
  );
}
