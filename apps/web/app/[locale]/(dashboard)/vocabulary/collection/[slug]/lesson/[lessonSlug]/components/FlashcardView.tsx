'use client';

import React from 'react';
import { Volume2 } from 'lucide-react';

interface ParsedMeaning {
  definition: string;
  translations: string[];
  synonyms: string[];
  antonyms: string[];
  examples: Array<{ en?: string; vi?: string }>;
}

interface ParsedPart {
  partOfSpeech: string;
  info: { label: string; color: string; bg: string; border: string };
  meanings: ParsedMeaning[];
}

interface FlashcardViewProps {
  isFlipped: boolean;
  toggleFlipCard: () => void;
  currentIndex: number;
  totalWords: number;
  wordLevel?: string;
  illustration?: string;
  wordText: string;
  ipaUs?: string;
  ipaUk?: string;
  audioUs?: string;
  audioUk?: string;
  defaultAudioUrl?: string;
  isPlayingAudio: boolean;
  playingAudioType?: 'us' | 'uk' | 'example' | null;
  playAudio: (customUrl?: string, langCode?: string, textToSpeak?: string, playbackRate?: number, audioType?: 'us' | 'uk') => void;
  parsedParts: ParsedPart[];
  totalMeaningsCount: number;
  t: (key: string, options?: any) => string;
}

export function FlashcardView({
  isFlipped,
  toggleFlipCard,
  currentIndex,
  totalWords,
  wordLevel,
  illustration,
  wordText,
  ipaUs,
  ipaUk,
  audioUs,
  audioUk,
  defaultAudioUrl,
  isPlayingAudio,
  playingAudioType,
  playAudio,
  parsedParts,
  totalMeaningsCount,
  t,
}: FlashcardViewProps) {
  return (
    <div className="flashcard-3d-wrapper">
      <div
        className={`flashcard-3d-inner cursor-pointer select-none ${
          isFlipped ? 'is-flipped' : ''
        }`}
        onClick={toggleFlipCard}
      >
        {/* --------------------------------------------- */}
        {/* CARD FRONT: Razor Sharp, Solid White, Full Width */}
        {/* --------------------------------------------- */}
        <div
          className="flashcard-face flashcard-front rounded-xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-md hover:shadow-lg transition-all flex flex-col justify-between overflow-hidden"
          style={{ pointerEvents: isFlipped ? 'none' : 'auto' }}
        >
          {/* Top Card Badge Header */}
          <div className="flex items-center justify-between w-full shrink-0">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                {t('card_label', { current: currentIndex + 1, total: totalWords })}
              </span>
              {wordLevel && (
                <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-black border border-indigo-200">
                  {wordLevel}
                </span>
              )}
            </div>

            <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
              {t('front_hint')}
            </span>
          </div>

          {/* Center Content */}
          <div className="flex-1 flex flex-col items-center justify-center my-auto space-y-3 sm:space-y-4 text-center py-1 min-h-0">
            {/* Illustration image if available */}
            {illustration && (
              <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden bg-slate-50 border border-slate-200 p-2 shrink-0 group shadow-sm">
                <img
                  src={illustration}
                  alt={wordText}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    (e.target as HTMLElement).parentElement?.style.setProperty('display', 'none');
                  }}
                />
              </div>
            )}

            {/* Main Word */}
            <div className="space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {wordText}
              </h2>

              {/* US & UK Pronunciation Pills with Audio Trigger */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5">
                {/* US Audio & IPA */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    playAudio(audioUs || defaultAudioUrl, 'en-US', undefined, 1, 'us');
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs text-slate-800 transition-all shadow-2xs group cursor-pointer"
                  title={t('listen_us')}
                >
                  <Volume2
                    className={`w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform ${
                      playingAudioType === 'us' ? 'animate-bounce' : ''
                    }`}
                  />
                  {ipaUs && <span className="font-mono font-semibold">{ipaUs}</span>}
                  <span className="text-[10px] font-black text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                    US
                  </span>
                </button>

                {/* UK Audio & IPA */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    playAudio(audioUk || defaultAudioUrl, 'en-GB', undefined, 1, 'uk');
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-xs text-slate-800 transition-all shadow-2xs group cursor-pointer"
                  title={t('listen_uk')}
                >
                  <Volume2
                    className={`w-3.5 h-3.5 text-indigo-600 group-hover:scale-110 transition-transform ${
                      playingAudioType === 'uk' ? 'animate-bounce' : ''
                    }`}
                  />
                  {ipaUk && <span className="font-mono font-semibold">{ipaUk}</span>}
                  <span className="text-[10px] font-black text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                    UK
                  </span>
                </button>
              </div>
            </div>

            {/* Teaser of primary part of speech */}
            <div className="flex items-center justify-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${parsedParts[0]?.info.bg} ${parsedParts[0]?.info.color} ${parsedParts[0]?.info.border}`}
              >
                {parsedParts[0]?.info.label || t('pos.default')}
              </span>
              {totalMeaningsCount > 1 && (
                <span className="text-xs font-semibold text-slate-500">
                  {t('meanings_count_badge', { count: totalMeaningsCount })}
                </span>
              )}
            </div>
          </div>

          {/* Bottom Card Footer Prompt */}
          <div className="shrink-0 flex items-center justify-between text-[11px] text-slate-400 pt-2.5 border-t border-slate-100/80">
            <span>{t('space_prompt_flip')}</span>
            <span className="text-slate-400">Click để lật thẻ ↻</span>
          </div>
        </div>

        {/* --------------------------------------------- */}
        {/* CARD BACK: DISPLAYING ALL MEANINGS & EXAMPLES */}
        {/* --------------------------------------------- */}
        <div
          className="flashcard-face flashcard-back rounded-xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-md flex flex-col justify-between overflow-hidden"
          style={{ pointerEvents: isFlipped ? 'auto' : 'none' }}
        >
          {/* Header: Word & BOTH US & UK Audios / IPAs & Summary */}
          <div className="flex flex-wrap items-center justify-between pb-2.5 border-b border-slate-100 shrink-0 gap-2">
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                {wordText}
              </h3>

              {/* US Button & IPA */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  playAudio(audioUs || defaultAudioUrl, 'en-US', undefined, 1, 'us');
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs text-slate-800 transition-all shadow-2xs group cursor-pointer"
                title={t('listen_us')}
              >
                <Volume2
                  className={`w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform ${
                    playingAudioType === 'us' ? 'animate-bounce' : ''
                  }`}
                />
                {ipaUs && <span className="font-mono font-semibold text-[11px]">{ipaUs}</span>}
                <span className="text-[10px] font-black text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                  US
                </span>
              </button>

              {/* UK Button & IPA */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  playAudio(audioUk || defaultAudioUrl, 'en-GB', undefined, 1, 'uk');
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-xs text-slate-800 transition-all shadow-2xs group cursor-pointer"
                title={t('listen_uk')}
              >
                <Volume2
                  className={`w-3.5 h-3.5 text-indigo-600 group-hover:scale-110 transition-transform ${
                    playingAudioType === 'uk' ? 'animate-bounce' : ''
                  }`}
                />
                {ipaUk && <span className="font-mono font-semibold text-[11px]">{ipaUk}</span>}
                <span className="text-[10px] font-black text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                  UK
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200">
                {t('all_meanings_badge', { count: totalMeaningsCount })}
              </span>
            </div>
          </div>

          {/* Content Area: Scrollable internally so back face never stretches the page */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-h-0 overflow-y-auto pr-1 sm:pr-2.5 py-2.5 space-y-4 text-left my-1 divide-y divide-slate-100 flashcard-scroll overscroll-contain"
          >
            {parsedParts.map((partGroup, partIdx) => (
              <div key={partIdx} className={partIdx > 0 ? 'pt-4 space-y-3' : 'space-y-3'}>
                {/* Part of Speech Header Badge */}
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider border shadow-2xs ${partGroup.info.bg} ${partGroup.info.color} ${partGroup.info.border}`}
                  >
                    {partGroup.info.label} ({partGroup.partOfSpeech})
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {t('meanings_count_sub', { count: partGroup.meanings.length })}
                  </span>
                </div>

                {/* List of meanings inside this part of speech */}
                <div className="space-y-3 pl-1 sm:pl-2">
                  {partGroup.meanings.map((meaningItem, mIdx) => (
                    <div
                      key={mIdx}
                      className="p-3 sm:p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2 hover:bg-slate-50 transition-colors"
                    >
                      {/* Translations (Tiếng Việt) */}
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                          {mIdx + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                            {meaningItem.translations.join(', ') || t('meaning_default')}
                          </p>
                        </div>
                      </div>

                      {/* English Definition */}
                      {meaningItem.definition && (
                        <div className="pl-7 text-xs sm:text-sm text-slate-700 font-medium leading-relaxed italic">
                          &ldquo;{meaningItem.definition}&rdquo;
                        </div>
                      )}

                      {/* Example sentences */}
                      {meaningItem.examples && meaningItem.examples.length > 0 && (
                        <div className="pl-7 space-y-1.5 pt-1 border-t border-slate-200 mt-0.5">
                          {meaningItem.examples.map((ex, exIdx) => (
                            <div
                              key={exIdx}
                              className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs space-y-0.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-bold text-slate-900 leading-relaxed text-xs">
                                  {ex.en}
                                </p>
                                {ex.en && (
                                  <button
                                    type="button"
                                    onClick={() => playAudio(undefined, 'en-US', ex.en)}
                                    className="text-slate-400 hover:text-blue-600 shrink-0 p-0.5 cursor-pointer"
                                    title={t('listen_example')}
                                  >
                                    <Volume2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                              {ex.vi && (
                                <p className="text-slate-600 font-normal">
                                  {ex.vi}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Synonyms & Antonyms */}
                      {(meaningItem.synonyms.length > 0 || meaningItem.antonyms.length > 0) && (
                        <div className="pl-7 flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                          {meaningItem.synonyms.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-emerald-800">{t('synonyms')}</span>
                              {meaningItem.synonyms.map((syn, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-300 font-semibold text-[11px]"
                                >
                                  {syn}
                                </span>
                              ))}
                            </div>
                          )}

                          {meaningItem.antonyms.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-rose-800">{t('antonyms')}</span>
                              {meaningItem.antonyms.map((ant, aIdx) => (
                                <span
                                  key={aIdx}
                                  className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-900 border border-rose-300 font-semibold text-[11px]"
                                >
                                  {ant}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Card Footer Prompt */}
          <div className="shrink-0 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100/80">
            <span>{t('space_prompt_flip')}</span>
            <span className="text-slate-400 flex items-center gap-1 font-medium">
              <span>Cuộn xem thêm</span>
              <span className="text-blue-500 font-bold">↕</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
