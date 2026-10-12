/** Only plain local administrative paths may reach router.replace. */
export function safeAdminRedirect(destination: string | null): string {
  if (!destination || /[\u0000-\u0020\u007f\\]/.test(destination)) return '/admin';
  const pathname = destination.split(/[?#]/, 1)[0];
  if (!/^\/admin(?:\/[a-zA-Z0-9_-]*)*$/.test(pathname) || pathname.includes('//') ||
      pathname === '/admin/login' || pathname.startsWith('/admin/login/')) return '/admin';
  return destination;
}
