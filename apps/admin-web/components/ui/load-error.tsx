'use client';

import { useParams } from 'next/navigation';
import { AlertCircle, RefreshCw } from 'lucide-react';

export function LoadError({ onRetry }: { onRetry: () => void }) {
  const { locale } = useParams();
  const english = locale === 'en';
  return (
    <div className="p-4 sm:p-6">
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p className="min-w-0 flex-1">{english ? 'Unable to load data. Please try again.' : 'Không thể tải dữ liệu. Vui lòng thử lại.'}</p>
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 font-semibold hover:bg-red-100">
          <RefreshCw className="h-4 w-4" />{english ? 'Retry' : 'Thử lại'}
        </button>
      </div>
    </div>
  );
}
