'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StudyShortcutsModalProps {
  show: boolean;
  onClose: () => void;
  t: (key: string, options?: any) => string;
}

export function StudyShortcutsModal({
  show,
  onClose,
  t,
}: StudyShortcutsModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">{t('shortcuts_title')}</h3>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} className="text-slate-400">
            <X />
          </Button>
        </div>

        <div className="max-h-[60vh] space-y-1.5 divide-y divide-slate-100 overflow-y-auto pr-1 text-sm">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-slate-600 font-medium">{t('shortcut_flip')}</span>
            <kbd className="rounded-md px-2 py-0.5 bg-slate-100 border border-slate-300 font-mono text-[11px] font-bold">
              Space
            </kbd>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-slate-600 font-medium">{t('shortcut_check')}</span>
            <kbd className="rounded-md px-2 py-0.5 bg-slate-100 border border-slate-300 font-mono text-[11px] font-bold">
              Enter
            </kbd>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-red-600 font-semibold">{t('srs.again')} (10m)</span>
            <kbd className="rounded-md px-2 py-0.5 bg-red-50 border border-red-300 font-mono text-[11px] font-bold text-red-700">
              1
            </kbd>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-amber-600 font-semibold">{t('srs.hard')} (1-3d)</span>
            <kbd className="rounded-md px-2 py-0.5 bg-amber-50 border border-amber-300 font-mono text-[11px] font-bold text-amber-700">
              2
            </kbd>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-emerald-600 font-semibold">{t('srs.good')} (1-4d)</span>
            <kbd className="rounded-md px-2 py-0.5 bg-emerald-50 border border-emerald-300 font-mono text-[11px] font-bold text-emerald-700">
              3
            </kbd>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-blue-600 font-semibold">{t('srs.easy')} (1-7d)</span>
            <kbd className="rounded-md px-2 py-0.5 bg-blue-50 border border-blue-300 font-mono text-[11px] font-bold text-blue-700">
              4
            </kbd>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-emerald-600 font-medium">{t('srs.mastered')}</span>
            <kbd className="rounded-md px-2 py-0.5 bg-emerald-50 border border-emerald-300 font-mono text-[11px] font-bold text-emerald-700">
              M
            </kbd>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-blue-600 font-medium">{t('srs.save')}</span>
            <kbd className="rounded-md px-2 py-0.5 bg-blue-50 border border-blue-300 font-mono text-[11px] font-bold text-blue-700">
              S
            </kbd>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-slate-600 font-medium">{t('shortcut_next')} / {t('shortcut_prev')}</span>
            <span className="inline-flex gap-1 font-mono text-[11px] font-bold">
              <kbd className="rounded-md px-2 py-0.5 bg-slate-100 border border-slate-300">←</kbd>
              <kbd className="rounded-md px-2 py-0.5 bg-slate-100 border border-slate-300">→</kbd>
            </span>
          </div>
        </div>

        <Button type="button" onClick={onClose} className="w-full">
          {t('got_it')}
        </Button>
      </div>
    </div>
  );
}
