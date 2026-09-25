'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { ImportSummaryResult } from './types';

interface ImportSummaryBannerProps {
  result: ImportSummaryResult;
  onClose: () => void;
  onNavigateToCreateWord: () => void;
}

export function ImportSummaryBanner({
  result,
  onClose,
  onNavigateToCreateWord,
}: ImportSummaryBannerProps) {
  const { t } = useTranslation('vocabulary');
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(result.notFoundWords.join(', '));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3 animate-in fade-in duration-150 shrink-0">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-blue-600" />
          <h5 className="font-bold text-xs text-slate-800">
            {t('import_result_title', 'Kết quả import từ vựng')}
          </h5>
          <span className="text-[11px] text-slate-400">
            ({result.totalInput} {t('words_label', 'từ')} đã kiểm tra)
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Success section if words were added */}
      {result.addedCount > 0 && (
        <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <div className="flex-1">
            <span>
              {t('import_result_added', {
                count: result.addedCount,
                defaultValue: `Đã thêm thành công ${result.addedCount} từ vào bài học.`,
              })}
            </span>
            {result.alreadyInCount > 0 && (
              <span className="ml-1 text-[11px] font-normal text-emerald-600">
                (
                {t('import_result_already_in', {
                  count: result.alreadyInCount,
                  defaultValue: `${result.alreadyInCount} từ đã có sẵn trong bài học`,
                })}
                )
              </span>
            )}
          </div>
        </div>
      )}

      {/* Warning section if words were NOT found in database */}
      {result.notFoundWords.length > 0 && (
        <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-amber-900 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                {t('import_result_not_found_header', {
                  count: result.notFoundWords.length,
                  defaultValue: `Có ${result.notFoundWords.length} từ không tồn tại trong từ điển (đã bỏ qua):`,
                })}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-amber-100/60 border border-amber-300 text-amber-800 font-semibold rounded-lg text-[11px] transition-colors cursor-pointer shadow-2xs"
            >
              {isCopied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-700">{t('import_copied', 'Đã sao chép!')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-amber-700" />
                  <span>{t('import_copy_not_found', 'Sao chép từ chưa có')}</span>
                </>
              )}
            </button>
          </div>

          {/* List of missing words */}
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
            {result.notFoundWords.map((word) => (
              <span
                key={word}
                className="px-2 py-0.5 bg-white border border-amber-300/80 text-amber-800 font-medium rounded-md text-[11px] font-mono shadow-2xs"
              >
                {word}
              </span>
            ))}
          </div>

          <div className="pt-1 flex items-center justify-between text-[11px] text-amber-700">
            <span>{t('import_file_not_found_warning', 'Các từ sau chưa có trong kho từ điển.')}</span>
            <button
              type="button"
              onClick={onNavigateToCreateWord}
              className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer ml-2 shrink-0"
            >
              <span>{t('import_create_missing_words', 'Tạo từ mới trong kho từ')}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Case: No words found in database and 0 words added */}
      {result.addedCount === 0 &&
        result.notFoundWords.length > 0 &&
        result.alreadyInCount === 0 && (
          <p className="text-xs text-rose-600 font-medium">
            {t('import_result_all_not_found', {
              count: result.notFoundWords.length,
              defaultValue: `Không tìm thấy từ nào trong từ điển. Cả ${result.notFoundWords.length} từ đều chưa có trong database.`,
            })}
          </p>
        )}
    </div>
  );
}
