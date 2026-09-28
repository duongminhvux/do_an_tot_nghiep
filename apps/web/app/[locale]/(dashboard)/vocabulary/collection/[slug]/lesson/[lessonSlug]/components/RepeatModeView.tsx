'use client';

import React from 'react';
import {
  Volume2,
  Lightbulb,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  X,
} from 'lucide-react';

interface RepeatModeViewProps {
  posInfo?: { label: string; color: string; bg: string; border: string };
  playAudio: (customUrl?: string, langCode?: string, textToSpeak?: string, playbackRate?: number) => void;
  audioUs?: string;
  audioUk?: string;
  defaultAudioUrl?: string;
  isPlayingAudio: boolean;
  hintsRevealed: number;
  maxHints: number;
  maskedHint: string;
  handleGiveHint: () => void;
  userGuess: string;
  setUserGuess: (val: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isCorrect: boolean;
  isDontKnow: boolean;
  isAnswerChecked: boolean;
  shake: boolean;
  handleCheckGuess: () => void;
  handleDontKnow: () => void;
  handleNextWord: () => void;
  wordText: string;
  ipaUs?: string;
  ipaUk?: string;
  primaryVietnameseWord: string;
  t: (key: string, options?: any) => string;
}

export function RepeatModeView({
  posInfo,
  playAudio,
  audioUs,
  audioUk,
  defaultAudioUrl,
  isPlayingAudio,
  hintsRevealed,
  maxHints,
  maskedHint,
  handleGiveHint,
  userGuess,
  setUserGuess,
  inputRef,
  isCorrect,
  isDontKnow,
  isAnswerChecked,
  shake,
  handleCheckGuess,
  handleDontKnow,
  handleNextWord,
  wordText,
  ipaUs,
  ipaUk,
  primaryVietnameseWord,
  t,
}: RepeatModeViewProps) {
  return (
    <div className="w-full max-w-xl mx-auto space-y-4 text-center">
      {/* Header: Mode Badge & Topic */}
      <div className="space-y-1">
        <div className="flex items-center justify-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            {t('modes.repeat')}
          </span>
          {posInfo && (
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold border ${posInfo.bg} ${posInfo.color} ${posInfo.border}`}
            >
              {posInfo.label || t('pos.default')}
            </span>
          )}
        </div>
      </div>

      {/* Interactive Large Audio Trigger */}
      <div className="py-2 flex flex-col items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => playAudio()}
          className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg ${
            isPlayingAudio
              ? 'bg-blue-600 text-white ring-8 ring-blue-100 scale-105 animate-pulse'
              : 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white hover:scale-105 hover:shadow-xl hover:shadow-blue-500/25'
          }`}
          title={t('listen_pronounce')}
        >
          <Volume2 className="w-8 h-8 sm:w-10 sm:h-10" />
        </button>

        {/* Animated soundwave bars */}
        <div className="flex items-center justify-center gap-1.5 h-6">
          {[35, 65, 100, 55, 90, 45, 80, 50, 95, 30].map((h, i) => (
            <div
              key={i}
              className={`w-1.5 rounded-full bg-blue-600 transition-all duration-300 ${
                isPlayingAudio ? 'animate-pulse' : 'opacity-30'
              }`}
              style={{
                height: isPlayingAudio ? `${h}%` : '20%',
                animationDelay: `${i * 0.08}s`,
              }}
            />
          ))}
        </div>

        {/* Sound options: US & UK */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => playAudio(audioUs || defaultAudioUrl, 'en-US')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 text-xs font-semibold text-slate-800 shadow-2xs group cursor-pointer"
            title={t('listen_us')}
          >
            <Volume2 className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110" />
            <span>{t('listen_us')}</span>
          </button>

          <button
            type="button"
            onClick={() => playAudio(audioUk || defaultAudioUrl, 'en-GB')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 text-xs font-semibold text-slate-800 shadow-2xs group cursor-pointer"
            title={t('listen_uk')}
          >
            <Volume2 className="w-3.5 h-3.5 text-indigo-600 group-hover:scale-110" />
            <span>{t('listen_uk')}</span>
          </button>
        </div>

        <p className="text-xs text-slate-400 font-medium">
          {t('listen_prompt')}
        </p>
      </div>

      {/* Hint Pill if available */}
      {hintsRevealed > 0 && !isCorrect && (
        <div className="px-4 py-1.5 rounded-xl border border-dashed border-blue-400 bg-blue-50 font-mono text-sm tracking-widest text-blue-700 font-black inline-block shadow-sm">
          {maskedHint}
        </div>
      )}

      {/* Input Box for typing the word */}
      <div className="w-full max-w-md mx-auto pt-1">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!isCorrect && !isDontKnow) {
              handleCheckGuess();
            }
          }}
          className={`relative flex items-center rounded-2xl border bg-white shadow-sm transition-all p-1 ${
            shake ? 'animate-shake border-rose-500 ring-4 ring-rose-100' : ''
          } ${
            isCorrect
              ? 'border-emerald-500 ring-4 ring-emerald-100'
              : isDontKnow
              ? 'border-amber-400 ring-4 ring-amber-100'
              : 'border-slate-300 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100'
          }`}
        >
          {/* Nút "Không biết" bên trái input */}
          {!isCorrect && !isDontKnow && (
            <button
              type="button"
              onClick={handleDontKnow}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-amber-800 bg-slate-100 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 transition-all shrink-0 cursor-pointer ml-0.5 shadow-2xs"
              title={t('dont_know')}
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
              <span>{t('dont_know')}</span>
            </button>
          )}

          <input
            ref={inputRef}
            type="text"
            value={userGuess}
            onChange={(e) => setUserGuess(e.target.value)}
            placeholder={t('listen_type_placeholder')}
            disabled={isCorrect || isDontKnow}
            autoComplete="off"
            spellCheck="false"
            className="w-full px-3.5 py-1.5 text-sm text-slate-900 placeholder-slate-400 outline-none bg-transparent font-medium"
          />

          <div className="flex items-center gap-1 pr-1">
            {!isCorrect && !isDontKnow && (
              <button
                type="button"
                onClick={handleGiveHint}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  hintsRevealed >= maxHints
                    ? 'text-blue-600 hover:text-blue-700'
                    : 'text-slate-400 hover:text-amber-500'
                }`}
                title={
                  hintsRevealed >= maxHints
                    ? t('hint_audio')
                    : `${t('hint_btn')} (${hintsRevealed}/${maxHints})`
                }
              >
                {hintsRevealed >= maxHints ? (
                  <Volume2
                    className={`w-4 h-4 ${
                      isPlayingAudio ? 'animate-bounce' : ''
                    }`}
                  />
                ) : (
                  <Lightbulb className="w-4 h-4" />
                )}
              </button>
            )}

            {!isCorrect && !isDontKnow && (
              <button
                type="submit"
                className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </form>

        {/* Answer Feedback Banner */}
        {isAnswerChecked && (
          <div className="mt-3 animate-in fade-in">
            {isCorrect ? (
              <div className="p-3.5 bg-emerald-50/90 rounded-2xl border border-emerald-200 text-center space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{t('correct_feedback')}</span>
                </div>
                <div className="flex items-center justify-center gap-2 pt-0.5">
                  <h4 className="text-xl sm:text-2xl font-black text-slate-900">
                    {wordText}
                  </h4>
                  {(ipaUs || ipaUk) && (
                    <span className="text-xs font-mono text-slate-600 font-semibold bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {ipaUs || ipaUk}
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-blue-700">
                  {primaryVietnameseWord}
                </p>
              </div>
            ) : isDontKnow ? (
              <div className="p-3.5 bg-amber-50/90 rounded-2xl border border-amber-200 text-center space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-700">
                  <HelpCircle className="w-4 h-4 text-amber-600" />
                  <span>{t('dont_know_feedback')}</span>
                </div>
                <div className="flex items-center justify-center gap-2 pt-0.5">
                  <h4 className="text-xl sm:text-2xl font-black text-slate-900">
                    {wordText}
                  </h4>
                  {(ipaUs || ipaUk) && (
                    <span className="text-xs font-mono text-slate-600 font-semibold bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {ipaUs || ipaUk}
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-blue-700">
                  {primaryVietnameseWord}
                </p>
              </div>
            ) : (
              <span className="text-rose-700 inline-flex items-center gap-1.5 bg-rose-50 px-3 py-1 rounded-full border border-rose-200 text-xs font-bold">
                <X className="w-4 h-4" /> {t('incorrect_feedback')}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
