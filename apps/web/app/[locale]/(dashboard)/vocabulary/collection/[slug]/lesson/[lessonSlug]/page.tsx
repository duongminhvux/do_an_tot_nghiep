'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  collectionService,
  lessonService,
} from '@/services/vocabulary.service';
import { learningService } from '@/services/learning.service';
import { savedWordsService } from '@/services/saved-words.service';
import { StudyModeType, SrsRatingType } from '@/types/learning';
import {
  CollectionItem,
  LessonItem,
  LessonWordItem,
  SectionItem,
  WordDetail,
  WordPartDetail,
  WordMeaningDetail,
} from '@/types/vocabulary';
import { BookOpen, CheckCheck, RotateCcw } from 'lucide-react';

import {
  StudyMode,
  getPartOfSpeechInfo,
  triggerConfetti,
  playSuccessSound,
  playComboSound,
  playFlipSound,
  playErrorSound,
  playVictoryFanfare,
} from './components/study-sound';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState, PageShell, surface, tones } from '@/components/ui/page';
import { cn } from '@/lib/utils';
import { StudyHeader } from './components/StudyHeader';
import { TopicSidebar } from './components/TopicSidebar';
import { FlashcardView } from './components/FlashcardView';
import { GuessModeView } from './components/GuessModeView';
import { RepeatModeView } from './components/RepeatModeView';
import { LessonCompletionView } from './components/LessonCompletionView';
import { StudySettingsModal } from './components/StudySettingsModal';
import { StudyShortcutsModal } from './components/StudyShortcutsModal';
import { SrsRatingBar, SrsLevel } from './components/SrsRatingBar';

export default function LessonStudyPage() {
  const { t, i18n } = useTranslation('vocabulary');
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'vi';
  const slug = (params?.slug as string) || '';
  const lessonSlug = (params?.lessonSlug as string) || '';

  useEffect(() => {
    if (locale && i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale, i18n]);

  // 1. Fetch Collection Detail
  const { data: colRes, isLoading: isCollectionLoading } = useQuery({
    queryKey: ['collection-detail', slug],
    queryFn: () => collectionService.getBySlug(slug),
    enabled: !!slug,
  });
  const collection: CollectionItem | null = useMemo(() => {
      return (colRes as any)?.data || colRes || null;
  }, [colRes]);

  // 2. Fetch all lessons in this collection
  const collectionId = collection?._id;
  const { data: lessonsRes, isLoading: isLessonsLoading } = useQuery({
    queryKey: ['lessons', collectionId],
    queryFn: () => lessonService.getAll(collectionId),
    enabled: !!collectionId,
  });

  const lessons: LessonItem[] = useMemo(() => {
    const raw = (lessonsRes as any)?.data || lessonsRes;
    return Array.isArray(raw) ? raw : [];
  }, [lessonsRes]);

  // 3. Find Current Lesson
  const currentLesson: LessonItem | null = useMemo(() => {
    if (!lessons.length) return null;
    return (
      lessons.find((l) => l.slug === lessonSlug || l._id === lessonSlug) ||
      null
    );
  }, [lessons, lessonSlug]);

  const currentLessonId = currentLesson?._id;

  // 4. Fetch Sections for current lesson
  const { data: sectionsRes } = useQuery({
    queryKey: ['lesson-sections', currentLessonId],
    queryFn: () => lessonService.getSections(currentLessonId!),
    enabled: !!currentLessonId,
  });

  const sections: SectionItem[] = useMemo(() => {
    const raw = (sectionsRes as any)?.data || sectionsRes;
    return Array.isArray(raw) ? raw : [];
  }, [sectionsRes]);

  // 5. Fetch Words for current lesson
  const { data: wordsRes, isLoading: isWordsLoading } = useQuery({
    queryKey: ['lesson-words', currentLessonId],
    queryFn: () => lessonService.getWords(currentLessonId!),
    enabled: !!currentLessonId,
  });

  const rawWords: LessonWordItem[] = useMemo(() => {
    const raw = (wordsRes as any)?.data || wordsRes;
    return Array.isArray(raw) ? raw : [];
  }, [wordsRes]);

  // 6. Fetch Lesson Progress
  const { data: progressRes, refetch: refetchProgress, isLoading: isProgressLoading } = useQuery({
    queryKey: ['lesson-progress', currentLessonId],
    queryFn: () => learningService.getLessonProgress(currentLessonId!),
    enabled: !!currentLessonId,
  });

  const { data: savedIdsRes } = useQuery({
    queryKey: ['saved-word-ids'],
    queryFn: () => savedWordsService.getSavedIds(),
  });

  const lessonProgress = useMemo(() => {
    return (progressRes as any)?.data || progressRes || null;
  }, [progressRes]);

  // Session & Tracking Refs (Lazy Initialization)
  const sessionStartedAtRef = useRef<Date | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const ratingLock = useRef(false);
  const [ratingSaving, setRatingSaving] = useState(false);
  const [ratingError, setRatingError] = useState(false);

  const markInteraction = useCallback(() => {
    if (!sessionStartedAtRef.current) {
      sessionStartedAtRef.current = new Date();
    }
  }, []);

  // Gamification & Progress State
  const [streak, setStreak] = useState(0);
  const [highestStreak, setHighestStreak] = useState(0);
  const [masteredWords, setMasteredWords] = useState<Set<string>>(new Set());
  const [needReviewWords, setNeedReviewWords] = useState<Set<string>>(new Set());
  const [learnedWords, setLearnedWords] = useState<Set<string>>(new Set());
  const [reviewAll, setReviewAll] = useState<boolean>(false);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playingAudioType, setPlayingAudioType] = useState<'us' | 'uk' | 'example' | null>(null);

  // Sync previously learned words, mastered words & need-review words from progress
  useEffect(() => {
    if (lessonProgress?.learnedWordIds) {
      setLearnedWords(new Set(lessonProgress.learnedWordIds));
    }
    if (lessonProgress?.masteredWordIds) {
      setMasteredWords(new Set(lessonProgress.masteredWordIds));
    }
    if (lessonProgress?.needReviewWordIds) {
      setNeedReviewWords(new Set(lessonProgress.needReviewWordIds));
    }
  }, [lessonProgress]);

  useEffect(() => {
    if (Array.isArray(savedIdsRes?.data)) {
      setSavedWords(new Set(savedIdsRes.data));
    }
  }, [savedIdsRes]);

  // Clean up session refs on lesson change or unmount
  useEffect(() => {
    sessionStartedAtRef.current = null;
    sessionIdRef.current = null;

    return () => {
      if (sessionIdRef.current) {
        learningService.completeSession(sessionIdRef.current).catch(() => {});
      }
    };
  }, [currentLessonId]);

  // Active section filter state
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  // Auto-select first section when sections are loaded
  useEffect(() => {
    if (sections.length > 0 && sections[0]?._id) {
      if (!selectedSectionId || !sections.some((s) => s._id === selectedSectionId)) {
        setSelectedSectionId(sections[0]._id);
      }
    } else {
      setSelectedSectionId('');
    }
  }, [sections, selectedSectionId]);

  // All word items in active section
  const allSectionWords: WordDetail[] = useMemo(() => {
    let items = rawWords;
    if (selectedSectionId && selectedSectionId !== 'all') {
      items = items.filter((item) => {
        const secId =
          typeof item.sectionId === 'object' && item.sectionId !== null
            ? item.sectionId._id
            : item.sectionId;
        return secId?.toString() === selectedSectionId;
      });
    }
    return items
      .map((item) => {
        if (!item) return null;
        if (typeof item.wordId === 'object' && item.wordId !== null) {
          return item.wordId as WordDetail;
        }
        return item as unknown as WordDetail;
      })
      .filter((w): w is WordDetail => !!w && !!w.word);
  }, [rawWords, selectedSectionId]);

  // Words list for current study:
  // Nếu đã học qua từ đó rồi (đã có UserLessonWord) thì mặc định KHÔNG CẦN GẶP LẠI nữa,
  // do đã có UserWordReview để ôn tập định kỳ!
  // Chỉ khi bật reviewAll = true thì mới nạp lại toàn bộ.
  const wordsList: WordDetail[] = useMemo(() => {
    if (!reviewAll && learnedWords.size > 0) {
      return allSectionWords.filter((w) => !learnedWords.has(w._id));
    }
    return allSectionWords;
  }, [allSectionWords, reviewAll, learnedWords]);

  // Unlearned words count in this section
  const unlearnedCount = useMemo(() => {
    return allSectionWords.filter((w) => !learnedWords.has(w._id)).length;
  }, [allSectionWords, learnedWords]);

  // Learned words count in this section
  const learnedCountInSec = useMemo(() => {
    return allSectionWords.filter((w) => learnedWords.has(w._id)).length;
  }, [allSectionWords, learnedWords]);

  // Study State - default to 'flashcard'
  const [mode, setMode] = useState<StudyMode>('flashcard');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userGuess, setUserGuess] = useState('');
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isDontKnow, setIsDontKnow] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [shake, setShake] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Reset index when reviewAll or section changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [reviewAll, selectedSectionId]);

  // Settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Input ref
  const inputRef = useRef<HTMLInputElement>(null);

  // Current active word
  const currentWord = wordsList[currentIndex] || null;

  // Find Raw LessonWord Item of Current Word
  const currentRawLessonWord = useMemo(() => {
    if (!currentWord) return null;
    return rawWords.find((item) => {
      const wId = typeof item.wordId === 'object' ? item.wordId?._id : item.wordId;
      return wId === currentWord._id;
    });
  }, [currentWord, rawWords]);

  // Find Section Name of Current Word
  const currentWordSectionName = useMemo(() => {
    if (!currentWord || !currentRawLessonWord) return null;
    if (typeof currentRawLessonWord.sectionId === 'object' && currentRawLessonWord.sectionId?.name) {
      return currentRawLessonWord.sectionId.name;
    }
    const sec = sections.find((s) => s._id === currentRawLessonWord.sectionId);
    return sec?.name || null;
  }, [currentWord, currentRawLessonWord, sections]);

  // Comprehensive Meanings & Part of Speech Parsers
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

  // Flattened translations for quick lookups
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

  // Total meanings count
  const totalMeaningsCount = useMemo(() => {
    return parsedParts.reduce((acc, p) => acc + (p.meanings?.length || 0), 0);
  }, [parsedParts]);

  // Primary single meaning
  const primaryVietnameseWord = allTranslationsList[0] || currentWord?.meaning || wordText;

  // Primary definition & example
  const primaryEnDefinition = parsedParts[0]?.meanings[0]?.definition || '';
  const primaryExampleEn = parsedParts[0]?.meanings[0]?.examples[0]?.en || currentWord?.example || '';
  const primaryExampleVi = parsedParts[0]?.meanings[0]?.examples[0]?.vi || '';

  // Illustration image
  const illustration =
    currentWord?.image ||
    currentWord?.imageUrl ||
    '';

  // US & UK Audios
  const audioUs = currentWord?.audio?.us || '';
  const audioUk = currentWord?.audio?.uk || '';
  const audioFallback = currentWord?.audioUrl || '';
  const defaultAudioUrl = audioUs || audioUk || audioFallback;

  // US & UK IPAs
  const ipaUs = currentWord?.ipa?.us || (currentWord?.phonetic ? currentWord.phonetic : '');
  const ipaUk = currentWord?.ipa?.uk || '';

  // Mask English word in example for Guess mode
  const maskedExampleEn = useMemo(() => {
    if (!primaryExampleEn || !wordText) return primaryExampleEn;
    const escaped = wordText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    return primaryExampleEn.replace(regex, '______');
  }, [primaryExampleEn, wordText]);

  // Sequence of character indices to reveal: Max 40% of word length
  // 1st: First character (index 0)
  // 2nd: Last character (index len - 1)
  // 3rd: Middle character (Math.floor(len / 2))
  // Next: Other non-adjacent characters
  const hintIndicesSequence = useMemo(() => {
    if (!wordText) return [];
    const len = wordText.length;
    if (len <= 0) return [];

    // Max 40% of characters (at least 1 character for short words)
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

    // 1. Ký tự đầu tiên
    pushIfValid(0);
    // 2. Ký tự cuối cùng
    if (len > 1) pushIfValid(len - 1);
    // 3. Ký tự ở giữa
    if (len > 2) pushIfValid(Math.floor(len / 2));
    // 4. Ký tự 1/4
    if (len > 4) pushIfValid(Math.floor(len / 4));
    // 5. Ký tự 3/4
    if (len > 5) pushIfValid(Math.floor((len * 3) / 4));

    // Remaining characters if any
    for (let i = 1; i < len - 1; i++) {
      if (order.length >= maxAllowed) break;
      pushIfValid(i);
    }

    return order.slice(0, maxAllowed);
  }, [wordText]);

  const maxHints = hintIndicesSequence.length;

  // Masked letters hint according to smart sequence
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

  // Audio Playback with visual wave state & Web Speech fallback
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
          audio.play().catch(() => {
            resetPlaying();
          });
          return;
        } catch {
          // fallback below
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
    markInteraction();
    setIsFlipped((prev) => {
      const next = !prev;
      if (soundEnabled) playFlipSound();
      return next;
    });
  };

  // Reset state when section or lesson changes
  useEffect(() => {
    setCurrentIndex(0);
    setCompleted(false);
    setStreak(0);
  }, [currentLessonId, selectedSectionId]);

  const isFirstMount = useRef(true);

  // Scroll to top on initial page mount or lesson change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentLessonId]);

  // Reset even when learning removes a word at the same list index.
  React.useLayoutEffect(() => {
    setUserGuess('');
    setIsAnswerChecked(false);
    setIsCorrect(false);
    setIsDontKnow(false);
    setHintsRevealed(0);
    setIsFlipped(false);

    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    if (inputRef.current && (mode === 'guess' || mode === 'repeat')) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, [currentWord?._id, mode, selectedSectionId, currentLessonId]);

  // Auto-play audio when word changes or flashcard appears (never in guess mode)
  useEffect(() => {
    if (autoPlayAudio && currentWord && mode !== 'guess') {
      const timer = setTimeout(() => {
        playAudio();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, autoPlayAudio, currentWord, playAudio, mode]);

  // Handle Mark as Mastered
  const handleMarkMastered = () => {
    if (!currentWord) return;
    setLearnedWords((prev) => new Set(prev).add(currentWord._id));
    setMasteredWords((prev) => new Set(prev).add(currentWord._id));
    setNeedReviewWords((prev) => {
      const next = new Set(prev);
      next.delete(currentWord._id);
      return next;
    });
    if (soundEnabled) playSuccessSound();
    handleNextWord();
  };

  // Handle Mark as Need Review
  const handleMarkNeedReview = () => {
    if (!currentWord) return;
    setLearnedWords((prev) => new Set(prev).add(currentWord._id));
    setNeedReviewWords((prev) => new Set(prev).add(currentWord._id));
    setMasteredWords((prev) => {
      const next = new Set(prev);
      next.delete(currentWord._id);
      return next;
    });
    if (soundEnabled) playFlipSound();
    handleNextWord();
  };

  // Handle submit guess
  const handleCheckGuess = () => {
    if (!userGuess.trim() || !wordText) return;
    markInteraction();
    const normalizedInput = userGuess.trim().toLowerCase();
    const normalizedTarget = wordText.trim().toLowerCase();

    if (normalizedInput === normalizedTarget) {
      setIsCorrect(true);
      setIsAnswerChecked(true);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > highestStreak) setHighestStreak(newStreak);

      if (soundEnabled) {
        if (newStreak % 3 === 0) {
          playComboSound();
          triggerConfetti(0.5, 0.4);
        } else {
          playSuccessSound();
        }
      }
    } else {
      setIsCorrect(false);
      setIsAnswerChecked(true);
      setStreak(0);
      setShake(true);
      if (soundEnabled) playErrorSound();
      setTimeout(() => setShake(false), 500);
    }
  };

  // Give hint: reveal up to 40% characters; once max reached, play audio pronunciation
  const handleGiveHint = () => {
    markInteraction();
    if (hintsRevealed < maxHints) {
      setHintsRevealed((prev) => prev + 1);
    } else {
      playAudio();
    }
  };

  // Handle "Không biết" button click
  const handleDontKnow = () => {
    if (!currentWord) return;
    markInteraction();
    setIsDontKnow(true);
    setIsAnswerChecked(true);
    setIsCorrect(false);
    setStreak(0);
    setNeedReviewWords((prev) => new Set(prev).add(currentWord._id));
    playAudio();
  };

  // Next Word
  const handleNextWord = () => {
    if (ratingLock.current) return;
    if (currentIndex < wordsList.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCompleted(true);
      if (sessionIdRef.current) {
        learningService.completeSession(sessionIdRef.current).catch(() => {});
      }
      refetchProgress();
      if (soundEnabled) playVictoryFanfare();
      triggerConfetti(0.5, 0.3);
      setTimeout(() => triggerConfetti(0.3, 0.5), 300);
      setTimeout(() => triggerConfetti(0.7, 0.5), 600);
    }
  };

  // Previous Word
  const handlePrevWord = () => {
    if (ratingLock.current) return;
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // SRS Rating actions (Học lại, Khó, Tốt, Dễ)
  const handleSrsRating = async (level: SrsLevel) => {
    if (!currentWord || !currentLessonId || ratingLock.current) return;
    ratingLock.current = true; setRatingSaving(true); setRatingError(false);
    try {

    markInteraction();

    // Đánh dấu từ đã học qua (đã có UserLessonWord, sẽ không xuất hiện lại trong lesson nữa)
    const ratingEnum = level.toUpperCase() as SrsRatingType;
    const modeEnum: StudyModeType =
      mode === 'guess' ? 'TYPING' : 'FLASHCARD';
    const isCorrectRate = level === 'good' || level === 'easy';

    const response = await learningService.recordAction({
      sessionId: sessionIdRef.current || undefined,
      lessonId: currentLessonId, wordId: currentWord._id, lessonWordId: currentRawLessonWord?._id,
      sessionStartedAt: sessionStartedAtRef.current?.toISOString(), mode: modeEnum, rating: ratingEnum, isCorrect: isCorrectRate,
    });
    if (response.data?.sessionId) sessionIdRef.current = response.data.sessionId;
    setLearnedWords(previous => new Set(previous).add(currentWord._id));

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

    ratingLock.current = false;
    // In new-word mode the rated word is removed from wordsList. Keep the same
    // index to reveal its successor instead of skipping the following card.
    if (reviewAll || currentIndex >= wordsList.length - 1) handleNextWord();
    } catch { setRatingError(true); } finally { ratingLock.current = false; setRatingSaving(false); }
  };

  // Toggle Save / Bookmark
  const handleToggleSave = () => {
    if (!currentWord) return;
    setSavedWords((prev) => {
      const next = new Set(prev);
      if (next.has(currentWord._id)) {
        next.delete(currentWord._id);
      } else {
        next.add(currentWord._id);
      }
      return next;
    });
    if (soundEnabled) playFlipSound();
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
      if (ratingLock.current) return;
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
          document.querySelector<HTMLButtonElement>(`[data-save-word-id="${currentWord?._id}"]`)?.click();
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
    isCorrect,
    isDontKnow,
    currentIndex,
    wordsList.length,
    mode,
    isFlipped,
    streak,
    wordText,
    playAudio,
    showSrsBar,
    currentWord,
    soundEnabled,
    highestStreak,
  ]);

  const totalWords = wordsList.length;
  // Thanh tiến độ đồng bộ 100% với số từ ĐÃ HỌC THẬT (có UserLessonWord, nằm trong learnedWords).
  // Chỉ khi user bấm 1 trong 4 nút SRS thì mới được tính vào tiến độ! Chỉ view thẻ không làm tăng tiến độ.
  const progressPercent =
    allSectionWords.length > 0
      ? Math.min(100, Math.round((learnedCountInSec / allSectionWords.length) * 100))
      : 0;

  if (isCollectionLoading || isLessonsLoading) return <PageShell><LoadingState label={t('loading_cards')} /></PageShell>;
  if (!collection?._id || !currentLesson) return <PageShell><EmptyState icon={BookOpen} title={t('library.lessonUnavailable')} description={t('library.lessonUnavailableHelp')} action={<Button onClick={() => router.push(`/${locale}/vocabulary`)}>{t('library.explore')}</Button>} /></PageShell>;

  return (
    <div className="min-h-full bg-background text-slate-900">
      {/* 1. Header with Mode switchers & controls */}
      <StudyHeader
        locale={locale}
        slug={slug}
        collection={collection}
        currentLesson={currentLesson}
        currentWordSectionName={currentWordSectionName}
        mode={mode}
        setMode={setMode}
        streak={streak}
        setShowShortcuts={setShowShortcuts}
        setShowSettings={setShowSettings}
        t={t}
      />

      {/* 2. Main Content: Sidebar + Study Card */}
      <div className="w-full px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <div className="flex flex-col items-start gap-6 lg:flex-row">
          {/* Left Sidebar: Topics */}
          <TopicSidebar
            sections={sections}
            selectedSectionId={selectedSectionId}
            setSelectedSectionId={setSelectedSectionId}
            rawWords={rawWords}
            currentLesson={currentLesson}
            masteredWords={masteredWords}
            needReviewWords={needReviewWords}
            learnedWords={learnedWords}
            sectionStats={lessonProgress?.sectionStats}
            reviewAll={reviewAll}
            setReviewAll={setReviewAll}
            t={t}
          />

          {/* Right Main Area: Cards & HUD */}
          <main className="w-full min-w-0 flex-1 space-y-4">
            {/* Top Progress Bar & HUD */}
            <div className={cn(surface, 'flex items-center justify-between gap-4 px-4 py-3')}>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="font-semibold text-slate-700">
                    {t('lesson_progress', { percent: Math.round(progressPercent) })}
                  </span>
                  <span className="font-semibold text-blue-600">
                    {t('cards_counter', {
                      current: Math.min(learnedCountInSec, allSectionWords.length),
                      total: allSectionWords.length,
                    })}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Shortcut Prompt */}
              <div className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-500 sm:flex">
                <kbd className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-700">
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

            {ratingError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{t('library.saveError')}</p>}
            {ratingSaving && <p role="status" className="sr-only">{t('library.saving')}</p>}
            {/* Study Card Area */}
            {isWordsLoading || isProgressLoading ? (
              <div className={cn(surface, 'h-[440px] w-full sm:h-[470px]')}>
                <LoadingState label={t('loading_cards')} className="h-full" />
              </div>
            ) : wordsList.length === 0 ? (
              allSectionWords.length > 0 ? (
                <div className={cn(surface, 'flex h-[440px] w-full flex-col items-center justify-center space-y-4 p-6 text-center sm:h-[470px] sm:p-8')}>
                  <div className={cn('flex h-14 w-14 items-center justify-center rounded-xl', tones.emerald)}>
                    <CheckCheck className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5 max-w-md">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {t('study_page.all_completed_title')}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {t('study_page.all_completed_desc', { count: allSectionWords.length })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <Button
                      type="button"
                      onClick={() => {
                        setReviewAll(true);
                        setCurrentIndex(0);
                        setCompleted(false);
                      }}
                    >
                      {t('study_page.replay_section_btn', { count: allSectionWords.length })}
                    </Button>
                    {(() => {
                      const curIdx = sections.findIndex((s) => s._id === selectedSectionId);
                      const nextSec = curIdx >= 0 && curIdx < sections.length - 1 ? sections[curIdx + 1] : null;
                      if (!nextSec) return null;
                        return (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setSelectedSectionId(nextSec._id);
                            setReviewAll(false);
                            setCurrentIndex(0);
                            setCompleted(false);
                          }}
                        >
                          {t('study_page.next_section_btn', { name: nextSec.name })}
                        </Button>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={BookOpen}
                  title={t('no_words_in_topic')}
                  description={t('no_words_desc')}
                  className="h-[440px] w-full sm:h-[470px]"
                />
              )
            ) : completed ? (
              <LessonCompletionView
                totalWords={totalWords}
                highestStreak={highestStreak}
                masteredWordsCount={masteredWords.size}
                unmasteredWordsCount={unlearnedCount}
                wordsList={wordsList.length > 0 ? wordsList : allSectionWords}
                lessonTitle={currentLesson?.title}
                sectionName={currentWordSectionName}
                slug={slug}
                locale={locale}
                onReplay={(onlyUnlearned?: boolean) => {
                  if (onlyUnlearned) {
                    setReviewAll(false);
                  } else {
                    setReviewAll(true);
                  }
                  setCurrentIndex(0);
                  setCompleted(false);
                  setStreak(0);
                }}
                playAudio={playAudio}
                t={t}
              />
            ) : (
              <div className="w-full space-y-3">
                {/* MODE 1: FLASHCARD 3D */}
                {mode === 'flashcard' && (
                  <FlashcardView
                    wordId={currentWord?._id}
                    isFlipped={isFlipped}
                    toggleFlipCard={toggleFlipCard}
                    currentIndex={
                      !reviewAll && allSectionWords.length > 0
                        ? Math.min(learnedCountInSec, allSectionWords.length - 1)
                        : currentIndex
                    }
                    totalWords={
                      !reviewAll && allSectionWords.length > 0
                        ? allSectionWords.length
                        : totalWords
                    }
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

                {/* MODES 2 & 3 (SOLID CRISP WHITE CARD) */}
                {mode !== 'flashcard' && (
                  <div className={cn(surface, 'flex min-h-[440px] w-full flex-col items-center justify-center p-5 sm:min-h-[470px] sm:p-6')}>
                    {/* MODE 2: ĐOÁN TỪ (GUESS MODE) */}
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

                    {/* MODE 3: LUYỆN NGHE & GÕ LẠI TỪ (DICTATION) */}
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
                {mode === 'flashcard' && !isFlipped && (
                  <div className="flex min-h-[6.25rem] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/60 p-3">
                    <Button type="button" size="lg" onClick={toggleFlipCard} className="min-w-48 gap-2">
                      <RotateCcw aria-hidden="true" className="size-4" />
                      {t('flip_view_back')}
                    </Button>
                  </div>
                )}
                {showSrsBar && (
                  <SrsRatingBar
                    disabled={ratingSaving}
                    onRating={handleSrsRating}
                    isMastered={masteredWords.has(currentWord?._id || '')}
                    onToggleMastered={handleToggleMastered}
                    isSaved={savedWords.has(currentWord?._id || '')}
                    wordId={currentWord?._id}
                    onToggleSave={handleToggleSave}
                    t={t}
                  />
                )}
              </div>
            )}
          </main>
        </div>
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
