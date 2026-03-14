'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';

interface SummarizeButtonProps {
  text: string;
  compact?: boolean;
}

export default function SummarizeButton({ text, compact = false }: SummarizeButtonProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSummarize = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/get-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });
      
      let data;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const textResponse = await res.text();
        console.error("Non-JSON response:", textResponse);
        throw new Error(`Lỗi máy chủ (${res.status}): Phản hồi không hợp lệ.`);
      }
      
      if (!res.ok) {
        throw new Error(data?.error || `Lỗi khi tóm tắt (${res.status})`);
      }
      
      if (!data?.summary) {
        throw new Error('API không trả về nội dung tóm tắt.');
      }
      
      setSummary(data.summary);
    } catch (err: any) {
      console.error("Summarize error:", err);
      setError(err.message || "Không thể tải bản tóm tắt.");
    } finally {
      setLoading(false);
    }
  };

  const wrapperClasses = compact 
    ? "mt-3 mb-2 bg-indigo-50/40 rounded-lg p-3 border border-indigo-100/50 transition-all duration-300 hover:bg-indigo-50/80 hover:border-indigo-200/80 hover:shadow-sm"
    : "mt-6 bg-indigo-50/50 rounded-xl p-5 border border-indigo-100 transition-all duration-300 hover:bg-indigo-50 hover:border-indigo-200 hover:shadow-md";

  return (
    <div className={wrapperClasses}>
      {!summary && !loading && !error && (
        <button
          type="button"
          onClick={handleSummarize}
          className="group flex items-center text-sm font-medium text-indigo-600 transition-all duration-300 hover:text-indigo-700 active:scale-95"
        >
          <div className="relative flex items-center justify-center w-6 h-6 mr-2 rounded-full bg-indigo-100/50 text-indigo-600 transition-all duration-300 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-md group-hover:shadow-indigo-200">
            <Sparkles className="w-3.5 h-3.5 transition-transform duration-300 group-hover:scale-110" />
          </div>
          <span className="relative after:absolute after:bottom-0 after:left-0 after:h-[1.5px] after:w-0 after:bg-indigo-600 after:transition-all after:duration-300 group-hover:after:w-full">
            Tóm tắt bằng AI
          </span>
        </button>
      )}

      {loading && (
        <div className="flex items-center text-sm font-medium text-indigo-600">
          <div className="relative flex items-center justify-center w-6 h-6 mr-2 rounded-full bg-indigo-100/80 text-indigo-600">
            <Sparkles className="w-3.5 h-3.5 animate-ping absolute opacity-75" />
            <Sparkles className="w-3.5 h-3.5 relative" />
          </div>
          <span className="animate-pulse">Đang tạo bản tóm tắt...</span>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 animate-in fade-in slide-in-from-top-1 duration-300">
          <p className="flex items-center">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-2"></span>
            {error}
          </p>
          <button 
            onClick={handleSummarize}
            className="mt-2 ml-3.5 text-indigo-600 hover:text-indigo-800 font-medium transition-colors hover:underline underline-offset-2"
          >
            Thử lại
          </button>
        </div>
      )}

      {summary && !loading && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex items-center text-sm font-semibold text-indigo-900 mb-3">
            <div className="flex items-center justify-center w-6 h-6 mr-2 rounded-full bg-indigo-600 text-white shadow-sm shadow-indigo-200">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            Bản tóm tắt AI
          </div>
          <div className="relative pl-4 border-l-2 border-indigo-200/70">
            <p className="text-sm text-indigo-900/80 leading-relaxed">{summary}</p>
          </div>
        </div>
      )}
    </div>
  );
}
