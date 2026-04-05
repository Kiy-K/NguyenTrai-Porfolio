'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/admin';
  const [password, setPassword] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/admin/auth/status', { cache: 'no-store' });
        if (res.ok) {
          router.replace(nextPath);
        }
      } catch {
        // no-op
      }
    };

    checkStatus();
  }, [nextPath, router]);

  const bootstrapPassword = async () => {
    setIsLoading(true);
    setStatus('Đang tạo/lấy mật khẩu admin...');

    try {
      const res = await fetch('/api/admin/auth/bootstrap', {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({} as { error?: string; password?: string }));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tạo mật khẩu admin.');
      }

      setGeneratedPassword(data.password || '');
      setStatus('Mật khẩu admin đã sẵn sàng. Hãy sao chép và đăng nhập.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Không thể tạo mật khẩu admin.';
      setStatus(message);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!password.trim()) {
      setStatus('Vui lòng nhập mật khẩu.');
      return;
    }

    setIsLoading(true);
    setStatus('Đang đăng nhập...');

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json().catch(() => ({} as { error?: string }));

      if (!res.ok) {
        throw new Error(data.error || 'Đăng nhập thất bại.');
      }

      router.replace(nextPath);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Đăng nhập thất bại.';
      setStatus(message);
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FFFDF8] text-[#2C1E16] flex items-center justify-center p-6">
      <section className="w-full max-w-lg bg-white border border-[#D4C4A8] rounded-2xl p-8 shadow-sm">
        <h1 className="text-2xl font-bold mb-2">Admin Login</h1>
        <p className="text-sm text-[#5C4033] mb-6">
          Phiên đăng nhập admin có hiệu lực 3 giờ và gắn với IP hiện tại.
        </p>

        <form onSubmit={login} className="space-y-4">
          <div>
            <label htmlFor="admin-password" className="block font-semibold mb-2">
              Mật khẩu
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu admin"
              className="w-full px-4 py-3 border border-[#D4C4A8] rounded-lg"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-5 py-3 rounded-lg bg-[#8B3A3A] text-white font-bold disabled:opacity-60"
          >
            {isLoading ? 'Đang xử lý...' : 'Đăng nhập'}
          </button>
        </form>

        <button
          type="button"
          onClick={bootstrapPassword}
          disabled={isLoading}
          className="w-full mt-3 px-5 py-3 rounded-lg border border-[#8B3A3A] text-[#8B3A3A] font-semibold disabled:opacity-60"
        >
          Tạo/Lấy mật khẩu ngẫu nhiên
        </button>

        <p className="mt-3 text-xs text-[#8B3A3A]">
          Lưu ý bảo mật: mật khẩu chỉ hiển thị một lần sau khi khởi tạo. Hãy lưu vào nơi an toàn (password manager) trước khi rời trang.
        </p>

        {generatedPassword && (
          <div className="mt-4 p-3 rounded-lg bg-[#FFF4D8] border border-[#D4C4A8]">
            <p className="text-sm font-semibold">Mật khẩu admin:</p>
            <p className="font-mono break-all text-sm">{generatedPassword}</p>
            <p className="mt-2 text-xs text-[#8B3A3A]">
              Mật khẩu này sẽ không được hiển thị lại qua hệ thống vì lý do bảo mật.
            </p>
          </div>
        )}

        {status && <p className="mt-4 text-sm text-[#5C4033]">{status}</p>}
      </section>
    </main>
  );
}
