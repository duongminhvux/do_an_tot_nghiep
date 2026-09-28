'use client';

import React from 'react';
import { X } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-sm w-full space-y-4 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">{t('settings_title')}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <label className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
            <div>
              <span className="font-bold text-slate-800 block">{t('sound_effects')}</span>
              <span className="text-[11px] text-slate-400 font-normal">{t('sound_effects_desc')}</span>
            </div>
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => setSoundEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
            <div>
              <span className="font-bold text-slate-800 block">{t('auto_pronounce')}</span>
              <span className="text-[11px] text-slate-400 font-normal">{t('auto_pronounce_desc')}</span>
            </div>
            <input
              type="checkbox"
              checked={autoPlayAudio}
              onChange={(e) => setAutoPlayAudio(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </label>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20 cursor-pointer"
        >
          {t('save_close')}
        </button>
      </div>
    </div>
  );
}
