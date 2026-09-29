'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCheck } from 'lucide-react';

import { learningService } from '@/services/learning.service';
import { savedWordsService } from '@/services/saved-words.service';
import { SrsRatingType } from '@/types/learning';
import {
  WordDetail,
  WordPartDetail,
  WordMeaningDetail,
} from '@/types/vocabulary';

import {
  StudyMode,
  getPartOfSpeechInfo,
  triggerConfetti,
  playSuccessSound,
  playComboSound,
  playFlipSound,
  playErrorSound,
  playVictoryFanfare,
} from '../collection/[slug]/lesson/[lessonSlug]/components/study-sound';
import { FlashcardView } from '../collection/[slug]/lesson/[lessonSlug]/components/FlashcardView';
import { GuessModeView } from '../collection/[slug]/lesson/[lessonSlug]/components/GuessModeView';
import { RepeatModeView } from '../collection/[slug]/lesson/[lessonSlug]/components/RepeatModeView';
import { LessonCompletionView } from '../collection/[slug]/lesson/[lessonSlug]/components/LessonCompletionView';
import { StudySettingsModal } from '../collection/[slug]/lesson/[lessonSlug]/components/StudySettingsModal';
import { StudyShortcutsModal } from '../collection/[slug]/lesson/[lessonSlug]/components/StudyShortcutsModal';
import { SrsRatingBar, SrsLevel } from '../collection/[slug]/lesson/[lessonSlug]/components/SrsRatingBar';
import { ReviewHeader } from './components/ReviewHeader';

export default function SrsReviewPage() {
  const { t, i18n } = useTranslation('vocabulary');
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const locale = (params?.locale as string) || 'vi';

  useEffect(() => {
    if (locale && i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale, i18n]);

  // 1. Fetch due reviews from Backend
  const { data: dueRes, isLoading: isDueLoading, refetch } = useQuery({
    queryKey: ['due-reviews'],
    queryFn: () => learningService.getDueReviews(50),
  });

  // 2. Fetch saved words IDs for bookmark status
  const { data: savedIdsRes } = useQuery({
    queryKey: ['saved-words-ids'],
    queryFn: () => savedWordsService.getSavedIds(),
  });

  const wordsList: WordDetail[] = useMemo(() => {
    const raw = (dueRes as any)?.data || dueRes || [];
    const list = Array.isArray(raw) ? raw : [];
    return list
      .map((item: any) => (typeof item.wordId === 'object' ? item.wordId : null))
      .filter((w): w is WordDetail => !!w && !!w._id);
  }, [dueRes]);

  // Saved Words State
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  useEffect(() => {
    const rawIds = (savedIdsRes as any)?.data || savedIdsRes;
    if (Array.isArray(rawIds)) {
      setSavedWords(new Set(rawIds));
    }
  }, [savedIdsRes]);

  // Study Mode & Cards Navigation
  const [mode, setMode] = useState<StudyMode>('flashcard');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Gamification & Progress State
  const [streak, setStreak] = useState(0);
  const [highestStreak, setHighestStreak] = useState(0);
  const [masteredWords, setMasteredWords] = useState<Set<string>>(new Set());
  const [needReviewWords, setNeedReviewWords] = useState<Set<string>>(new Set());

  // Input & Guessing State
  const [userGuess, setUserGuess] = useState('');
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isDontKnow, setIsDontKnow] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Audio & Modals
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playingAudioType, setPlayingAudioType] = useState<'us' | 'uk' | 'example' | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);

  // Mutation to record review rating
  const recordMutation = useMutation({
    mutationFn: ({ wordId, rating }: { wordId: string; rating: SrsRatingType }) =>
      learningService.recordReview(wordId, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['due-reviews-check'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-study-stats'] });
    },
  });

  const currentWord = wordsList[currentIndex] || null;

  // Meanings & Part of Speech Parsers
  const parsedParts = useMemo(() => {
    if (!currentWord) return [];

    if (Array.isArray(currentWord.parts) && currentWord.parts.length > 0) {
      return currentWord.parts.map((p: WordPartDetail) => {
        const info = getPartOfSpeechInfo(p.partOfSpeech, t);
        const meanings = (p.meanings || []).map((m: WordMeaningDetail) => {
          const translations = Array.isArray(m.translation)
            ? m.translation.filter(Boolean)
            : m.translation
              ? [m.translation]
              : [];
          return {
            definition: m.definition || '',
            translations,
            synonyms: Array.isArray(m.synonyms) ? m.synonyms.filter(Boolean) : [],
            antonyms: Array.isArray(m.antonyms) ? m.antonyms.filter(Boolean) : [],
            examples: Array.isArray(m.examples)
              ? m.examples.filter((ex) => ex && (ex.en || ex.vi))
              : [],
          };
        });
        return {
          partOfSpeech: p.partOfSpeech || 'Word',
          info,
          meanings,
        };
      });
    }

    const legacyPOS = currentWord.partOfSpeech || 'Vocabulary';
    const info = getPartOfSpeechInfo(legacyPOS, t);
    const legacyMeaning = currentWord.meaning || '';
    const legacyEx = currentWord.example
      ? [{ en: currentWord.example, vi: '' }]
      : [];

    return [
      {
        partOfSpeech: legacyPOS,
        info,
        meanings: [
          {
            definition: '',
            translations: legacyMeaning ? [legacyMeaning] : [],
            synonyms: [],
            antonyms: [],
            examples: legacyEx,
          },
        ],
      },
    ];
  }, [currentWord, t]);

  const wordText = currentWord?.word || '';
  const wordLevel = currentWord?.level || '';

  // Flattened translations
  const allTranslationsList = useMemo(() => {
    const list: string[] = [];
    parsedParts.forEach((p) => {
      p.meanings.forEach((m) => {
        m.translations.forEach((trans) => {
          if (trans && !list.includes(trans)) list.push(trans);
        });
      });
    });
    return list.length > 0 ? list : [currentWord?.meaning || wordText];
  }, [parsedParts, currentWord?.meaning, wordText]);

  const totalMeaningsCount = useMemo(() => {
    return parsedParts.reduce((acc, p) => acc + (p.meanings?.length || 0), 0);
  }, [parsedParts]);

  const primaryVietnameseWord = allTranslationsList[0] || currentWord?.meaning || wordText;
  const primaryEnDefinition = parsedParts[0]?.meanings[0]?.definition || '';
  const primaryExampleEn = parsedParts[0]?.meanings[0]?.examples[0]?.en || currentWord?.example || '';
  const primaryExampleVi = parsedParts[0]?.meanings[0]?.examples[0]?.vi || '';

  const illustration = currentWord?.image || currentWord?.imageUrl || '';
  const audioUs = currentWord?.audio?.us || '';
  const audioUk = currentWord?.audio?.uk || '';
  const defaultAudioUrl = audioUs || audioUk || currentWord?.audioUrl || '';
  const ipaUs = currentWord?.ipa?.us || (currentWord?.phonetic ? currentWord.phonetic : '');
  const ipaUk = currentWord?.ipa?.uk || '';

  // Mask English word in example for Guess mode
  const maskedExampleEn = useMemo(() => {
    if (!primaryExampleEn || !wordText) return primaryExampleEn;
    const escaped = wordText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    return primaryExampleEn.replace(regex, '______');
  }, [primaryExampleEn, wordText]);

  // Hints sequence
  const hintIndicesSequence = useMemo(() => {
    if (!wordText) return [];
    const len = wordText.length;
    if (len <= 0) return [];

    const maxAllowed = Math.max(1, Math.floor(len * 0.4));
    const order: number[] = [];

    const pushIfValid = (idx: number) => {
      if (idx >= 0 && idx < len && !order.includes(idx)) {
        const char = wordText[idx];
        if (char !== ' ' && char !== '-') {
          order.push(idx);
        }
      }
    };

    pushIfValid(0);
    if (len > 1) pushIfValid(len - 1);
    if (len > 2) pushIfValid(Math.floor(len / 2));
    if (len > 4) pushIfValid(Math.floor(len / 4));
    if (len > 5) pushIfValid(Math.floor((len * 3) / 4));

    for (let i = 1; i < len - 1; i++) {
      if (order.length >= maxAllowed) break;
      pushIfValid(i);
    }

    return order.slice(0, maxAllowed);
  }, [wordText]);

  const maxHints = hintIndicesSequence.length;

  const maskedHint = useMemo(() => {
    if (!wordText) return '';
    const revealedIndices = new Set(hintIndicesSequence.slice(0, hintsRevealed));
    return wordText
      .split('')
      .map((char, index) => {
        if (char === ' ' || char === '-') return char;
        if (revealedIndices.has(index)) return char;
        return '•';
      })
      .join(' ');
  }, [wordText, hintIndicesSequence, hintsRevealed]);

  // Audio Playback
  const playAudio = useCallback(
    (customUrl?: string, langCode: string = 'en-US', textToSpeak?: string, playbackRate: number = 1, audioType?: 'us' | 'uk') => {
      const targetText = textToSpeak || wordText;
      const targetUrl = customUrl || defaultAudioUrl;
      const resolvedType: 'us' | 'uk' | 'example' =
        audioType || (textToSpeak ? 'example' : langCode === 'en-GB' ? 'uk' : 'us');

      setIsPlayingAudio(true);
      setPlayingAudioType(resolvedType);

      const resetPlaying = () => {
        setIsPlayingAudio(false);
        setPlayingAudioType(null);
      };

      if (targetUrl && !textToSpeak) {
        try {
          const audio = new Audio(targetUrl);
          audio.playbackRate = playbackRate;
          audio.onended = () => resetPlaying();
          audio.onerror = () => {
            if ('speechSynthesis' in window && targetText) {
              window.speechSynthesis.cancel();
              const utterance = new SpeechSynthesisUtterance(targetText);
              utterance.lang = langCode;
              utterance.rate = playbackRate === 1 ? 0.9 : 0.65;
              utterance.onend = () => resetPlaying();
              utterance.onerror = () => resetPlaying();
              window.speechSynthesis.speak(utterance);
            } else {
              resetPlaying();
            }
          };
          audio.play().catch(() => resetPlaying());
          return;
        } catch {
          // fallback
        }
      }

      if ('speechSynthesis' in window && targetText) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(targetText);
        utterance.lang = langCode;
        utterance.rate = playbackRate === 1 ? 0.9 : 0.65;
        utterance.onend = () => resetPlaying();
        utterance.onerror = () => resetPlaying();
        window.speechSynthesis.speak(utterance);
      } else {
        resetPlaying();
      }
    },
    [defaultAudioUrl, wordText]
  );

  // Flip Flashcard action
  const toggleFlipCard = () => {
    setIsFlipped((prev) => {
      const next = !prev;
      if (soundEnabled) playFlipSound();
      return next;
    });
  };

  // Reset per word change
  useEffect(() => {
    setUserGuess('');
    setIsAnswerChecked(false);
    setIsCorrect(false);
    setIsDontKnow(false);
    setHintsRevealed(0);
    setIsFlipped(false);

    if (inputRef.current && (mode === 'guess' || mode === 'repeat')) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, [currentIndex, mode]);

  // Auto-play audio
  useEffect(() => {
    if (autoPlayAudio && currentWord && mode !== 'guess') {
      const timer = setTimeout(() => {
        playAudio();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, autoPlayAudio, currentWord, playAudio, mode]);

  // Handle submit guess
  const handleCheckGuess = () => {
    if (!userGuess.trim() || !wordText) return;
    const normalizedInput = userGuess.trim().toLowerCase();
    const normalizedTarget = wordText.trim().toLowerCase();

    if (normalizedInput === normalizedTarget) {
      setIsCorrect(true);
      setIsAnswerChecked(true);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > highestStreak) setHighestStreak(newStreak);

      setMasteredWords((prev) => new Set(prev).add(currentWord!._id));
      setNeedReviewWords((prev) => {
        const next = new Set(prev);
        next.delete(currentWord!._id);
        return next;
      });

      if (soundEnabled) {
        if (newStreak >= 3 && newStreak % 3 === 0) {
          playComboSound();
          triggerConfetti(0.5, 0.4);
        } else {
          playSuccessSound();
        }
      }
      playAudio();
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setStreak(0);
      if (soundEnabled) playErrorSound();
    }
  };

  const handleGiveHint = () => {
    if (hintsRevealed < maxHints) {
      setHintsRevealed((prev) => prev + 1);
      if (soundEnabled) playFlipSound();
    } else {
      playAudio();
    }
  };

  const handleDontKnow = () => {
    if (!currentWord) return;
    setIsDontKnow(true);
    setIsAnswerChecked(true);
    setIsCorrect(false);
    setStreak(0);
    setNeedReviewWords((prev) => new Set(prev).add(currentWord._id));
    playAudio();
  };

  // Next Word
  const handleNextWord = () => {
    if (currentIndex < wordsList.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCompleted(true);
      queryClient.invalidateQueries({ queryKey: ['due-reviews'] });
      if (soundEnabled) playVictoryFanfare();
      triggerConfetti(0.5, 0.3);
      setTimeout(() => triggerConfetti(0.3, 0.5), 300);
      setTimeout(() => triggerConfetti(0.7, 0.5), 600);
    }
  };

  // Previous Word
  const handlePrevWord = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // SRS Rating actions (Học lại, Khó, Tốt, Dễ)
  const handleSrsRating = (level: SrsLevel) => {
    if (!currentWord) return;

    const ratingEnum = level.toUpperCase() as SrsRatingType;
    recordMutation.mutate({ wordId: currentWord._id, rating: ratingEnum });

    switch (level) {
      case 'again':
        setNeedReviewWords((prev) => new Set(prev).add(currentWord._id));
        setMasteredWords((prev) => {
          const next = new Set(prev);
          next.delete(currentWord._id);
          return next;
        });
        setStreak(0);
        if (soundEnabled) playErrorSound();
        break;

      case 'hard':
        setNeedReviewWords((prev) => new Set(prev).add(currentWord._id));
        if (soundEnabled) playFlipSound();
        break;

      case 'good':
        setMasteredWords((prev) => new Set(prev).add(currentWord._id));
        setNeedReviewWords((prev) => {
          const next = new Set(prev);
          next.delete(currentWord._id);
          return next;
        });
        setStreak((prev) => {
          const next = prev + 1;
          if (next > highestStreak) setHighestStreak(next);
          return next;
        });
        if (soundEnabled) playSuccessSound();
        break;

      case 'easy':
        setMasteredWords((prev) => new Set(prev).add(currentWord._id));
        setNeedReviewWords((prev) => {
          const next = new Set(prev);
          next.delete(currentWord._id);
          return next;
        });
        setStreak((prev) => {
          const next = prev + 1;
          if (next > highestStreak) setHighestStreak(next);
          return next;
        });
        if (soundEnabled) {
          playComboSound();
          triggerConfetti(0.5, 0.4);
        }
        break;
    }

    handleNextWord();
  };

  // Toggle Save / Bookmark
  const handleToggleSave = async () => {
    if (!currentWord) return;
    const wordId = currentWord._id;
    try {
      const res = await savedWordsService.toggle(wordId);
      const isNowSaved = (res as any)?.data?.saved ?? false;
      setSavedWords((prev) => {
        const next = new Set(prev);
        if (isNowSaved) {
          next.add(wordId);
        } else {
          next.delete(wordId);
        }
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['saved-words-ids'] });
      if (soundEnabled) playFlipSound();
    } catch {
      // optimistic toggle fallback
      setSavedWords((prev) => {
        const next = new Set(prev);
        if (next.has(wordId)) next.delete(wordId);
        else next.add(wordId);
        return next;
      });
    }
  };

  // Toggle Mastered
  const handleToggleMastered = () => {
    if (!currentWord) return;
    const isMastered = masteredWords.has(currentWord._id);
    if (isMastered) {
      setMasteredWords((prev) => {
        const next = new Set(prev);
        next.delete(currentWord._id);
        return next;
      });
    } else {
      setMasteredWords((prev) => new Set(prev).add(currentWord._id));
      setNeedReviewWords((prev) => {
        const next = new Set(prev);
        next.delete(currentWord._id);
        return next;
      });
      if (soundEnabled) playSuccessSound();
    }
  };

  // Condition to display SRS Rating Bar
  const showSrsBar =
    (mode === 'flashcard' && isFlipped) ||
    ((mode === 'guess' || mode === 'repeat') && (isCorrect || isDontKnow));

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) {
        if (e.key === 'Enter') {
          if (isCorrect || isDontKnow) {
            handleSrsRating(isCorrect ? 'good' : 'again');
          } else {
            handleCheckGuess();
          }
        }
        return;
      }

      // If SRS Rating Bar is currently visible, allow 1, 2, 3, 4, M, S keys
      if (showSrsBar) {
        if (e.key === '1') {
          handleSrsRating('again');
          return;
        } else if (e.key === '2') {
          handleSrsRating('hard');
          return;
        } else if (e.key === '3') {
          handleSrsRating('good');
          return;
        } else if (e.key === '4') {
          handleSrsRating('easy');
          return;
        } else if (e.key === 'm' || e.key === 'M') {
          handleToggleMastered();
          return;
        } else if (e.key === 's' || e.key === 'S' || e.key === 'b' || e.key === 'B') {
          handleToggleSave();
          return;
        }
      }

      if (e.key === 'ArrowRight') {
        handleNextWord();
      } else if (e.key === 'ArrowLeft') {
        handlePrevWord();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (mode === 'flashcard') {
          toggleFlipCard();
        } else if (mode === 'repeat') {
          playAudio();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showSrsBar,
    isCorrect,
    isDontKnow,
    mode,
    isFlipped,
    currentWord,
    soundEnabled,
    highestStreak,
  ]);

  const totalWords = wordsList.length;
  const progressPercent = totalWords > 0 ? Math.round(((currentIndex) / totalWords) * 100) : 0;

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 transition-all ${showSrsBar ? 'pb-24 sm:pb-28' : 'pb-8'}`}>
      {/* 3D Flip Styles */}
      <style jsx global>{`
        .flashcard-3d-wrapper {
          perspective: 1400px;
          width: 100%;
          height: auto;
          min-height: 440px;
        }
        @media (min-width: 640px) {
          .flashcard-3d-wrapper {
            min-height: 470px;
          }
        }
        .flashcard-3d-inner {
          position: relative;
          width: 100%;
          min-height: 440px;
          transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          transform-style: preserve-3d;
        }
        @media (min-width: 640px) {
          .flashcard-3d-inner {
            min-height: 470px;
          }
        }
        .flashcard-3d-inner.is-flipped {
          transform: rotateY(180deg);
        }
        .flashcard-face {
          width: 100%;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .flashcard-front {
          transform: rotateY(0deg);
        }
        .flashcard-back {
          transform: rotateY(180deg);
        }
      `}</style>

      {/* 1. Header with Mode switchers & controls */}
      <ReviewHeader
        locale={locale}
        mode={mode}
        setMode={setMode}
        streak={streak}
        dueCount={wordsList.length}
        setShowShortcuts={setShowShortcuts}
        setShowSettings={setShowSettings}
        t={t}
      />

      {/* 2. Main Content Area (Focused centered workspace without topic sidebar) */}
      <div className="max-w-4xl mx-auto p-3 sm:p-4 lg:p-6 space-y-4">
        {/* Top Progress Bar & HUD */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl py-2 px-3.5 border border-slate-200/80 flex items-center justify-between gap-4 shadow-2xs">
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-700 font-bold">
                {t('lesson_progress', { percent: Math.round(progressPercent) })}
              </span>
              <span className="text-blue-600 font-bold">
                {t('cards_counter', {
                  current: Math.min(currentIndex + (completed ? 1 : 0), totalWords),
                  total: totalWords,
                })}
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden p-0.5 border border-slate-200/50">
              <div
                className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-300 shadow-xs"
                style={{ width: `${completed ? 100 : progressPercent}%` }}
              />
            </div>
          </div>

          {/* Shortcut Prompt */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-slate-400 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/70">
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px] text-slate-700 font-bold shadow-2xs">
              {mode === 'guess' ? 'Enter' : 'Space'}
            </kbd>
            <span>
              {mode === 'flashcard'
                ? t('space_prompt_flip')
                : mode === 'repeat'
                ? t('space_prompt_audio')
                : t('shortcut_check')}
            </span>
          </div>
        </div>

        {/* Study Card Area */}
        {isDueLoading ? (
          <div className="w-full h-[440px] sm:h-[470px] bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-600">{t('loading_cards')}</p>
          </div>
        ) : wordsList.length === 0 ? (
          /* Empty Due Reviews State */
          <div className="w-full h-[440px] sm:h-[470px] bg-white rounded-2xl border border-emerald-200 shadow-sm flex flex-col items-center justify-center text-center p-6 sm:p-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-xs">
              <CheckCheck className="w-8 h-8" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="text-lg font-bold text-slate-900">
                {t('review.no_due_title')}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {t('review.no_due_desc')}
              </p>
            </div>
            <div className="pt-2">
              <Link
                href={`/${locale}/vocabulary`}
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all shadow-sm"
              >
                {t('review.back_to_catalog')}
              </Link>
            </div>
          </div>
        ) : completed ? (
          /* Completion Victory View */
          <LessonCompletionView
            totalWords={totalWords}
            highestStreak={highestStreak}
            masteredWordsCount={masteredWords.size}
            unmasteredWordsCount={needReviewWords.size}
            wordsList={wordsList}
            lessonTitle={t('review.page_title')}
            sectionName={null}
            slug=""
            locale={locale}
            onReplay={(onlyUnmastered?: boolean) => {
              setCurrentIndex(0);
              setCompleted(false);
              setStreak(0);
              refetch();
            }}
            playAudio={playAudio}
            t={t}
          />
        ) : (
          <div className="w-full space-y-4">
            {/* MODE 1: FLASHCARD 3D */}
            {mode === 'flashcard' && (
              <FlashcardView
                isFlipped={isFlipped}
                toggleFlipCard={toggleFlipCard}
                currentIndex={currentIndex}
                totalWords={totalWords}
                wordLevel={wordLevel}
                illustration={illustration}
                wordText={wordText}
                ipaUs={ipaUs}
                ipaUk={ipaUk}
                audioUs={audioUs}
                audioUk={audioUk}
                defaultAudioUrl={defaultAudioUrl}
                isPlayingAudio={isPlayingAudio}
                playingAudioType={playingAudioType}
                playAudio={playAudio}
                parsedParts={parsedParts}
                totalMeaningsCount={totalMeaningsCount}
                t={t}
              />
            )}

            {/* MODES 2 & 3: GUESS / REPEAT */}
            {mode !== 'flashcard' && (
              <div className="w-full min-h-[440px] sm:min-h-[470px] bg-white rounded-2xl border border-slate-200 shadow-md p-4 sm:p-6 flex flex-col justify-center items-center">
                {mode === 'guess' && (
                  <GuessModeView
                    illustration={illustration}
                    primaryVietnameseWord={primaryVietnameseWord}
                    posInfo={parsedParts[0]?.info}
                    primaryEnDefinition={primaryEnDefinition}
                    primaryExampleEn={primaryExampleEn}
                    primaryExampleVi={primaryExampleVi}
                    maskedExampleEn={maskedExampleEn}
                    maskedHint={maskedHint}
                    hintsRevealed={hintsRevealed}
                    maxHints={maxHints}
                    handleGiveHint={handleGiveHint}
                    isPlayingAudio={isPlayingAudio}
                    userGuess={userGuess}
                    setUserGuess={setUserGuess}
                    inputRef={inputRef}
                    isCorrect={isCorrect}
                    isDontKnow={isDontKnow}
                    isAnswerChecked={isAnswerChecked}
                    shake={shake}
                    handleCheckGuess={handleCheckGuess}
                    handleDontKnow={handleDontKnow}
                    handleNextWord={handleNextWord}
                    wordText={wordText}
                    ipaUs={ipaUs}
                    ipaUk={ipaUk}
                    t={t}
                  />
                )}

                {mode === 'repeat' && (
                  <RepeatModeView
                    posInfo={parsedParts[0]?.info}
                    playAudio={playAudio}
                    audioUs={audioUs}
                    audioUk={audioUk}
                    defaultAudioUrl={defaultAudioUrl}
                    isPlayingAudio={isPlayingAudio}
                    hintsRevealed={hintsRevealed}
                    maxHints={maxHints}
                    maskedHint={maskedHint}
                    handleGiveHint={handleGiveHint}
                    userGuess={userGuess}
                    setUserGuess={setUserGuess}
                    inputRef={inputRef}
                    isCorrect={isCorrect}
                    isDontKnow={isDontKnow}
                    isAnswerChecked={isAnswerChecked}
                    shake={shake}
                    handleCheckGuess={handleCheckGuess}
                    handleDontKnow={handleDontKnow}
                    handleNextWord={handleNextWord}
                    wordText={wordText}
                    ipaUs={ipaUs}
                    ipaUk={ipaUk}
                    primaryVietnameseWord={primaryVietnameseWord}
                    t={t}
                  />
                )}
              </div>
            )}

            {/* SRS Rating Toolbar - shown when card is flipped (flashcard) or answered (guess/repeat) */}
            {showSrsBar && (
              <SrsRatingBar
                onRating={handleSrsRating}
                isMastered={masteredWords.has(currentWord?._id || '')}
                onToggleMastered={handleToggleMastered}
                isSaved={savedWords.has(currentWord?._id || '')}
                onToggleSave={handleToggleSave}
                t={t}
              />
            )}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <StudySettingsModal
        show={showSettings}
        onClose={() => setShowSettings(false)}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        autoPlayAudio={autoPlayAudio}
        setAutoPlayAudio={setAutoPlayAudio}
        t={t}
      />

      {/* Keyboard Shortcuts Modal */}
      <StudyShortcutsModal
        show={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        t={t}
      />
    </div>
  );
}
