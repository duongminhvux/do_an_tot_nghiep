'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { wordService } from '@/services/vocabulary.service';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Volume2, Loader2, BookOpen, Clock, AlertCircle } from 'lucide-react';

interface WordDetailDialogProps {
  wordId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WordDetailDialog({
  wordId,
  open,
  onOpenChange,
}: WordDetailDialogProps) {
  const { t } = useTranslation('vocabulary');

  const {
    data: response,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['word-detail', wordId],
    queryFn: () => wordService.getById(wordId!),
    enabled: !!wordId && open,
  });

  const word = response?.data;

  const playAudio = (url?: string) => {
    if (!url) return;
    try {
      const audio = new Audio(url);
      audio.play().catch((err) => console.warn('Could not play audio', err));
    } catch (e) {
      console.warn('Audio play error', e);
    }
  };

  const getLevelBadgeClass = (level?: string) => {
    switch (level?.toUpperCase()) {
      case 'A1':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'A2':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'B1':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'B2':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'C1':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'C2':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0 gap-0 rounded-2xl border border-slate-200/80 shadow-2xl bg-white">
        {/* HEADER */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-2xl font-black tracking-tight text-slate-900">
                  {word?.word || (isLoading ? t('loading_words') : t('word_detail_title'))}
                </DialogTitle>
                {word?.level && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getLevelBadgeClass(
                      word.level
                    )}`}
                  >
                    {word.level}
                  </span>
                )}
                {word && (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      word.isActive !== false
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        word.isActive !== false
                          ? 'bg-emerald-500'
                          : 'bg-slate-400'
                      }`}
                    />
                    {word.isActive !== false ? t('active') : t('inactive')}
                  </span>
                )}
              </div>
            </div>

            <DialogDescription className="text-xs text-slate-500">
              {t('word_detail_desc')}
            </DialogDescription>

            {/* Pronunciations */}
            {word && (word.ipa?.us || word.ipa?.uk) && (
              <div className="flex flex-wrap items-center gap-4 pt-1">
                {word.ipa?.us && (
                  <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => playAudio(word.audio?.us)}
                      disabled={!word.audio?.us}
                      className="text-blue-600 hover:text-blue-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title={t('play_us')}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <span className="font-mono font-medium">{word.ipa.us}</span>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase">
                      US
                    </span>
                  </div>
                )}

                {word.ipa?.uk && (
                  <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => playAudio(word.audio?.uk)}
                      disabled={!word.audio?.uk}
                      className="text-blue-600 hover:text-blue-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title={t('play_uk')}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <span className="font-mono font-medium">{word.ipa.uk}</span>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase">
                      UK
                    </span>
                  </div>
                )}
              </div>
            )}
          </DialogHeader>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm font-medium">{t('loading_details')}</p>
            </div>
          ) : isError || !word ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-rose-500">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm font-medium">{t('failed_details')}</p>
            </div>
          ) : (
            <>
              {/* Image & Extra info banner (if exists) */}
              {(word.image || (word.variations && word.variations.length > 0) || (word.relatedWords && word.relatedWords.length > 0)) && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  {word.image && (
                    <img
                      src={word.image}
                      alt={word.word}
                      className="w-20 h-20 object-cover rounded-lg border border-slate-200 shadow-xs"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div className="space-y-2 flex-1">
                    {word.variations && word.variations.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-slate-500 font-medium">{t('variations')}</span>
                        {word.variations.map((v, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono text-slate-700"
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                    )}
                    {word.relatedWords && word.relatedWords.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-slate-500 font-medium">{t('related_words')}</span>
                        {word.relatedWords.map((rw, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-blue-700"
                          >
                            {rw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PARTS OF SPEECH & MEANINGS */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>
                    {t('meanings_and_parts')} ({word.parts?.length || 0})
                  </span>
                </div>

                {(!word.parts || word.parts.length === 0) ? (
                  <p className="text-sm text-slate-400 italic">{t('no_definitions')}</p>
                ) : (
                  <div className="space-y-5">
                    {word.parts.map((part, pIdx) => (
                      <div
                        key={pIdx}
                        className="rounded-xl border border-slate-200/90 overflow-hidden bg-white shadow-2xs"
                      >
                        {/* Part Header */}
                        <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100/80">
                            {part.partOfSpeech}
                          </span>
                          <span className="text-xs text-slate-400">
                            {part.meanings?.length || 0}{' '}
                            {(part.meanings?.length || 0) <= 1
                              ? t('meaning_count', { count: part.meanings?.length || 0 })
                              : t('meaning_count_plural', { count: part.meanings?.length || 0 })}
                          </span>
                        </div>

                        {/* Meanings List */}
                        <div className="divide-y divide-slate-100 p-4 space-y-4">
                          {(part.meanings || []).map((meaning, mIdx) => (
                            <div key={mIdx} className="space-y-2.5 pt-3 first:pt-0">
                              {/* Definition */}
                              <div className="flex items-start gap-2">
                                <span className="inline-block w-5 h-5 text-center leading-5 text-xs font-bold text-slate-400 bg-slate-100 rounded-full shrink-0">
                                  {mIdx + 1}
                                </span>
                                <div className="space-y-1 flex-1">
                                  <p className="text-sm font-medium text-slate-900 leading-relaxed">
                                    {meaning.definition || <span className="text-slate-400 italic">{t('no_en_def')}</span>}
                                  </p>

                                  {/* Translations */}
                                  {meaning.translation && meaning.translation.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                      <span className="text-xs text-slate-400 font-medium">{t('vn_translation')}</span>
                                      {meaning.translation.map((tr, tIdx) => (
                                        <span
                                          key={tIdx}
                                          className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200/70 px-2 py-0.5 rounded font-medium"
                                        >
                                          {tr}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Synonyms & Antonyms */}
                              {((meaning.synonyms && meaning.synonyms.length > 0) || (meaning.antonyms && meaning.antonyms.length > 0)) && (
                                <div className="ml-7 flex flex-wrap gap-3 text-xs pt-1">
                                  {meaning.synonyms && meaning.synonyms.length > 0 && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-slate-400">{t('synonyms')}</span>
                                      <span className="text-slate-600 font-medium">{meaning.synonyms.join(', ')}</span>
                                    </div>
                                  )}
                                  {meaning.antonyms && meaning.antonyms.length > 0 && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-slate-400">{t('antonyms')}</span>
                                      <span className="text-rose-600 font-medium">{meaning.antonyms.join(', ')}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Examples */}
                              {meaning.examples && meaning.examples.length > 0 && (
                                <div className="ml-7 mt-2 space-y-1.5 bg-slate-50/70 p-3 rounded-lg border border-slate-100 text-xs">
                                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                    {t('examples')}
                                  </div>
                                  {meaning.examples.map((ex, exIdx) => (
                                    <div key={exIdx} className="space-y-0.5 border-l-2 border-blue-400 pl-2.5 py-0.5">
                                      <p className="text-slate-800 italic">“{ex.en}”</p>
                                      {ex.vi && <p className="text-slate-500">{ex.vi}</p>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* TIMESTAMPS FOOTER */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {t('created_at')} {word.createdAt ? new Date(word.createdAt).toLocaleString() : '—'}
                  </span>
                </div>
                {word.updatedAt && (
                  <div>
                    {t('updated_at')} {new Date(word.updatedAt).toLocaleString()}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
