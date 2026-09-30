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
import { BookOpen, CheckCheck } from 'lucide-react';

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
  const { data: colRes } = useQuery({
    queryKey: ['collection-detail', slug],
    queryFn: () => collectionService.getBySlug(slug),
    enabled: !!slug,
  });
  const collection: CollectionItem | null = useMemo(() => {
    return (colRes as any)?.data || colRes || null;
  }, [colRes]);

  // 2. Fetch all lessons in this collection
  const collectionId = collection?._id;
  const { data: lessonsRes } = useQuery({
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
      lessons[0] ||
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
  const { data: progressRes, refetch: refetchProgress } = useQuery({
    queryKey: ['lesson-progress', currentLessonId],
    queryFn: () => learningService.getLessonProgress(currentLessonId!),
    enabled: !!currentLessonId,
  });

  const lessonProgress = useMemo(() => {
    return (progressRes as any)?.data || progressRes || null;
  }, [progressRes]);

  // Session & Tracking Refs (Lazy Initialization)
  const sessionStartedAtRef = useRef<Date | null>(null);
  const sessionIdRef = useRef<string | null>(null);

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

  // Reset per word change
  useEffect(() => {
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
  }, [currentIndex, mode, selectedSectionId, currentLessonId]);

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
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // SRS Rating actions (Học lại, Khó, Tốt, Dễ)
  const handleSrsRating = (level: SrsLevel) => {
    if (!currentWord || !currentLessonId) return;

    markInteraction();

    // Đánh dấu từ đã học qua (đã có UserLessonWord, sẽ không xuất hiện lại trong lesson nữa)
    setLearnedWords((prev) => new Set(prev).add(currentWord._id));

    const ratingEnum = level.toUpperCase() as SrsRatingType;
    const modeEnum: StudyModeType =
      mode === 'guess' ? 'TYPING' : 'FLASHCARD';
    const isCorrectRate = level === 'good' || level === 'easy';

    // Atomic sync to Backend (Lazy session creation on first rating)
    learningService
      .recordAction({
        sessionId: sessionIdRef.current || undefined,
        lessonId: currentLessonId,
        wordId: currentWord._id,
        lessonWordId: currentRawLessonWord?._id,
        sessionStartedAt: sessionStartedAtRef.current?.toISOString(),
        mode: modeEnum,
        rating: ratingEnum,
        isCorrect: isCorrectRate,
      })
      .then((res: any) => {
        const data = res?.data || res;
        if (data?.sessionId) {
          sessionIdRef.current = data.sessionId;
        }
      })
      .catch((err) => {
        console.error('Error recording learning action:', err);
      });

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
      <div className="max-w-[1440px] mx-auto p-3 sm:p-4 lg:p-5">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 items-start">
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
          <main className="flex-1 w-full space-y-3">
            {/* Top Progress Bar & HUD */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl py-2 px-3.5 border border-slate-200/80 flex items-center justify-between gap-4 shadow-2xs">
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-700 font-bold">
                    {t('lesson_progress', { percent: Math.round(progressPercent) })}
                  </span>
                  <span className="text-blue-600 font-bold">
                    {t('cards_counter', {
                      current: Math.min(learnedCountInSec, allSectionWords.length),
                      total: allSectionWords.length,
                    })}
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden p-0.5 border border-slate-200/50">
                  <div
                    className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-300 shadow-xs"
                    style={{ width: `${progressPercent}%` }}
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
            {isWordsLoading ? (
              <div className="w-full h-[440px] sm:h-[470px] bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3 text-slate-400">
                <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-semibold text-slate-600">{t('loading_cards')}</p>
              </div>
            ) : wordsList.length === 0 ? (
              allSectionWords.length > 0 ? (
                <div className="w-full h-[440px] sm:h-[470px] bg-white rounded-2xl border border-emerald-200 shadow-sm flex flex-col items-center justify-center text-center p-6 sm:p-8 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-xs">
                    <CheckCheck className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5 max-w-md">
                    <h3 className="text-lg font-bold text-slate-900">
                      {t('study_page.all_completed_title')}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {t('study_page.all_completed_desc', { count: allSectionWords.length })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReviewAll(true);
                        setCurrentIndex(0);
                        setCompleted(false);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all shadow-sm cursor-pointer"
                    >
                      {t('study_page.replay_section_btn', { count: allSectionWords.length })}
                    </button>
                    {(() => {
                      const curIdx = sections.findIndex((s) => s._id === selectedSectionId);
                      const nextSec = curIdx >= 0 && curIdx < sections.length - 1 ? sections[curIdx + 1] : null;
                      if (!nextSec) return null;
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSectionId(nextSec._id);
                            setReviewAll(false);
                            setCurrentIndex(0);
                            setCompleted(false);
                          }}
                          className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-all cursor-pointer border border-slate-200"
                        >
                          {t('study_page.next_section_btn', { name: nextSec.name })}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="w-full h-[440px] sm:h-[470px] bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center p-6 sm:p-8 space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner border border-blue-100">
                    <BookOpen className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{t('no_words_in_topic')}</h3>
                  <p className="text-xs text-slate-500 max-w-sm">{t('no_words_desc')}</p>
                </div>
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
              <div className="w-full space-y-4">
                {/* MODE 1: FLASHCARD 3D */}
                {mode === 'flashcard' && (
                  <FlashcardView
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
                  <div className="w-full min-h-[440px] sm:min-h-[470px] bg-white rounded-xl border border-slate-200 shadow-md p-4 sm:p-6 flex flex-col justify-center items-center">
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
