'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { wordService } from '@/services/vocabulary.service';
import { uploadService } from '@/services/upload.service';
import { UpdateWordDto, WordPartDetail } from '@/types/vocabulary';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Book,
  Volume2,
  BookOpen,
  Radio,
  Plus,
  Trash2,
  UploadCloud,
  Image as ImageIcon,
  Loader2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Quote,
} from 'lucide-react';

const LEVEL_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const POS_OPTIONS = [
  { value: 'verb', label: 'verb' },
  { value: 'noun', label: 'noun' },
  { value: 'adjective', label: 'adjective' },
  { value: 'adverb', label: 'adverb' },
  { value: 'preposition', label: 'preposition' },
  { value: 'conjunction', label: 'conjunction' },
  { value: 'pronoun', label: 'pronoun' },
  { value: 'interjection', label: 'interjection' },
  { value: 'phrase', label: 'phrase' },
  { value: 'other', label: 'other' },
];

export interface MeaningExample {
  id: string;
  sentence: string;
  translation: string;
}

export interface MeaningRow {
  id: string;
  partOfSpeech: string;
  english: string;
  vietnamese: string;
  examples: MeaningExample[];
}

interface EditWordDialogProps {
  wordId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TabType = 'general' | 'meanings' | 'media';

export function EditWordDialog({ wordId, open, onOpenChange }: EditWordDialogProps) {
  const { t } = useTranslation('vocabulary');
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabType>('general');

  // Fetch word detail
  const {
    data: response,
    isLoading: isFetching,
  } = useQuery({
    queryKey: ['word-detail', wordId],
    queryFn: () => wordService.getById(wordId!),
    enabled: !!wordId && open,
  });

  const wordDetail = response?.data;

  // Form states
  const [word, setWord] = useState('');
  const [level, setLevel] = useState('A1');
  const [isActive, setIsActive] = useState(true);

  // Pronunciations & Audio Uploads
  const [usIpa, setUsIpa] = useState('');
  const [ukIpa, setUkIpa] = useState('');
  const [usAudioUrl, setUsAudioUrl] = useState('');
  const [ukAudioUrl, setUkAudioUrl] = useState('');
  const [usAudioName, setUsAudioName] = useState('');
  const [ukAudioName, setUkAudioName] = useState('');
  const [isUploadingUs, setIsUploadingUs] = useState(false);
  const [isUploadingUk, setIsUploadingUk] = useState(false);

  const usAudioInputRef = useRef<HTMLInputElement>(null);
  const ukAudioInputRef = useRef<HTMLInputElement>(null);

  // Meanings with nested examples
  const [meanings, setMeanings] = useState<MeaningRow[]>([
    { id: '1', partOfSpeech: 'verb', english: '', vietnamese: '', examples: [] },
  ]);

  // Media (Image)
  const [imageUrl, setImageUrl] = useState('');
  const [imageName, setImageName] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Error validation state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Track temporarily uploaded Cloudinary URLs during this edit session
  const tempUploadedUrls = useRef<Set<string>>(new Set());

  const cleanupTempUploads = () => {
    if (tempUploadedUrls.current.size > 0) {
      tempUploadedUrls.current.forEach((url) => {
        uploadService.deleteFile(url);
      });
      tempUploadedUrls.current.clear();
    }
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (tempUploadedUrls.current.size > 0) {
        tempUploadedUrls.current.forEach((url) => {
          uploadService.deleteFile(url);
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanupTempUploads();
    };
  }, []);

  // Populate data when wordDetail loads
  useEffect(() => {
    if (!wordDetail || !open) return;

    cleanupTempUploads();
    setActiveTab('general');
    setWord(wordDetail.word || '');
    setLevel(wordDetail.level || 'A1');
    setIsActive(wordDetail.isActive !== false);

    setUsIpa(wordDetail.ipa?.us || '');
    setUkIpa(wordDetail.ipa?.uk || '');
    setUsAudioUrl(wordDetail.audio?.us || '');
    setUkAudioUrl(wordDetail.audio?.uk || '');
    setUsAudioName('');
    setUkAudioName('');
    setIsUploadingUs(false);
    setIsUploadingUk(false);

    // Extract meanings and their own examples
    const loadedMeanings: MeaningRow[] = [];

    if (Array.isArray(wordDetail.parts)) {
      wordDetail.parts.forEach((part, pIdx) => {
        const pos = (part.partOfSpeech || 'other').toLowerCase();
        (part.meanings || []).forEach((m, mIdx) => {
          const nestedExamples: MeaningExample[] = (m.examples || []).map(
            (ex, eIdx) => ({
              id: `ex_${pIdx}_${mIdx}_${eIdx}`,
              sentence: ex.en || '',
              translation: ex.vi || '',
            })
          );

          loadedMeanings.push({
            id: `m_${pIdx}_${mIdx}`,
            partOfSpeech: pos,
            english: m.definition || '',
            vietnamese: Array.isArray(m.translation) ? m.translation.join(', ') : '',
            examples: nestedExamples,
          });
        });
      });
    }

    setMeanings(
      loadedMeanings.length > 0
        ? loadedMeanings
        : [{ id: '1', partOfSpeech: 'verb', english: '', vietnamese: '', examples: [] }]
    );

    setImageUrl(wordDetail.image || '');
    setImageName('');
    setIsUploadingImage(false);
    setErrorMessage(null);
  }, [wordDetail, open]);

  // Cloudinary Audio Upload handlers
  const handleUsAudioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingUs(true);
      setErrorMessage(null);
      const res = await uploadService.uploadFile(file);

      // If replacing previously uploaded audio in this session, delete old one
      if (usAudioUrl && tempUploadedUrls.current.has(usAudioUrl)) {
        uploadService.deleteFile(usAudioUrl, 'raw');
        tempUploadedUrls.current.delete(usAudioUrl);
      }

      tempUploadedUrls.current.add(res.url);
      setUsAudioUrl(res.url);
      setUsAudioName(file.name);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Failed to upload US audio to Cloudinary');
    } finally {
      setIsUploadingUs(false);
      if (usAudioInputRef.current) usAudioInputRef.current.value = '';
    }
  };

  const handleRemoveUsAudio = () => {
    if (usAudioUrl && tempUploadedUrls.current.has(usAudioUrl)) {
      uploadService.deleteFile(usAudioUrl, 'raw');
      tempUploadedUrls.current.delete(usAudioUrl);
    }
    setUsAudioUrl('');
    setUsAudioName('');
  };

  const handleUkAudioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingUk(true);
      setErrorMessage(null);
      const res = await uploadService.uploadFile(file);

      // If replacing previously uploaded audio in this session, delete old one
      if (ukAudioUrl && tempUploadedUrls.current.has(ukAudioUrl)) {
        uploadService.deleteFile(ukAudioUrl, 'raw');
        tempUploadedUrls.current.delete(ukAudioUrl);
      }

      tempUploadedUrls.current.add(res.url);
      setUkAudioUrl(res.url);
      setUkAudioName(file.name);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Failed to upload UK audio to Cloudinary');
    } finally {
      setIsUploadingUk(false);
      if (ukAudioInputRef.current) ukAudioInputRef.current.value = '';
    }
  };

  const handleRemoveUkAudio = () => {
    if (ukAudioUrl && tempUploadedUrls.current.has(ukAudioUrl)) {
      uploadService.deleteFile(ukAudioUrl, 'raw');
      tempUploadedUrls.current.delete(ukAudioUrl);
    }
    setUkAudioUrl('');
    setUkAudioName('');
  };

  // Cloudinary Image Upload handler
  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingImage(true);
      setErrorMessage(null);
      const res = await uploadService.uploadFile(file);

      // If replacing previously uploaded image in this session, delete old one
      if (imageUrl && tempUploadedUrls.current.has(imageUrl)) {
        uploadService.deleteFile(imageUrl);
        tempUploadedUrls.current.delete(imageUrl);
      }

      tempUploadedUrls.current.add(res.url);
      setImageUrl(res.url);
      setImageName(file.name);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Failed to upload image to Cloudinary');
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleRemoveImage = () => {
    if (imageUrl && tempUploadedUrls.current.has(imageUrl)) {
      uploadService.deleteFile(imageUrl);
      tempUploadedUrls.current.delete(imageUrl);
    }
    setImageUrl('');
    setImageName('');
  };

  const playAudio = (url?: string) => {
    if (!url) return;
    try {
      const a = new Audio(url);
      a.play().catch(console.warn);
    } catch (err) {
      console.warn(err);
    }
  };

  // VALIDATION FUNCTIONS FOR EACH TAB
  const validateGeneral = (): boolean => {
    if (!word.trim()) {
      setErrorMessage(t('err_word_required'));
      return false;
    }
    setErrorMessage(null);
    return true;
  };

  const validateMeanings = (): boolean => {
    if (meanings.length === 0) {
      setErrorMessage(t('err_meaning_required'));
      return false;
    }
    const hasIncomplete = meanings.some(
      (m) => !m.english.trim() || !m.vietnamese.trim()
    );
    if (hasIncomplete) {
      setErrorMessage(t('err_meaning_required'));
      return false;
    }

    for (const m of meanings) {
      for (const ex of m.examples) {
        if (!ex.sentence.trim() || !ex.translation.trim()) {
          setErrorMessage(t('err_example_incomplete'));
          return false;
        }
      }
    }

    setErrorMessage(null);
    return true;
  };

  // Stepped Navigation Handlers
  const handleNextFromGeneral = () => {
    if (validateGeneral()) {
      setActiveTab('meanings');
    }
  };

  const handleNextFromMeanings = () => {
    if (validateMeanings()) {
      setActiveTab('media');
    }
  };

  const handleTabClick = (targetTab: TabType) => {
    if (targetTab === activeTab) return;

    if (activeTab === 'general' && (targetTab === 'meanings' || targetTab === 'media')) {
      if (!validateGeneral()) return;
    }
    if (activeTab === 'meanings' && targetTab === 'media') {
      if (!validateMeanings()) return;
    }

    setErrorMessage(null);
    setActiveTab(targetTab);
  };

  // Dynamic Meaning Handlers
  const addMeaning = () => {
    setErrorMessage(null);
    setMeanings((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        partOfSpeech: 'verb',
        english: '',
        vietnamese: '',
        examples: [],
      },
    ]);
  };

  const removeMeaning = (id: string) => {
    setErrorMessage(null);
    setMeanings((prev) => prev.filter((m) => m.id !== id));
  };

  const updateMeaning = (id: string, field: 'partOfSpeech' | 'english' | 'vietnamese', value: string) => {
    setErrorMessage(null);
    setMeanings((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  // Dynamic Example Handlers per Meaning
  const addExample = (meaningId: string) => {
    setErrorMessage(null);
    setMeanings((prev) =>
      prev.map((m) => {
        if (m.id !== meaningId) return m;
        return {
          ...m,
          examples: [
            ...m.examples,
            { id: String(Date.now()), sentence: '', translation: '' },
          ],
        };
      })
    );
  };

  const removeExample = (meaningId: string, exampleId: string) => {
    setErrorMessage(null);
    setMeanings((prev) =>
      prev.map((m) => {
        if (m.id !== meaningId) return m;
        return {
          ...m,
          examples: m.examples.filter((ex) => ex.id !== exampleId),
        };
      })
    );
  };

  const updateExample = (
    meaningId: string,
    exampleId: string,
    field: 'sentence' | 'translation',
    value: string
  ) => {
    setErrorMessage(null);
    setMeanings((prev) =>
      prev.map((m) => {
        if (m.id !== meaningId) return m;
        return {
          ...m,
          examples: m.examples.map((ex) =>
            ex.id === exampleId ? { ...ex, [field]: value } : ex
          ),
        };
      })
    );
  };

  const getIndexBadgeColor = (idx: number) => {
    const colors = [
      'bg-blue-600 text-white',
      'bg-emerald-600 text-white',
      'bg-purple-600 text-white',
      'bg-amber-600 text-white',
      'bg-rose-600 text-white',
    ];
    return colors[idx % colors.length];
  };

  // Mutation
  const updateMutation = useMutation({
    mutationFn: (payload: UpdateWordDto) => wordService.update(wordId!, payload),
    onSuccess: () => {
      // If the word originally had an image or audio on Cloudinary, and it was replaced or removed, delete old asset
      if (wordDetail?.image && wordDetail.image !== imageUrl && wordDetail.image.includes('cloudinary.com')) {
        uploadService.deleteFile(wordDetail.image);
      }
      if (wordDetail?.audio?.us && wordDetail.audio.us !== usAudioUrl && wordDetail.audio.us.includes('cloudinary.com')) {
        uploadService.deleteFile(wordDetail.audio.us, 'raw');
      }
      if (wordDetail?.audio?.uk && wordDetail.audio.uk !== ukAudioUrl && wordDetail.audio.uk.includes('cloudinary.com')) {
        uploadService.deleteFile(wordDetail.audio.uk, 'raw');
      }

      tempUploadedUrls.current.clear();
      queryClient.invalidateQueries({ queryKey: ['words'] });
      queryClient.invalidateQueries({ queryKey: ['word-detail', wordId] });
      setErrorMessage(null);
      onOpenChange(false);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to update word. Please try again.';
      setErrorMessage(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateGeneral()) {
      setActiveTab('general');
      return;
    }
    if (!validateMeanings()) {
      setActiveTab('meanings');
      return;
    }

    const partsMap = new Map<string, WordPartDetail>();

    meanings.forEach((m) => {
      if (!m.english.trim()) return;
      const pos = (m.partOfSpeech || 'other').toUpperCase();
      const translations = m.vietnamese
        ? m.vietnamese.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      const validExamples = m.examples
        .filter((ex) => ex.sentence.trim() && ex.translation.trim())
        .map((ex) => ({
          en: ex.sentence.trim(),
          vi: ex.translation.trim(),
        }));

      if (!partsMap.has(pos)) {
        partsMap.set(pos, {
          partOfSpeech: pos,
          meanings: [],
        });
      }

      partsMap.get(pos)!.meanings.push({
        definition: m.english.trim(),
        translation: translations,
        synonyms: [],
        antonyms: [],
        examples: validExamples,
      });
    });

    const payload: UpdateWordDto = {
      word: word.trim(),
      level,
      ipa: {
        us: usIpa.trim() || undefined,
        uk: ukIpa.trim() || undefined,
      },
      audio: {
        us: usAudioUrl.trim() || undefined,
        uk: ukAudioUrl.trim() || undefined,
      },
      image: imageUrl.trim() || undefined,
      parts: Array.from(partsMap.values()),
      isActive,
    };

    updateMutation.mutate(payload);
  };

  const validMeaningsCount = meanings.filter(
    (m) => m.english.trim() && m.vietnamese.trim()
  ).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) cleanupTempUploads();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-3xl md:max-w-4xl w-full max-h-[92vh] flex flex-col p-0 gap-0 rounded-2xl border border-slate-200/80 shadow-2xl bg-white overflow-hidden">
        {/* TOP BAR / TITLE */}
        <div className="px-6 pt-5 pb-3 border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between pb-3">
            <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
              {t('edit_word_title', { defaultValue: 'Edit Word' })}
            </DialogTitle>
          </div>

          {/* TAB NAVIGATION BUTTONS (3 TABS) */}
          <div className="flex items-center gap-6 text-sm font-medium border-b border-slate-100 -mb-3 pt-1">
            <button
              type="button"
              onClick={() => handleTabClick('general')}
              className={`pb-3 border-b-2 transition-all cursor-pointer ${
                activeTab === 'general'
                  ? 'border-blue-600 text-blue-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t('tab_general', { defaultValue: 'General' })}
            </button>

            <button
              type="button"
              onClick={() => handleTabClick('meanings')}
              className={`pb-3 border-b-2 transition-all cursor-pointer ${
                activeTab === 'meanings'
                  ? 'border-blue-600 text-blue-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t('tab_meanings', { defaultValue: 'Meanings & Examples' })} (
              {validMeaningsCount || meanings.length})
            </button>

            <button
              type="button"
              onClick={() => handleTabClick('media')}
              className={`pb-3 border-b-2 transition-all cursor-pointer ${
                activeTab === 'media'
                  ? 'border-blue-600 text-blue-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t('tab_media', { defaultValue: 'Media & Images' })}
            </button>
          </div>
        </div>

        {/* ERROR MESSAGE ALERT (IF ANY) */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* LOADING INDICATOR */}
        {isFetching ? (
          <div className="flex-1 p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="text-sm font-medium">
              {t('loading_details', { defaultValue: 'Loading word details...' })}
            </span>
          </div>
        ) : (
          /* TAB CONTENTS */
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* TAB 1: GENERAL */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                {/* Word Information */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Book className="w-4 h-4 text-blue-600" />
                    <span>
                      {t('sec_word_info', { defaultValue: 'Word Information' })}
                    </span>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    {/* Word Input */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">
                        {t('word_field', { defaultValue: 'Word' })}{' '}
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={word}
                        onChange={(e) => {
                          setWord(e.target.value);
                          setErrorMessage(null);
                        }}
                        placeholder="e.g. abandon"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>

                    {/* Level & Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700">
                          {t('level_field', { defaultValue: 'Level' })}{' '}
                          <span className="text-rose-500">*</span>
                        </label>
                        <Select value={level} onValueChange={(val) => setLevel(val)}>
                        <SelectTrigger className="w-full py-2.5 bg-white border-slate-200 rounded-xl text-sm font-semibold text-slate-800">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          {LEVEL_OPTIONS.map((lvl) => (
                            <SelectItem key={lvl} value={lvl} className="font-semibold text-sm">
                              {lvl}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700">
                          {t('status', { defaultValue: 'Status' })}
                        </label>
                        <div className="flex items-center gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => setIsActive(!isActive)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                              isActive ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                isActive ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span
                            className={`text-sm font-semibold ${
                              isActive ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                          >
                            {isActive
                              ? t('active', { defaultValue: 'Active' })
                              : t('inactive', { defaultValue: 'Inactive' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* Pronunciation: Cloudinary Upload Audio for US and UK */}
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Volume2 className="w-4 h-4 text-blue-600" />
                    <span>
                      {t('sec_pronunciation', {
                        defaultValue: 'Pronunciation',
                      })}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    {/* US Pronunciation Card */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-black uppercase">
                            US
                          </span>
                          <span className="whitespace-nowrap">
                            {t('us_label', { defaultValue: 'US Pronunciation' })}
                          </span>
                        </span>

                        <button
                          type="button"
                          disabled={isUploadingUs}
                          onClick={() => usAudioInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-white hover:bg-blue-50 text-blue-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50"
                        >
                          {isUploadingUs ? (
                            <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                          ) : (
                            <UploadCloud className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          )}
                          <span className="whitespace-nowrap">
                            {isUploadingUs
                              ? t('uploading_cloudinary')
                              : t('upload_audio_us', { defaultValue: 'Upload US Audio' })}
                          </span>
                        </button>
                        <input
                          type="file"
                          ref={usAudioInputRef}
                          accept="audio/*"
                          className="hidden"
                          onChange={handleUsAudioFile}
                        />
                      </div>

                      {/* IPA Input */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600">
                          IPA (US)
                        </label>
                        <input
                          type="text"
                          value={usIpa}
                          onChange={(e) => setUsIpa(e.target.value)}
                          placeholder="/əˈbændən/"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>

                      {/* Audio Preview or URL */}
                      {usAudioUrl ? (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-blue-200 text-xs">
                          <div className="flex items-center gap-2 truncate pr-2">
                            <button
                              type="button"
                              onClick={() => playAudio(usAudioUrl)}
                              className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center shrink-0 cursor-pointer"
                              title="Play Audio"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-slate-700 font-medium truncate text-[11px]">
                              {usAudioName || usAudioUrl}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveUsAudio}
                            className="text-rose-400 hover:text-rose-600 p-1 shrink-0 cursor-pointer"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={usAudioUrl}
                          onChange={(e) => {
                            setUsAudioUrl(e.target.value);
                            setUsAudioName('');
                          }}
                          placeholder={t('or_paste_audio', { defaultValue: 'or paste audio URL' })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      )}
                    </div>

                    {/* UK Pronunciation Card */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-black uppercase">
                            UK
                          </span>
                          <span className="whitespace-nowrap">
                            {t('uk_label', { defaultValue: 'UK Pronunciation' })}
                          </span>
                        </span>

                        <button
                          type="button"
                          disabled={isUploadingUk}
                          onClick={() => ukAudioInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-white hover:bg-blue-50 text-blue-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50"
                        >
                          {isUploadingUk ? (
                            <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                          ) : (
                            <UploadCloud className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          )}
                          <span className="whitespace-nowrap">
                            {isUploadingUk
                              ? t('uploading_cloudinary')
                              : t('upload_audio_uk', { defaultValue: 'Upload UK Audio' })}
                          </span>
                        </button>
                        <input
                          type="file"
                          ref={ukAudioInputRef}
                          accept="audio/*"
                          className="hidden"
                          onChange={handleUkAudioFile}
                        />
                      </div>

                      {/* IPA Input */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600">
                          IPA (UK)
                        </label>
                        <input
                          type="text"
                          value={ukIpa}
                          onChange={(e) => setUkIpa(e.target.value)}
                          placeholder="/əˈbændən/"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>

                      {/* Audio Preview or URL */}
                      {ukAudioUrl ? (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-blue-200 text-xs">
                          <div className="flex items-center gap-2 truncate pr-2">
                            <button
                              type="button"
                              onClick={() => playAudio(ukAudioUrl)}
                              className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center shrink-0 cursor-pointer"
                              title="Play Audio"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-slate-700 font-medium truncate text-[11px]">
                              {ukAudioName || ukAudioUrl}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveUkAudio}
                            className="text-rose-400 hover:text-rose-600 p-1 shrink-0 cursor-pointer"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={ukAudioUrl}
                          onChange={(e) => {
                            setUkAudioUrl(e.target.value);
                            setUkAudioName('');
                          }}
                          placeholder={t('or_paste_audio', { defaultValue: 'or paste audio URL' })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: MEANINGS & EXAMPLES (MERGED) */}
            {activeTab === 'meanings' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <span>{t('sec_meanings', { defaultValue: 'Meanings & Examples' })}</span>
                  </div>

                  <button
                    type="button"
                    onClick={addMeaning}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      {t('btn_add_meaning', { defaultValue: 'Add Meaning' })}
                    </span>
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  {meanings.map((m, idx) => (
                    <div
                      key={m.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-slate-50/70 transition-all space-y-3.5"
                    >
                      {/* Header: Meaning number, POS, remove meaning */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${getIndexBadgeColor(
                              idx
                            )}`}
                          >
                            {idx + 1}
                          </span>
                          <div className="w-36 shrink-0">
                            <Select
                              value={m.partOfSpeech}
                              onValueChange={(val) =>
                                updateMeaning(m.id, 'partOfSpeech', val)
                              }
                            >
                              <SelectTrigger className="h-8 px-2.5 py-1 text-xs font-semibold text-slate-800 rounded-lg border-slate-200 bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {POS_OPTIONS.map((pos) => (
                                  <SelectItem key={pos.value} value={pos.value} className="text-xs font-semibold">
                                    {pos.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {meanings.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeMeaning(m.id)}
                            className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Remove meaning"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Meaning definitions: English & Vietnamese */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-600">
                            {t('col_english', { defaultValue: 'English definition' })}{' '}
                            <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={m.english}
                            onChange={(e) =>
                              updateMeaning(m.id, 'english', e.target.value)
                            }
                            placeholder="e.g. to leave completely"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-600">
                            {t('col_vietnamese', { defaultValue: 'Vietnamese translation' })}{' '}
                            <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={m.vietnamese}
                            onChange={(e) =>
                              updateMeaning(m.id, 'vietnamese', e.target.value)
                            }
                            placeholder="e.g. từ bỏ, bỏ rơi"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* NESTED EXAMPLES FOR THIS SPECIFIC MEANING */}
                      <div className="pt-2 border-t border-slate-200/70 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                            <Quote className="w-3.5 h-3.5 text-blue-500" />
                            <span>{t('sec_examples', { defaultValue: 'Associated Examples' })}</span>
                            <span className="text-slate-400 font-normal">
                              ({m.examples.length})
                            </span>
                          </span>

                          <button
                            type="button"
                            onClick={() => addExample(m.id)}
                            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-white hover:bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{t('btn_add_example', { defaultValue: '+ Add Example' })}</span>
                          </button>
                        </div>

                        {m.examples.length > 0 && (
                          <div className="space-y-2 pt-1">
                            {m.examples.map((ex, exIdx) => (
                              <div
                                key={ex.id}
                                className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs"
                              >
                                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                                  {exIdx + 1}
                                </span>

                                <div className="flex-1">
                                  <input
                                    type="text"
                                    value={ex.sentence}
                                    onChange={(e) =>
                                      updateExample(m.id, ex.id, 'sentence', e.target.value)
                                    }
                                    placeholder={t('col_sentence', { defaultValue: 'English sentence' })}
                                    className="w-full px-2.5 py-1.5 bg-slate-50/50 hover:bg-white border border-slate-200 rounded-md text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                  />
                                </div>

                                <div className="flex-1">
                                  <input
                                    type="text"
                                    value={ex.translation}
                                    onChange={(e) =>
                                      updateExample(m.id, ex.id, 'translation', e.target.value)
                                    }
                                    placeholder={t('col_translation', { defaultValue: 'Vietnamese translation' })}
                                    className="w-full px-2.5 py-1.5 bg-slate-50/50 hover:bg-white border border-slate-200 rounded-md text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removeExample(m.id, ex.id)}
                                  className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer shrink-0"
                                  title="Remove example"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: MEDIA (IMAGE PREVIEW & CLOUDINARY UPLOAD) */}
            {activeTab === 'media' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Radio className="w-4 h-4 text-blue-600" />
                  <span>
                    {t('sec_audio_media', { defaultValue: 'Word Image' })}
                  </span>
                </div>

                {/* Image Preview & Upload Box */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600">
                    {t('image_upload_title', {
                      defaultValue: 'Word Image (optional)',
                    })}
                  </label>

                  {/* Hidden input for selecting image */}
                  <input
                    type="file"
                    ref={imageInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageFile}
                  />

                  {imageUrl ? (
                    /* IMAGE PREVIEW CARD */
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col items-center gap-3">
                      <div className="relative group max-h-64 flex items-center justify-center bg-white rounded-xl border border-slate-200 p-2 overflow-hidden shadow-xs">
                        <img
                          src={imageUrl}
                          alt={word || 'Preview'}
                          className="max-h-56 max-w-full rounded-lg object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://placehold.co/400x300?text=Invalid+Image+URL';
                          }}
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={isUploadingImage}
                          onClick={() => imageInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isUploadingImage ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                          ) : (
                            <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          <span>{t('change_image', { defaultValue: 'Change image' })}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>{t('remove_image', { defaultValue: 'Remove image' })}</span>
                        </button>
                      </div>

                      <div className="w-full text-center">
                        <input
                          type="text"
                          value={imageUrl}
                          onChange={(e) => {
                            setImageUrl(e.target.value);
                            setImageName('');
                          }}
                          placeholder="Image URL"
                          className="w-full max-w-md px-3 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-600 font-mono text-center"
                        />
                      </div>
                    </div>
                  ) : (
                    /* DROPZONE / FILE SELECTOR */
                    <div
                      onClick={() => !isUploadingImage && imageInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-2 bg-slate-50/40 hover:bg-blue-50/20 transition-all cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                        {isUploadingImage ? (
                          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                        ) : (
                          <ImageIcon className="w-6 h-6" />
                        )}
                      </div>
                      <div className="text-xs font-semibold text-slate-700">
                        {isUploadingImage
                          ? t('uploading_cloudinary', { defaultValue: 'Uploading to Cloudinary...' })
                          : t('image_upload_hint', { defaultValue: 'Click to select image' })}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {t('image_upload_sub', {
                          defaultValue: 'Auto-uploaded to Cloudinary (JPG, PNG, WebP)',
                        })}
                      </div>
                      <input
                        type="text"
                        value={imageUrl}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          setImageUrl(e.target.value);
                          setImageName('');
                        }}
                        placeholder="or paste image URL directly"
                        className="w-full max-w-sm mt-3 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 text-center"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODAL BOTTOM ACTION BUTTONS */}
        <div className="p-4 px-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <button
            type="button"
            onClick={() => {
              cleanupTempUploads();
              onOpenChange(false);
            }}
            className="px-4 py-2 border border-slate-200 hover:bg-white rounded-xl text-sm font-semibold text-slate-600 transition-colors cursor-pointer"
          >
            {t('cancel', { defaultValue: 'Cancel' })}
          </button>

          <div className="flex items-center gap-2.5">
            {/* Back button (for tabs > general) */}
            {activeTab !== 'general' && (
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  if (activeTab === 'media') setActiveTab('meanings');
                  else if (activeTab === 'meanings') setActiveTab('general');
                }}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 rounded-xl text-sm font-semibold text-slate-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{t('btn_back', { defaultValue: 'Back' })}</span>
              </button>
            )}

            {/* Next button (for tab general) */}
            {activeTab === 'general' && (
              <button
                type="button"
                onClick={handleNextFromGeneral}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <span>{t('btn_next', { defaultValue: 'Next' })}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {/* Next button (for tab meanings) */}
            {activeTab === 'meanings' && (
              <button
                type="button"
                onClick={handleNextFromMeanings}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <span>{t('btn_next', { defaultValue: 'Next' })}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {/* Submit button (for tab media) */}
            {activeTab === 'media' && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={updateMutation.isPending || isUploadingImage || isUploadingUs || isUploadingUk}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold inline-flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                {updateMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                <span>
                  {t('btn_update_word', { defaultValue: 'Save Changes' })}
                </span>
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
