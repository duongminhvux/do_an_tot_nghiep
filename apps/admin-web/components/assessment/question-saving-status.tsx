import { Loader2 } from 'lucide-react';

interface QuestionSavingStatusProps {
  locale: string;
  title?: string;
  description?: string;
}

export function QuestionSavingStatus({ locale, title, description }: QuestionSavingStatusProps) {
  const en = locale === 'en';
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 pointer-events-auto select-none">
      <div role="status" aria-live="polite" className="flex w-full max-w-sm items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <Loader2 aria-hidden="true" className="h-7 w-7 shrink-0 animate-spin text-blue-600" />
        <div>
          <p className="font-semibold text-slate-900 text-sm">
            {title || (en ? 'Creating questions…' : 'Đang tạo câu hỏi…')}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {description || (en ? 'Please wait until saving is complete, do not navigate away.' : 'Vui lòng đợi đến khi lưu hoàn tất, không thao tác thêm.')}
          </p>
        </div>
      </div>
    </div>
  );
}
