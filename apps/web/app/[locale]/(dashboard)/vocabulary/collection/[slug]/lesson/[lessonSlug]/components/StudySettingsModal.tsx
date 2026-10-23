'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StudySettingsModalProps {
  show: boolean;
  onClose: () => void;
  soundEnabled: boolean;
  setSoundEnabled: (val: boolean) => void;
  autoPlayAudio: boolean;
  setAutoPlayAudio: (val: boolean) => void;
  t: (key: string, options?: any) => string;
}

export function StudySettingsModal({
  show,
  onClose,
  soundEnabled,
  setSoundEnabled,
  autoPlayAudio,
  setAutoPlayAudio,
  t,
}: StudySettingsModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">{t('settings_title')}</h3>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} className="text-slate-400">
            <X />
          </Button>
        </div>

        <div className="space-y-3 text-sm">
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
            <div>
              <span className="block font-semibold text-slate-800">{t('sound_effects')}</span>
              <span className="text-xs font-normal text-slate-500">{t('sound_effects_desc')}</span>
            </div>
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => setSoundEnabled(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded accent-blue-600"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
            <div>
              <span className="block font-semibold text-slate-800">{t('auto_pronounce')}</span>
              <span className="text-xs font-normal text-slate-500">{t('auto_pronounce_desc')}</span>
            </div>
            <input
              type="checkbox"
              checked={autoPlayAudio}
              onChange={(e) => setAutoPlayAudio(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded accent-blue-600"
            />
          </label>
        </div>

        <Button type="button" onClick={onClose} className="w-full">
          {t('save_close')}
        </Button>
      </div>
    </div>
  );
}
