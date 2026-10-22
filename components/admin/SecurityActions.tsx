'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { CLEAR_ALL_CONFIRMATION } from '@/lib/constants';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import StatusMessage from '@/components/admin/StatusMessage';
import type { AdminStatus, MutationState } from '@/components/admin/types';

export default function SecurityActions({ isMutationPending, setIsMutationPending }: MutationState) {
  const router = useRouter();
  const [status, setStatus] = useState<AdminStatus>({ type: null, message: '' });
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const handleClearDatabase = () => {
    setClearConfirmText('');
    setShowClearConfirm(true);
  };

  const confirmClearDatabase = async () => {
    if (clearConfirmText !== CLEAR_ALL_CONFIRMATION || isMutationPending) return;
    setShowClearConfirm(false);
    setIsMutationPending(true);
    setStatus({ type: 'loading', message: 'Đang xóa dữ liệu...' });

    try {
      const res = await fetch('/api/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: clearConfirmText }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Có lỗi xảy ra khi xóa dữ liệu');
      }

      // Hand the admin a recovery copy of everything that was removed.
      const backupUrl = URL.createObjectURL(
        new Blob([JSON.stringify({ products: data.deleted ?? [] }, null, 2)], { type: 'application/json' })
      );
      const link = document.createElement('a');
      link.href = backupUrl;
      link.download = `products-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoking too early can cancel the download in Firefox/Safari.
      setTimeout(() => URL.revokeObjectURL(backupUrl), 60_000);

      setStatus({ type: 'success', message: 'Đã xóa toàn bộ dữ liệu thành công! Bản sao lưu đã được tải xuống.' });

      setTimeout(() => {
        router.push('/');
      }, 1500);

    } catch (error: any) {
      setIsMutationPending(false);
      setStatus({ type: 'error', message: error.message });
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/admin/login');
    }
  };

  return (<>
        <div className="mb-8 flex flex-wrap gap-4 justify-between items-center animate-in fade-in slide-in-from-left-4 duration-500">
          <BackButton fallbackUrl="/" />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleClearDatabase}
              disabled={isMutationPending}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium text-sm shadow-sm"
            >
              Xóa toàn bộ dữ liệu (Clear DB)
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#5C4033] text-white rounded-md hover:bg-[#2C1E16] transition-colors font-medium text-sm shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              Đăng xuất
            </button>
          </div>
        </div>

    <StatusMessage status={status} />
      {/* Modal Xóa Toàn Bộ Dữ Liệu */}
      {showClearConfirm && (
        <ConfirmDialog titleId="clear-title" onCancel={() => setShowClearConfirm(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full border-2 border-[#8B3A3A] animate-in zoom-in-95 duration-200">
            <h3 id="clear-title" className="text-2xl font-bold text-[#8B3A3A] mb-4 font-playfair text-center">Xóa toàn bộ bài viết?</h3>
            <p className="text-[#2C1E16] mb-6 text-center text-lg">
              Bạn sắp xóa <strong>TOÀN BỘ bài viết</strong>. Sau khi xóa, bản sao lưu JSON sẽ được tải xuống. Giữ tệp này để phục hồi; trang quản trị không có nút hoàn tác.
            </p>
            <label htmlFor="clear-confirm" className="block text-[#2C1E16] mb-2 text-center">
              Nhập <strong>{CLEAR_ALL_CONFIRMATION}</strong> để xác nhận:
            </label>
            <input
              id="clear-confirm"
              type="text"
              value={clearConfirmText}
              onChange={(e) => setClearConfirmText(e.target.value)}
              autoComplete="off"
              className="w-full mb-6 px-4 py-2 border-2 border-[#D4C4A8] rounded-lg focus:outline-none focus:border-[#8B3A3A]"
            />
            <div className="flex justify-center gap-4">
              <button
                type="button"
                data-dialog-cancel
                onClick={() => setShowClearConfirm(false)}
                className="px-6 py-3 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300 transition-colors font-playfair"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={confirmClearDatabase}
                disabled={clearConfirmText !== CLEAR_ALL_CONFIRMATION || isMutationPending}
                className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors font-playfair shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Xóa Dữ Liệu
              </button>
            </div>
          </div>
        </ConfirmDialog>
      )}

  </>);
}
