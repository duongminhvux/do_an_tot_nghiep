'use client';

import React from 'react';
import { X } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-sm w-full space-y-4 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">{t('shortcuts_title')}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-1.5 text-xs divide-y divide-slate-100 max-h-[60vh] overflow-y-auto pr-1">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-slate-600 font-medium">{t('shortcut_flip')}</span>
            <kbd className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono text-[11px] font-bold">
              Space
            </kbd>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-slate-600 font-medium">{t('shortcut_check')}</span>
            <kbd className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono text-[11px] font-bold">
              Enter
            </kbd>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-rose-600 font-semibold">{t('srs.again')} (10m)</span>
            <kbd className="px-2 py-0.5 rounded bg-rose-50 border border-rose-300 font-mono text-[11px] font-bold text-rose-700">
              1
            </kbd>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-amber-600 font-semibold">{t('srs.hard')} (1-3d)</span>
            <kbd className="px-2 py-0.5 rounded bg-amber-50 border border-amber-300 font-mono text-[11px] font-bold text-amber-700">
              2
            </kbd>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-emerald-600 font-semibold">{t('srs.good')} (1-4d)</span>
            <kbd className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-300 font-mono text-[11px] font-bold text-emerald-700">
              3
            </kbd>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-blue-600 font-semibold">{t('srs.easy')} (1-7d)</span>
            <kbd className="px-2 py-0.5 rounded bg-blue-50 border border-blue-300 font-mono text-[11px] font-bold text-blue-700">
              4
            </kbd>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-purple-600 font-medium">{t('srs.mastered')}</span>
            <kbd className="px-2 py-0.5 rounded bg-purple-50 border border-purple-300 font-mono text-[11px] font-bold text-purple-700">
              M
            </kbd>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sky-600 font-medium">{t('srs.save')}</span>
            <kbd className="px-2 py-0.5 rounded bg-sky-50 border border-sky-300 font-mono text-[11px] font-bold text-sky-700">
              S
            </kbd>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-slate-600 font-medium">{t('shortcut_next')} / {t('shortcut_prev')}</span>
            <span className="inline-flex gap-1 font-mono text-[11px] font-bold">
              <kbd className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300">←</kbd>
              <kbd className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300">→</kbd>
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20 cursor-pointer"
        >
          {t('got_it')}
        </button>
      </div>
    </div>
  );
}
