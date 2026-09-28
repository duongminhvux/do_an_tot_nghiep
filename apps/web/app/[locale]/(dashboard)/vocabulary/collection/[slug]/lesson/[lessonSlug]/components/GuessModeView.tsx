'use client';

import React from 'react';
import {
  Lightbulb,
  Volume2,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  X,
} from 'lucide-react';

interface GuessModeViewProps {
  illustration?: string;
  primaryVietnameseWord: string;
  posInfo?: { label: string; color: string; bg: string; border: string };
  primaryEnDefinition?: string;
  primaryExampleEn?: string;
  primaryExampleVi?: string;
  maskedExampleEn?: string;
  maskedHint: string;
  hintsRevealed: number;
  maxHints: number;
  handleGiveHint: () => void;
  isPlayingAudio: boolean;
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
  t: (key: string, options?: any) => string;
}

export function GuessModeView({
  illustration,
  primaryVietnameseWord,
  posInfo,
  primaryEnDefinition,
  primaryExampleEn,
  primaryExampleVi,
  maskedExampleEn,
  maskedHint,
  hintsRevealed,
  maxHints,
  handleGiveHint,
  isPlayingAudio,
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
  t,
}: GuessModeViewProps) {
  return (
    <div className="w-full max-w-xl mx-auto space-y-3 sm:space-y-3.5 text-center">
      {/* Illustration image */}
      {illustration ? (
        <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden mx-auto flex items-center justify-center bg-slate-50 shadow-sm border border-slate-200 p-2">
          <img
            src={illustration}
            alt={primaryVietnameseWord}
            className="w-full h-full object-contain hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLElement).parentElement?.style.setProperty('display', 'none');
            }}
          />
        </div>
      ) : null}

      {/* Meaning & Part of speech */}
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-xl sm:text-2xl font-black text-blue-600 tracking-tight">
            {primaryVietnameseWord}
          </span>
          {posInfo && (
            <span
              className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${posInfo.bg} ${posInfo.color} ${posInfo.border}`}
            >
              {posInfo.label || t('pos.default')}
            </span>
          )}
        </div>
      </div>

      {/* English definition if available */}
      {primaryEnDefinition && (
        <div className="space-y-0.5 max-w-lg mx-auto bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200">
          <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
            {t('definition_en')}
          </p>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
            {primaryEnDefinition}
          </p>
        </div>
      )}

      {/* Real example sentence with masked word */}
      {primaryExampleEn && (
        <div className="space-y-0.5 max-w-lg mx-auto bg-slate-50/70 p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
            {t('real_example')}
          </p>
          <p className="text-xs sm:text-sm text-slate-900 font-semibold italic leading-relaxed">
            &ldquo;{maskedExampleEn}&rdquo;
          </p>
          {primaryExampleVi && (
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {primaryExampleVi}
            </p>
          )}
        </div>
      )}

      {/* Strategic Masked letter hint + Audio hint button */}
      <div className="flex items-center justify-center gap-2.5 pt-1">
        <div className="px-4 py-1.5 rounded-xl border border-dashed border-blue-400 bg-blue-50 font-mono text-sm tracking-widest text-blue-700 font-black shadow-sm">
          {maskedHint}
        </div>

        <button
          type="button"
          onClick={handleGiveHint}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold shadow-sm transition-all cursor-pointer ${
            hintsRevealed >= maxHints
              ? 'border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-500'
              : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
          }`}
          title={hintsRevealed >= maxHints ? t('hint_audio') : t('hint_btn')}
        >
          {hintsRevealed >= maxHints ? (
            <>
              <Volume2
                className={`w-3.5 h-3.5 text-blue-600 ${
                  isPlayingAudio ? 'animate-bounce' : ''
                }`}
              />
              <span>{t('hint_audio')}</span>
            </>
          ) : (
            <>
              <Lightbulb className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>
                {t('hint_btn')} ({hintsRevealed}/{maxHints})
              </span>
            </>
          )}
        </button>
      </div>

      {/* Input Box for typing guess */}
      <div className="w-full max-w-md mx-auto pt-0.5">
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
            placeholder={t('guess_placeholder')}
            disabled={isCorrect || isDontKnow}
            autoComplete="off"
            spellCheck="false"
            className="w-full px-3.5 py-1.5 text-sm text-slate-900 placeholder-slate-400 outline-none bg-transparent font-medium"
          />

          {!isCorrect && !isDontKnow && (
            <div className="pr-1">
              <button
                type="submit"
                className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </form>

        {/* Checked answer feedback banner */}
        {isAnswerChecked && (
          <div className="mt-3 text-xs font-bold animate-in fade-in">
            {isCorrect ? (
              <span className="text-emerald-700 inline-flex items-center gap-1.5 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" /> {t('correct_feedback')}
              </span>
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
              <span className="text-rose-700 inline-flex items-center gap-1.5 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                <X className="w-4 h-4" /> {t('incorrect_feedback')}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
