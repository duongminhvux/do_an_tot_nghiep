'use client';

import React, { useLayoutEffect, useRef } from 'react';
import styles from './FlashcardView.module.css';
import { RotateCcw, Volume2 } from 'lucide-react';

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
  wordId?: string;
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

function PronunciationButton({
  accent,
  ipa,
  active,
  title,
  onPlay,
  size = 'md',
}: {
  accent: 'US' | 'UK';
  ipa?: string;
  active: boolean;
  title: string;
  onPlay: () => void;
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onPlay();
      }}
      title={title}
      aria-label={`${title}${ipa ? ` ${ipa}` : ''}`}
      className={`group inline-flex items-center gap-2 rounded-full border bg-white text-slate-700 outline-none transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500 ${
        active ? 'border-blue-300 bg-blue-50' : 'border-slate-200'
      } ${size === 'sm' ? 'h-8 pl-2 pr-2.5 text-xs' : 'h-10 pl-2.5 pr-3.5 text-sm'}`}
    >
      <span
        className={`flex items-center justify-center rounded-full bg-blue-600 text-white ${
          size === 'sm' ? 'size-5' : 'size-6'
        }`}
      >
        <Volume2 aria-hidden="true" className={`${size === 'sm' ? 'size-3' : 'size-3.5'} ${active ? 'motion-safe:animate-pulse' : ''}`} />
      </span>
      <span className="text-[11px] font-bold text-blue-700">{accent}</span>
      {ipa && <span className="font-mono text-slate-600">{ipa}</span>}
    </button>
  );
}

export function FlashcardView({
  wordId,
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
  playingAudioType,
  playAudio,
  parsedParts,
  totalMeaningsCount,
  t,
}: FlashcardViewProps) {
  const meaningsRef = useRef<HTMLDivElement>(null);
  const [imageFailed, setImageFailed] = React.useState(false);
  useLayoutEffect(() => {
    if (meaningsRef.current) meaningsRef.current.scrollTop = 0;
    setImageFailed(false);
  }, [wordId, wordText, currentIndex]);

  const playUs = () => playAudio(audioUs || defaultAudioUrl, 'en-US', undefined, 1, 'us');
  const playUk = () => playAudio(audioUk || defaultAudioUrl, 'en-GB', undefined, 1, 'uk');
  const primary = parsedParts[0];
  const showImage = !!illustration && !imageFailed;

  return (
    <div className={`flashcard-3d-wrapper ${styles.wrapper}`}>
      <div
        className={`flashcard-3d-inner ${styles.inner} ${isFlipped ? `is-flipped ${styles.flipped}` : ''}`}
      >
        {/* FRONT */}
        <div
          inert={isFlipped}
          aria-hidden={isFlipped}
          onClick={toggleFlipCard}
          className={`${styles.face} ${styles.front} flex cursor-pointer select-none flex-col rounded-2xl border border-slate-200 bg-white shadow-sm`}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-4 sm:px-6 sm:pt-5">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600">
              {t('card_label', { current: currentIndex + 1, total: totalWords })}
            </span>
            {wordLevel && (
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-200">
                {wordLevel}
              </span>
            )}
          </div>

          <div
            className={`flex min-h-0 flex-1 items-center justify-center gap-6 px-5 py-4 sm:gap-10 sm:px-10 ${
              showImage ? 'flex-col md:flex-row' : 'flex-col'
            }`}
          >
            {showImage && (
              <div className={`${styles.illustration} shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={illustration}
                  alt=""
                  draggable={false}
                  className="size-full object-contain p-3"
                  onError={() => setImageFailed(true)}
                />
              </div>
            )}
            <div className={`flex min-w-0 flex-col gap-4 ${showImage ? 'items-center text-center md:items-start md:text-left' : 'items-center text-center'}`}>
              {primary && (
                <span className={`w-fit rounded-md border px-2 py-0.5 text-xs font-semibold ${primary.info.bg} ${primary.info.color} ${primary.info.border}`}>
                  {primary.info.label || t('pos.default')}
                </span>
              )}
              <h2 className={`${styles.word} font-bold tracking-tight text-slate-900`}>{wordText}</h2>
              <div className={`flex flex-wrap gap-2 ${showImage ? 'justify-center md:justify-start' : 'justify-center'}`}>
                <PronunciationButton accent="US" ipa={ipaUs} active={playingAudioType === 'us'} title={t('listen_us')} onPlay={playUs} />
                <PronunciationButton accent="UK" ipa={ipaUk} active={playingAudioType === 'uk'} title={t('listen_uk')} onPlay={playUk} />
              </div>
              {totalMeaningsCount > 1 && (
                <p className="text-sm text-slate-500">{t('meanings_count_badge', { count: totalMeaningsCount })}</p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-center gap-2 border-t border-slate-100 px-4 py-3 text-xs font-medium text-slate-500">
            <RotateCcw aria-hidden="true" className="size-3.5" />
            {t('front_hint')}
          </div>
        </div>

        {/* BACK */}
        <div
          inert={!isFlipped}
          aria-hidden={!isFlipped}
          className={`${styles.face} ${styles.back} flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm`}
        >
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-100 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
              <h3 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{wordText}</h3>
              <PronunciationButton size="sm" accent="US" ipa={ipaUs} active={playingAudioType === 'us'} title={t('listen_us')} onPlay={playUs} />
              <PronunciationButton size="sm" accent="UK" ipa={ipaUk} active={playingAudioType === 'uk'} title={t('listen_uk')} onPlay={playUk} />
            </div>
            <button
              type="button"
              onClick={toggleFlipCard}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-500 outline-none transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" />
              {t('flip_view_front')}
            </button>
          </div>

          <div
            ref={meaningsRef}
            role="region"
            aria-label={t('all_meanings_badge', { count: totalMeaningsCount })}
            tabIndex={isFlipped ? 0 : -1}
            className={`${styles.meanings} space-y-6 px-4 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:px-6`}
          >
            {parsedParts.map((partGroup, partIdx) => (
              <section key={partIdx} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${partGroup.info.bg} ${partGroup.info.color} ${partGroup.info.border}`}>
                    {partGroup.info.label}
                  </span>
                  <span className="text-xs text-slate-400">{partGroup.partOfSpeech}</span>
                  <span className="h-px flex-1 bg-slate-100" aria-hidden="true" />
                  <span className="text-xs text-slate-500">{t('meanings_count_sub', { count: partGroup.meanings.length })}</span>
                </div>

                <ol className="space-y-4">
                  {partGroup.meanings.map((meaningItem, mIdx) => (
                    <li key={mIdx} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3">
                      <span className="mt-0.5 flex size-6 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                        {mIdx + 1}
                      </span>
                      <div className="min-w-0 space-y-2">
                        <p className="text-base font-semibold leading-snug text-slate-900 sm:text-lg">
                          {meaningItem.translations.join(', ') || t('meaning_default')}
                        </p>
                        {meaningItem.definition && (
                          <p className="text-sm leading-relaxed text-slate-500">{meaningItem.definition}</p>
                        )}
                        {meaningItem.examples?.length > 0 && (
                          <ul className="space-y-2 border-l-2 border-blue-100 pl-3">
                            {meaningItem.examples.map((ex, exIdx) => (
                              <li key={exIdx} className="flex items-start gap-2">
                                <div className="min-w-0 flex-1 text-sm">
                                  <p className="font-medium leading-relaxed text-slate-800">{ex.en}</p>
                                  {ex.vi && <p className="leading-relaxed text-slate-500">{ex.vi}</p>}
                                </div>
                                {ex.en && (
                                  <button
                                    type="button"
                                    onClick={() => playAudio(undefined, 'en-US', ex.en)}
                                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-slate-400 outline-none transition-colors hover:bg-blue-50 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500"
                                    title={t('listen_example')}
                                    aria-label={t('listen_example')}
                                  >
                                    <Volume2 aria-hidden="true" className="size-3.5" />
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                        {(meaningItem.synonyms.length > 0 || meaningItem.antonyms.length > 0) && (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                            {meaningItem.synonyms.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-emerald-700">{t('synonyms')}</span>
                                {meaningItem.synonyms.map((syn, sIdx) => (
                                  <span key={sIdx} className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-800">
                                    {syn}
                                  </span>
                                ))}
                              </div>
                            )}
                            {meaningItem.antonyms.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-red-700">{t('antonyms')}</span>
                                {meaningItem.antonyms.map((ant, aIdx) => (
                                  <span key={aIdx} className="rounded-md bg-red-50 px-1.5 py-0.5 font-medium text-red-800">
                                    {ant}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
