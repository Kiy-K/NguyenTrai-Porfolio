import type { AdminStatus } from '@/components/admin/types';

export default function StatusMessage({ status }: { status: AdminStatus }) {
  if (!status.type) return null;
  return (
    <div role={status.type === 'error' ? 'alert' : 'status'} className={`p-4 mb-6 rounded-xl text-sm font-medium ${
      status.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
      status.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
      'bg-blue-50 text-blue-800 border border-blue-200'
    }`}>{status.message}</div>
  );
}
