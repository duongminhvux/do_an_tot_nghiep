'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { examService } from '@/services/assessment.service';
import { uploadService } from '@/services/upload.service';
import { ExamItem } from '@/types';
import {
  FileText,
  Image as ImageIcon,
  Volume2,
  Trash2,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Link as LinkIcon,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Loader2,
  HelpCircle,
  Home,
  Check,
  ChevronRight,
  BookOpen,
  Headphones,
  Plus,
  Layers,
  RotateCcw,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SubQuestion {
  id: string;
  content: string;
  options: { key: 'A' | 'B' | 'C' | 'D'; text: string }[];
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

export default function CreateQuestionPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const examId = params?.id as string;
  const { t } = useTranslation('assessment');
  const queryClient = useQueryClient();

  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const groupAudioInputRef = useRef<HTMLInputElement>(null);
  const groupImageInputRef = useRef<HTMLInputElement>(null);

  // 1. Query exam details
  const { data: examResponse } = useQuery({
    queryKey: ['admin-exam', examId],
    queryFn: async () => {
      const res = await examService.getById(examId);
      return res.data;
    },
    enabled: !!examId,
  });

  const exam: ExamItem = useMemo(() => {
    const raw = (examResponse as any)?.data || examResponse;
    if (raw && (raw._id || raw.name)) return raw;
    return {
      _id: examId,
      name: '',
      slug: '',
      type: 'TOEIC',
      mode: 'PRACTICE',
      section: 'LISTENING',
      status: 'ACTIVE',
      durationMinutes: 45,
      totalQuestions: 100,
      isActive: true,
      order: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [examResponse, examId]);

  // 2. Query passages of this exam
  const { data: passagesResponse } = useQuery({
    queryKey: ['admin-exam-passages', examId],
    queryFn: async () => {
      const res = await examService.getPassages(examId);
      return res?.data;
    },
    enabled: !!examId,
  });

  const passages = useMemo(() => {
    const raw = (passagesResponse as any)?.data || passagesResponse;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.items)) return raw.items;
    return [];
  }, [passagesResponse]);

  // 3. Query existing questions count to determine default order
  const { data: questionsResponse } = useQuery({
    queryKey: ['admin-exam-questions', examId],
    queryFn: async () => {
      const res = await examService.getQuestions(examId);
      return res?.data;
    },
    enabled: !!examId,
  });

  const existingQuestions = useMemo(() => {
    const raw = (questionsResponse as any)?.data || questionsResponse;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.items)) return raw.items;
    return [];
  }, [questionsResponse]);

  // General Form States
  const [section, setSection] = useState<'LISTENING' | 'READING'>('LISTENING');
  const [part, setPart] = useState<number>(1);
  const [order, setOrder] = useState<number>(1);
  const [isActive, setIsActive] = useState<boolean>(true);

  // Sync order when questions load
  useEffect(() => {
    if (existingQuestions.length > 0) {
      setOrder(existingQuestions.length + 1);
    }
  }, [existingQuestions.length]);

  // Sync section based on Exam's real section & mode
  useEffect(() => {
    if (!exam?._id || !exam?.name) return;
    if (exam.section === 'READING') {
      setSection('READING');
      setPart((p) => (p < 5 ? 5 : p));
    } else if (exam.section === 'LISTENING') {
      setSection('LISTENING');
      setPart((p) => (p > 4 ? 1 : p));
    }
  }, [exam?.section, exam?._id, exam?.name]);

  // Is Group Mode (Part 3, 4, 6, 7 have shared audio/passage for multiple questions)
  const isGroupPart = useMemo(() => {
    return [3, 4, 6, 7].includes(Number(part));
  }, [part]);

  const groupType = useMemo<'AUDIO' | 'READING'>(() => {
    if (part === 3 || part === 4) return 'AUDIO';
    return 'READING';
  }, [part]);

  // === SINGLE QUESTION FORM STATES (Part 1, 2, 5) ===
  const [passageId, setPassageId] = useState<string>('none');
  const [content, setContent] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [explanation, setExplanation] = useState('');
  const [attachmentTab, setAttachmentTab] = useState<'image' | 'audio' | 'passage'>('image');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageFileName, setImageFileName] = useState<string>('');
  const [imageFileSize, setImageFileSize] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [audioFileName, setAudioFileName] = useState<string>('');
  const [audioFileSize, setAudioFileSize] = useState<string>('');

  // === GROUP QUESTION FORM STATES (Part 3, 4, 6, 7) ===
  const [groupTitle, setGroupTitle] = useState('');
  const [groupAudioUrl, setGroupAudioUrl] = useState('');
  const [groupAudioFileName, setGroupAudioFileName] = useState('');
  const [groupAudioFileSize, setGroupAudioFileSize] = useState('');
  const [groupContent, setGroupContent] = useState(''); // transcript or reading text
  const [groupImageUrl, setGroupImageUrl] = useState('');
  const [groupImageFileName, setGroupImageFileName] = useState('');
  const [readingPassageType, setReadingPassageType] = useState<'text' | 'image'>('text');

  const [subQuestions, setSubQuestions] = useState<SubQuestion[]>([
    { id: '1', content: '', options: [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }], correctAnswer: 'A', explanation: '' },
    { id: '2', content: '', options: [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }], correctAnswer: 'A', explanation: '' },
    { id: '3', content: '', options: [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }], correctAnswer: 'A', explanation: '' },
  ]);
  const [activeSubIndex, setActiveSubIndex] = useState<number>(0);

  // Initialize group defaults when part changes
  useEffect(() => {
    if (part === 3) {
      setGroupTitle(`Questions ${order}-${order + 2} (Part 3 Conversation)`);
      if (subQuestions.length !== 3) {
        setSubQuestions([
          { id: '1', content: '', options: [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }], correctAnswer: 'A', explanation: '' },
          { id: '2', content: '', options: [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }], correctAnswer: 'A', explanation: '' },
          { id: '3', content: '', options: [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }], correctAnswer: 'A', explanation: '' },
        ]);
      }
    } else if (part === 4) {
      setGroupTitle(`Questions ${order}-${order + 2} (Part 4 Talk)`);
      if (subQuestions.length !== 3) {
        setSubQuestions([
          { id: '1', content: '', options: [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }], correctAnswer: 'A', explanation: '' },
          { id: '2', content: '', options: [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }], correctAnswer: 'A', explanation: '' },
          { id: '3', content: '', options: [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }], correctAnswer: 'A', explanation: '' },
        ]);
      }
    } else if (part === 6) {
      setGroupTitle(`Questions ${order}-${order + 3} (Part 6 Text Completion)`);
      if (subQuestions.length < 4) {
        setSubQuestions([
          { id: '1', content: '', options: [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }], correctAnswer: 'A', explanation: '' },
          { id: '2', content: '', options: [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }], correctAnswer: 'A', explanation: '' },
          { id: '3', content: '', options: [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }], correctAnswer: 'A', explanation: '' },
          { id: '4', content: '', options: [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }], correctAnswer: 'A', explanation: '' },
        ]);
      }
    } else if (part === 7) {
      setGroupTitle(`Questions ${order}-${order + 2} (Part 7 Reading Passage)`);
    }
  }, [part, order]);

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // File upload handler
  const handleFileUpload = async (file: File, target: 'single-image' | 'single-audio' | 'group-audio' | 'group-image') => {
    if (!file) return;
    try {
      setIsUploading(true);
      setErrorMessage(null);
      const res = await uploadService.uploadFile(file);
      if (res?.url) {
        const sizeFormatted = `${(file.size / 1024).toFixed(1)} KB`;
        if (target === 'single-image') {
          setImageUrl(res.url);
          setImageFileName(file.name);
          setImageFileSize(sizeFormatted);
        } else if (target === 'single-audio') {
          setAudioUrl(res.url);
          setAudioFileName(file.name);
          setAudioFileSize(sizeFormatted);
        } else if (target === 'group-audio') {
          setGroupAudioUrl(res.url);
          setGroupAudioFileName(file.name);
          setGroupAudioFileSize(sizeFormatted);
        } else if (target === 'group-image') {
          setGroupImageUrl(res.url);
          setGroupImageFileName(file.name);
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || t('createQuestionPage.msgUploadError');
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsUploading(false);
    }
  };

  // Add / Remove sub questions for group parts
  const handleAddSubQuestion = () => {
    const newId = String(Date.now());
    setSubQuestions((prev) => [
      ...prev,
      {
        id: newId,
        content: '',
        options: [
          { key: 'A', text: '' },
          { key: 'B', text: '' },
          { key: 'C', text: '' },
          { key: 'D', text: '' },
        ],
        correctAnswer: 'A',
        explanation: '',
      },
    ]);
    setActiveSubIndex(subQuestions.length);
  };

  const handleRemoveSubQuestion = (idx: number) => {
    if (subQuestions.length <= 1) return;
    const updated = subQuestions.filter((_, i) => i !== idx);
    setSubQuestions(updated);
    if (activeSubIndex >= updated.length) {
      setActiveSubIndex(updated.length - 1);
    }
  };

  const updateActiveSubQuestion = (fields: Partial<SubQuestion>) => {
    setSubQuestions((prev) => {
      const copy = [...prev];
      const cur = copy[activeSubIndex];
      if (!cur) return copy;
      copy[activeSubIndex] = { ...cur, ...fields };
      return copy;
    });
  };

  const updateActiveSubOption = (key: 'A' | 'B' | 'C' | 'D', text: string) => {
    setSubQuestions((prev) => {
      const copy = [...prev];
      const cur = copy[activeSubIndex];
      if (!cur) return copy;
      const updatedOpts = cur.options.map((opt) => (opt.key === key ? { ...opt, text } : opt));
      copy[activeSubIndex] = { ...cur, options: updatedOpts };
      return copy;
    });
  };

  // Helper to completely reset single question form
  const resetSingleForm = (nextOrder?: number) => {
    if (typeof nextOrder === 'number') {
      setOrder(nextOrder);
    }
    setContent('');
    setOptionA('');
    setOptionB('');
    setOptionC('');
    setOptionD('');
    setCorrectAnswer('A');
    setExplanation('');
    setPassageId('none');
    setImageUrl('');
    setImageFileName('');
    setImageFileSize('');
    setAudioUrl('');
    setAudioFileName('');
    setAudioFileSize('');
    setAttachmentTab(part === 1 ? 'image' : part === 2 ? 'audio' : 'image');
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (audioInputRef.current) audioInputRef.current.value = '';
  };

  // Helper to completely reset group question form
  const resetGroupForm = (nextOrder?: number) => {
    const targetOrder = typeof nextOrder === 'number' ? nextOrder : order;
    if (typeof nextOrder === 'number') {
      setOrder(nextOrder);
    }
    setGroupAudioUrl('');
    setGroupAudioFileName('');
    setGroupAudioFileSize('');
    setGroupContent('');
    setGroupImageUrl('');
    setGroupImageFileName('');
    setReadingPassageType('text');
    if (groupAudioInputRef.current) groupAudioInputRef.current.value = '';
    if (groupImageInputRef.current) groupImageInputRef.current.value = '';

    const defaultSubCount = part === 6 ? 4 : 3;
    const initialSubs: SubQuestion[] = Array.from({ length: defaultSubCount }, (_, idx) => ({
      id: String(idx + 1),
      content: '',
      options: [
        { key: 'A', text: '' },
        { key: 'B', text: '' },
        { key: 'C', text: '' },
        { key: 'D', text: '' },
      ],
      correctAnswer: 'A',
      explanation: '',
    }));
    setSubQuestions(initialSubs);
    setActiveSubIndex(0);

    if (part === 3) {
      setGroupTitle(`Questions ${targetOrder}-${targetOrder + 2} (Part 3 Conversation)`);
    } else if (part === 4) {
      setGroupTitle(`Questions ${targetOrder}-${targetOrder + 2} (Part 4 Talk)`);
    } else if (part === 6) {
      setGroupTitle(`Questions ${targetOrder}-${targetOrder + 3} (Part 6 Text Completion)`);
    } else if (part === 7) {
      setGroupTitle(`Questions ${targetOrder}-${targetOrder + 2} (Part 7 Reading Passage)`);
    } else {
      setGroupTitle('');
    }
  };

  const handleManualReset = () => {
    if (isGroupPart) {
      resetGroupForm();
    } else {
      resetSingleForm();
    }
    setErrorMessage(null);
    setSuccessMessage(t('createQuestionPage.resetSuccessMsg'));
    setTimeout(() => setSuccessMessage(null), 2500);
  };

  // Submit Single Question
  const handleSingleSubmit = async (asDraft: boolean = false) => {
    setErrorMessage(null);
    if (!content.trim()) {
      setErrorMessage(t('createQuestionPage.msgInputQuestionContent'));
      return;
    }
    if (part === 2) {
      if (!optionA.trim() || !optionB.trim() || !optionC.trim()) {
        setErrorMessage(t('createQuestionPage.msgPart2OptionsRequired'));
        return;
      }
    } else {
      if (!optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim()) {
        setErrorMessage(t('createQuestionPage.msgOptionsRequired'));
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const optionsPayload = [
        { key: 'A', text: optionA.trim() },
        { key: 'B', text: optionB.trim() },
        { key: 'C', text: optionC.trim() },
      ];
      if (part !== 2 && optionD.trim()) {
        optionsPayload.push({ key: 'D', text: optionD.trim() });
      }

      const payload = {
        examId,
        passageId: passageId !== 'none' ? passageId : undefined,
        section,
        part: Number(part),
        content: content.trim(),
        options: optionsPayload,
        correctAnswer,
        explanation: explanation.trim(),
        imageUrl: imageUrl || undefined,
        audioUrl: audioUrl || undefined,
        order: Number(order) || 1,
        status: asDraft ? 'INACTIVE' : isActive ? 'ACTIVE' : 'INACTIVE',
        isActive: asDraft ? false : isActive,
      };

      await examService.createQuestion(payload);
      queryClient.invalidateQueries({ queryKey: ['admin-exam-questions', examId] });
      setSuccessMessage(t('createQuestionPage.msgQuestionCreated'));

      // Clear all form data back to initial defaults & advance order
      resetSingleForm(Number(order) + 1);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || t('createQuestionPage.msgCreateQuestionError');
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Group Questions
  const handleGroupSubmit = async (asDraft: boolean = false) => {
    setErrorMessage(null);

    // Validation
    if (groupType === 'AUDIO' && !groupAudioUrl) {
      setErrorMessage(t('createQuestionPage.msgAudioRequired'));
      return;
    }
    if (groupType === 'READING') {
      if (readingPassageType === 'text' && !groupContent.trim()) {
        setErrorMessage(t('createQuestionPage.msgReadingTextRequired'));
        return;
      }
      if (readingPassageType === 'image' && !groupImageUrl) {
        setErrorMessage(t('createQuestionPage.msgReadingImageRequired'));
        return;
      }
    }

    for (let i = 0; i < subQuestions.length; i++) {
      const q = subQuestions[i];
      if (!q) continue;
      if (!q.content.trim()) {
        setErrorMessage(t('createQuestionPage.msgSubQuestionContentRequired', { index: i + 1 }));
        setActiveSubIndex(i);
        return;
      }
      const emptyOpt = q.options.find((o) => !o.text.trim());
      if (emptyOpt) {
        setErrorMessage(t('createQuestionPage.msgSubQuestionOptionsRequired', { index: i + 1 }));
        setActiveSubIndex(i);
        return;
      }
    }

    try {
      setIsSubmitting(true);

      const activeReadingImage =
        groupType === 'READING' && (readingPassageType === 'image' || groupImageUrl)
          ? groupImageUrl
          : undefined;

      // 1. Create Passage first
      const defaultTitle = groupType === 'AUDIO'
        ? t('createQuestionPage.defaultAudioTitle', { part })
        : t('createQuestionPage.defaultReadingTitle', { part });
      const passagePayload = {
        examId,
        title: groupTitle.trim() || defaultTitle,
        section,
        audioUrl: groupType === 'AUDIO' ? groupAudioUrl : undefined,
        imageUrl: activeReadingImage,
        content: readingPassageType === 'text' ? (groupContent.trim() || undefined) : (groupContent.trim() || undefined),
        order: Number(order) || 1,
      };

      const passageRes = await examService.createPassage(passagePayload);
      const createdPassageId = (passageRes as any)?.data?._id || (passageRes as any)?._id;

      // 2. Create all sub-questions linked to createdPassageId
      for (let i = 0; i < subQuestions.length; i++) {
        const q = subQuestions[i];
        if (!q) continue;
        const qPayload = {
          examId,
          passageId: createdPassageId,
          section,
          part: Number(part),
          content: q.content.trim(),
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation.trim(),
          imageUrl: activeReadingImage,
          order: Number(order) + i,
          status: asDraft ? 'INACTIVE' : isActive ? 'ACTIVE' : 'INACTIVE',
          isActive: asDraft ? false : isActive,
        };
        await examService.createQuestion(qPayload);
      }

      queryClient.invalidateQueries({ queryKey: ['admin-exam-questions', examId] });
      queryClient.invalidateQueries({ queryKey: ['admin-exam-passages', examId] });
      setSuccessMessage(t('createQuestionPage.msgGroupCreated', {
        count: subQuestions.length,
        type: groupType === 'AUDIO' ? t('createQuestionPage.typeAudio') : t('createQuestionPage.typeReading')
      }));

      // Clear all group form data back to clean initial state & advance order
      const nextOrder = Number(order) + subQuestions.length;
      resetGroupForm(nextOrder);
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || t('createQuestionPage.msgSaveGroupError');
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 space-y-6 w-full">
      {/* 1. Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
        <Link href={`/${locale}/assessment`} className="hover:text-blue-600 transition-colors flex items-center gap-1">
          <Home className="h-3.5 w-3.5" />
          <span>TOEIC</span>
        </Link>
        <span>&rsaquo;</span>
        <Link href={`/${locale}/assessment`} className="hover:text-blue-600 transition-colors">
          {t('detailPage.breadcrumbExams')}
        </Link>
        <span>&rsaquo;</span>
        <Link href={`/${locale}/assessment/${examId}`} className="hover:text-blue-600 transition-colors truncate max-w-xs">
          {exam.name || t('createQuestionPage.breadcrumbDetail')}
        </Link>
        <span>&rsaquo;</span>
        <span className="font-semibold text-slate-900">
          {isGroupPart ? t('createQuestionPage.breadcrumbGroup', { part }) : t('createQuestionPage.breadcrumbSingle', { part })}
        </span>
      </div>

      {/* 2. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isGroupPart ? t('createQuestionPage.titleGroup', { part }) : t('createQuestionPage.titleSingle', { part })}
            </h1>
            <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${
              isGroupPart ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}>
              {isGroupPart ? t('createQuestionPage.badgeGroup') : t('createQuestionPage.badgeSingle')}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isGroupPart
              ? (groupType === 'AUDIO' ? t('createQuestionPage.subtitleGroupAudio') : t('createQuestionPage.subtitleGroupReading'))
              : t('createQuestionPage.subtitleSingle')}
          </p>
        </div>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded flex items-center gap-2.5 text-xs text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded flex items-center gap-2.5 text-xs text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* 3. Unified Master Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Forms */}
        <div className="lg:col-span-8 space-y-5">
          {/* Card 1: Chọn Part & Cấu hình cơ bản */}
          <div className="bg-white border rounded border-slate-200 p-5 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              {t('createQuestionPage.infoCardTitle')}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Đề thi (disabled) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-800">
                  {t('createQuestionPage.examLabel')}
                </label>
                <input
                  type="text"
                  disabled
                  value={exam.name || t('createQuestionPage.currentExam')}
                  className="w-full h-10 px-3.5 border rounded border-slate-200 bg-slate-50 text-xs text-slate-600 font-medium cursor-not-allowed"
                />
              </div>

              {/* Chọn Part */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-800">
                  {t('createQuestionPage.selectPartLabel')} <span className="text-red-500">*</span>
                </label>
                <Select
                  value={String(part)}
                  onValueChange={(val) => {
                    const p = Number(val);
                    setPart(p);
                    if (p <= 4) setSection('LISTENING');
                    else setSection('READING');
                  }}
                >
                  <SelectTrigger className="w-full h-10 text-xs border rounded border-slate-200 bg-white font-medium">
                    <SelectValue placeholder={t('createQuestionPage.selectPartPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent className="text-xs border rounded border-slate-200">
                    {exam.section !== 'READING' && (
                      <>
                        <SelectItem value="1">{t('createQuestionPage.part1Option')}</SelectItem>
                        <SelectItem value="2">{t('createQuestionPage.part2Option')}</SelectItem>
                        <SelectItem value="3">{t('createQuestionPage.part3Option')}</SelectItem>
                        <SelectItem value="4">{t('createQuestionPage.part4Option')}</SelectItem>
                      </>
                    )}
                    {exam.section !== 'LISTENING' && (
                      <>
                        <SelectItem value="5">{t('createQuestionPage.part5Option')}</SelectItem>
                        <SelectItem value="6">{t('createQuestionPage.part6Option')}</SelectItem>
                        <SelectItem value="7">{t('createQuestionPage.part7Option')}</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Thứ tự bắt đầu */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-800">
                  {isGroupPart ? t('createQuestionPage.orderStartLabel') : t('createQuestionPage.orderSingleLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={order}
                  onChange={(e) => setOrder(Number(e.target.value))}
                  className="w-full h-10 px-3 border rounded border-slate-200 bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* NẾU LÀ CỤM CÂU HỎI (PART 3, 4, 6, 7)                     */}
          {/* ========================================================= */}
          {isGroupPart ? (
            <div className="space-y-5">
              {/* Card 2A: Tài nguyên chung của cụm (Audio hoặc Bài đọc) */}
              <div className="bg-white border rounded border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {groupType === 'AUDIO' ? (
                      <Volume2 className="h-5 w-5 text-indigo-600" />
                    ) : (
                      <FileText className="h-5 w-5 text-teal-600" />
                    )}
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        {groupType === 'AUDIO'
                          ? t('createQuestionPage.groupAudioTitle', { part })
                          : t('createQuestionPage.groupReadingTitle', { part })}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {groupType === 'AUDIO'
                          ? t('createQuestionPage.groupAudioDesc')
                          : t('createQuestionPage.groupReadingDesc')}
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {t('createQuestionPage.linkedQuestionsCount', { count: subQuestions.length })}
                  </span>
                </div>

                {/* Tiêu đề đoạn */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800">
                    {t('createQuestionPage.groupTitleLabel')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={groupTitle}
                    onChange={(e) => setGroupTitle(e.target.value)}
                    placeholder={groupType === 'AUDIO' ? t('createQuestionPage.groupAudioPlaceholder') : t('createQuestionPage.groupReadingPlaceholder')}
                    className="w-full h-10 px-3.5 border rounded border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Nếu là Part 3, 4: Upload Audio Chung */}
                {groupType === 'AUDIO' && (
                  <div className="space-y-3 pt-2">
                    <label className="text-xs font-semibold text-slate-800">
                      {t('createQuestionPage.uploadAudioLabel')} <span className="text-red-500">*</span>
                    </label>

                    <input
                      type="file"
                      ref={groupAudioInputRef}
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, 'group-audio');
                        e.target.value = '';
                      }}
                    />

                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file && file.type.startsWith('audio/')) {
                          handleFileUpload(file, 'group-audio');
                        }
                      }}
                      className="border rounded border-slate-200 hover:border-indigo-400 p-6 text-center space-y-2 bg-indigo-50/20 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
                        {isUploading ? (
                          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                        ) : (
                          <Volume2 className="h-5 w-5" />
                        )}
                      </div>
                      <div className="text-xs font-semibold text-slate-700">
                        {isUploading ? t('createQuestionPage.uploadingAudio') : t('createQuestionPage.dropAudioHint')}
                      </div>
                      <button
                        type="button"
                        disabled={isUploading}
                        onClick={() => groupAudioInputRef.current?.click()}
                        className="px-4 py-2 border rounded border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {t('createQuestionPage.chooseAudioFileBtn')}
                      </button>
                    </div>

                    {/* Điền Audio URL */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">
                        {t('createQuestionPage.orAudioUrlDirect')}
                      </label>
                      <input
                        type="url"
                        value={groupAudioUrl}
                        onChange={(e) => {
                          setGroupAudioUrl(e.target.value);
                          if (e.target.value && !groupAudioFileName) {
                            setGroupAudioFileName('audio-url.mp3');
                          }
                        }}
                        placeholder="https://example.com/audio-p3.mp3"
                        className="w-full h-9 px-3 border rounded border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Audio Player Preview */}
                    {groupAudioUrl && (
                      <div className="p-3 border rounded border-indigo-200 bg-indigo-50/50 space-y-2 shadow-xs">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-indigo-900 truncate">
                            {groupAudioFileName || t('createQuestionPage.sharedAudioLabel')}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setGroupAudioUrl('');
                              setGroupAudioFileName('');
                            }}
                            className="text-red-500 hover:text-red-700 text-xs font-semibold cursor-pointer"
                          >
                            {t('createQuestionPage.removeFileBtn')}
                          </button>
                        </div>
                        <audio controls src={groupAudioUrl} className="w-full h-8" />
                      </div>
                    )}

                    {/* Lời thoại / Script (tùy chọn) */}
                    <div className="space-y-1.5 pt-2">
                      <label className="text-xs font-semibold text-slate-800">
                        {t('createQuestionPage.transcriptLabel')} <span className="text-slate-400 font-normal">{t('createQuestionPage.transcriptOptional')}</span>
                      </label>
                      <textarea
                        rows={3}
                        value={groupContent}
                        onChange={(e) => setGroupContent(e.target.value)}
                        placeholder={t('createQuestionPage.transcriptPlaceholder')}
                        className="w-full p-3 border rounded border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* Nếu là Part 6, 7: Soạn thảo Bài đọc (Passage) */}
                {groupType === 'READING' && (
                  <div className="space-y-4 pt-2">
                    {/* Segment Switcher: Văn bản (Text) hoặc Hình ảnh (Image) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-800">
                          {t('createQuestionPage.readingTypeLabel')}:
                        </label>
                        <span className="text-[11px] text-slate-500">
                          {readingPassageType === 'text'
                            ? t('createQuestionPage.readingTextDesc')
                            : t('createQuestionPage.readingImageDesc')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 border border-slate-200 rounded">
                        <button
                          type="button"
                          onClick={() => setReadingPassageType('text')}
                          className={`flex items-center justify-center gap-2 py-2 px-3 rounded text-xs font-bold transition-all cursor-pointer ${
                            readingPassageType === 'text'
                              ? 'bg-white text-teal-700 shadow-xs border border-teal-200'
                              : 'text-slate-600 hover:text-slate-900 border border-transparent'
                          }`}
                        >
                          <FileText className="h-4 w-4" />
                          <span>{t('createQuestionPage.readingTypeText')}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setReadingPassageType('image')}
                          className={`flex items-center justify-center gap-2 py-2 px-3 rounded text-xs font-bold transition-all cursor-pointer ${
                            readingPassageType === 'image'
                              ? 'bg-white text-teal-700 shadow-xs border border-teal-200'
                              : 'text-slate-600 hover:text-slate-900 border border-transparent'
                          }`}
                        >
                          <ImageIcon className="h-4 w-4" />
                          <span>{t('createQuestionPage.readingTypeImage')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Dạng 1: Soạn thảo văn bản */}
                    {readingPassageType === 'text' && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-800">
                          {t('createQuestionPage.readingTextLabel')} <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          rows={7}
                          value={groupContent}
                          onChange={(e) => setGroupContent(e.target.value)}
                          placeholder={t('createQuestionPage.readingTextPlaceholder')}
                          className="w-full p-3.5 border rounded border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 leading-relaxed font-mono"
                        />
                      </div>
                    )}

                    {/* Dạng 2: Tải lên hình ảnh bài đọc */}
                    {readingPassageType === 'image' && (
                      <div className="space-y-3">
                        <input
                          type="file"
                          ref={groupImageInputRef}
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, 'group-image');
                            e.target.value = '';
                          }}
                        />

                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const file = e.dataTransfer.files?.[0];
                            if (file && file.type.startsWith('image/')) {
                              handleFileUpload(file, 'group-image');
                            }
                          }}
                          className="border rounded border-dashed border-teal-300 hover:border-teal-500 p-6 text-center space-y-2 bg-teal-50/20 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center mx-auto">
                            {isUploading ? (
                              <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
                            ) : (
                              <ImageIcon className="h-5 w-5" />
                            )}
                          </div>
                          <div className="text-xs font-semibold text-slate-700">
                            {isUploading ? t('createQuestionPage.uploadingImage') : t('createQuestionPage.dropImageHint')}
                          </div>
                          <button
                            type="button"
                            disabled={isUploading}
                            onClick={() => groupImageInputRef.current?.click()}
                            className="px-4 py-2 border rounded border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {t('createQuestionPage.chooseImageFromDevice')}
                          </button>
                        </div>

                        {/* Điền URL ảnh bài đọc trực tiếp */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-600">
                            {t('createQuestionPage.orDirectImageUrl')}
                          </label>
                          <input
                            type="url"
                            value={groupImageUrl}
                            onChange={(e) => {
                              setGroupImageUrl(e.target.value);
                              if (e.target.value && !groupImageFileName) {
                                setGroupImageFileName('image-reading-url');
                              }
                            }}
                            placeholder="https://example.com/reading-passage-photo.jpg"
                            className="w-full h-9 px-3 border rounded border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        </div>

                        {/* Preview ảnh bài đọc đã chọn */}
                        {groupImageUrl && (
                          <div className="p-3 border rounded border-teal-200 bg-teal-50/40 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-teal-900 truncate">
                                {groupImageFileName || t('createQuestionPage.readingImageBadge')}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setGroupImageUrl('');
                                  setGroupImageFileName('');
                                }}
                                className="text-red-500 hover:text-red-700 text-xs font-semibold cursor-pointer"
                              >
                                {t('createQuestionPage.deleteBtn')}
                              </button>
                            </div>
                            <div className="border rounded border-slate-200 overflow-hidden bg-white max-h-64 flex items-center justify-center p-1">
                              <img
                                src={groupImageUrl}
                                alt="Reading Passage Preview"
                                className="max-h-60 max-w-full object-contain rounded"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Card 2B: Danh sách các câu hỏi con */}
              <div className="bg-white border rounded border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-blue-600" />
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        {t('createQuestionPage.subQuestionsTitle')}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {t('createQuestionPage.subQuestionsSubtitle')}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSubQuestion}
                    className="px-3 py-1.5 border rounded border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{t('createQuestionPage.addSubQuestionBtn')}</span>
                  </button>
                </div>

                {/* Sub-question Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
                  {subQuestions.map((q, idx) => (
                    <button
                      key={q.id || idx}
                      type="button"
                      onClick={() => setActiveSubIndex(idx)}
                      className={`px-3.5 py-2 border rounded text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
                        activeSubIndex === idx
                          ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{t('createQuestionPage.questionNum', { index: idx + 1, num: order + idx })}</span>
                      {q.content.trim() ? (
                        <Check className="h-3.5 w-3.5 text-emerald-300" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Active Sub-question Editor */}
                {subQuestions[activeSubIndex] && (() => {
                  const currentSub = subQuestions[activeSubIndex]!;
                  return (
                    <div className="space-y-4 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                            {activeSubIndex + 1}
                          </span>
                          <span>{t('createQuestionPage.activeQuestionContentTitle', { num: order + activeSubIndex })}</span>
                        </div>

                        {subQuestions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSubQuestion(activeSubIndex)}
                            className="text-xs text-red-500 hover:text-red-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{t('createQuestionPage.removeThisQuestionBtn')}</span>
                          </button>
                        )}
                      </div>

                      <textarea
                        rows={2}
                        value={currentSub.content}
                        onChange={(e) => updateActiveSubQuestion({ content: e.target.value })}
                        placeholder={t('createQuestionPage.subQuestionPlaceholder')}
                        className="w-full p-3 border rounded border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />

                      {/* 4 Options */}
                      <div className="space-y-2.5">
                        <label className="text-xs font-semibold text-slate-800">
                          {t('createQuestionPage.fourOptionsLabel')}
                        </label>
                        {(['A', 'B', 'C', 'D'] as const).map((key) => {
                          const optText = currentSub.options.find((o) => o.key === key)?.text || '';
                          return (
                            <div key={key} className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                                currentSub.correctAnswer === key
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {key}
                              </div>
                              <input
                                type="text"
                                value={optText}
                                onChange={(e) => updateActiveSubOption(key, e.target.value)}
                                placeholder={t('createQuestionPage.inputOptionPlaceholder', { key })}
                                className="flex-1 h-9 px-3 border rounded border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <button
                                type="button"
                                onClick={() => updateActiveSubQuestion({ correctAnswer: key })}
                                className={`px-2.5 py-1.5 border rounded text-xs font-semibold transition-all cursor-pointer ${
                                  currentSub.correctAnswer === key
                                    ? 'bg-emerald-100 border-emerald-300 text-emerald-800 font-bold'
                                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {currentSub.correctAnswer === key ? t('createQuestionPage.correctBadge') : t('createQuestionPage.markCorrectBtn')}
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Giải thích */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-800">
                          {t('createQuestionPage.explanationForQuestionLabel')}
                        </label>
                        <textarea
                          rows={2}
                          value={currentSub.explanation}
                          onChange={(e) => updateActiveSubQuestion({ explanation: e.target.value })}
                          placeholder={t('createQuestionPage.explanationPlaceholder')}
                          className="w-full p-3 border rounded border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            // =========================================================
            // NẾU LÀ CÂU HỎI ĐƠN LẺ (PART 1, 2, 5)                     
            // =========================================================
            <div className="space-y-5">
              <div className={`grid grid-cols-1 ${part === 5 ? '' : 'md:grid-cols-2'} gap-5 items-stretch`}>
                {/* Cột con 1: Nội dung câu hỏi & Lựa chọn */}
                <div className="bg-white border rounded border-slate-200 p-5 shadow-xs space-y-4">
                  <h2 className="text-base font-bold text-slate-900">
                    {t('createQuestionPage.questionContentCardTitle')}
                  </h2>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800">
                      {t('createQuestionPage.questionContentLabel')} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={part === 5 ? 4 : 3}
                      value={content}
                      maxLength={1000}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder={
                        part === 1
                          ? t('createQuestionPage.part1Placeholder')
                          : part === 2
                          ? t('createQuestionPage.part2Placeholder')
                          : t('createQuestionPage.part5Placeholder')
                      }
                      className="w-full p-3 border rounded border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none bg-white"
                    />
                  </div>

                  {/* Các lựa chọn đáp án */}
                  <div className="space-y-2.5 pt-1">
                    <label className="text-xs font-semibold text-slate-800">
                      {t('createQuestionPage.optionsTitle')} {part === 2 && t('createQuestionPage.part2OptionsNotice')}
                    </label>

                    <div className={`grid grid-cols-1 ${part === 5 ? 'sm:grid-cols-2' : ''} gap-2.5`}>
                      {/* Option A */}
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                          A
                        </div>
                        <input
                          type="text"
                          value={optionA}
                          onChange={(e) => setOptionA(e.target.value)}
                          placeholder={t('createQuestionPage.inputOptionPlaceholder', { key: 'A' })}
                          className="flex-1 h-9 px-3 border rounded border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      {/* Option B */}
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
                          B
                        </div>
                        <input
                          type="text"
                          value={optionB}
                          onChange={(e) => setOptionB(e.target.value)}
                          placeholder={t('createQuestionPage.inputOptionPlaceholder', { key: 'B' })}
                          className="flex-1 h-9 px-3 border rounded border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      {/* Option C */}
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center shrink-0">
                          C
                        </div>
                        <input
                          type="text"
                          value={optionC}
                          onChange={(e) => setOptionC(e.target.value)}
                          placeholder={t('createQuestionPage.inputOptionPlaceholder', { key: 'C' })}
                          className="flex-1 h-9 px-3 border rounded border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      {/* Option D (Ẩn ở Part 2 vì Part 2 chỉ có 3 đáp án) */}
                      {part !== 2 && (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center shrink-0">
                            D
                          </div>
                          <input
                            type="text"
                            value={optionD}
                            onChange={(e) => setOptionD(e.target.value)}
                            placeholder={t('createQuestionPage.inputOptionPlaceholder', { key: 'D' })}
                            className="flex-1 h-9 px-3 border rounded border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Cột con 2: Tài nguyên đính kèm (Chỉ hiển thị cho Part 1 và Part 2) */}
                {(part === 1 || part === 2) && (
                  <div className="bg-white border rounded border-slate-200 p-5 shadow-xs space-y-4 flex flex-col justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 mb-3">
                        {t('createQuestionPage.questionResourcesCardTitle')}
                      </h2>

                      {/* Tabs hình ảnh / audio */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {part === 1 && (
                          <button
                            type="button"
                            onClick={() => setAttachmentTab('image')}
                            className={`px-3 py-1.5 border rounded text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                              attachmentTab === 'image'
                                ? 'bg-blue-50 border-blue-500 text-blue-700'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <ImageIcon className="h-3.5 w-3.5 text-blue-600" />
                            <span>{t('createQuestionPage.tabImagePart1')}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setAttachmentTab('audio')}
                          className={`px-3 py-1.5 border rounded text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                            attachmentTab === 'audio'
                              ? 'bg-blue-50 border-blue-500 text-blue-700'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Volume2 className="h-3.5 w-3.5 text-blue-600" />
                          <span>{t('createQuestionPage.tabAudioQuestion')}</span>
                        </button>
                      </div>

                      {/* Tab Image Upload */}
                      {attachmentTab === 'image' && part === 1 && (
                        <div className="space-y-3 pt-3">
                          <input
                            type="file"
                            ref={imageInputRef}
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file, 'single-image');
                              e.target.value = '';
                            }}
                          />

                          <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const file = e.dataTransfer.files?.[0];
                              if (file && file.type.startsWith('image/')) {
                                handleFileUpload(file, 'single-image');
                              }
                            }}
                            className="border rounded border-slate-200 hover:border-blue-400 p-5 text-center space-y-2 bg-slate-50/50 transition-colors"
                          >
                            <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                              {isUploading ? (
                                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                              ) : (
                                <ImageIcon className="h-4 w-4" />
                              )}
                            </div>
                            <div className="text-xs text-slate-600">
                              {isUploading ? t('createQuestionPage.uploadingImage') : t('createQuestionPage.dropImageHint')}
                            </div>
                            <button
                              type="button"
                              disabled={isUploading}
                              onClick={() => imageInputRef.current?.click()}
                              className="px-3.5 py-1.5 border rounded border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {t('createQuestionPage.chooseImageFromDevice')}
                            </button>
                          </div>

                          {/* Điền link URL ảnh trực tiếp */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-600">
                              {t('createQuestionPage.orDirectImageUrl')}
                            </label>
                            <input
                              type="url"
                              value={imageUrl}
                              onChange={(e) => {
                                setImageUrl(e.target.value);
                                if (e.target.value && !imageFileName) {
                                  setImageFileName('image-from-link');
                                }
                              }}
                              placeholder="https://example.com/photo.jpg"
                              className="w-full h-9 px-3 border rounded border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          {imageUrl && (
                            <div className="p-2.5 border rounded border-slate-200 bg-white flex items-center justify-between gap-3 shadow-xs">
                              <img
                                src={imageUrl}
                                alt="Preview"
                                className="w-12 h-10 border rounded border-slate-200 object-cover shrink-0"
                              />
                              <div className="flex-1 min-w-0 text-xs truncate font-medium text-slate-800">
                                {imageFileName || t('createQuestionPage.singleImageBadge')}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setImageUrl('');
                                  setImageFileName('');
                                }}
                                className="text-red-500 hover:text-red-700 p-1.5 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tab Audio Upload */}
                      {attachmentTab === 'audio' && (part === 1 || part === 2) && (
                        <div className="space-y-3 pt-3">
                          <input
                            type="file"
                            ref={audioInputRef}
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file, 'single-audio');
                              e.target.value = '';
                            }}
                          />

                          <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const file = e.dataTransfer.files?.[0];
                              if (file && file.type.startsWith('audio/')) {
                                handleFileUpload(file, 'single-audio');
                              }
                            }}
                            className="border rounded border-slate-200 hover:border-blue-400 p-5 text-center space-y-2 bg-slate-50/50"
                          >
                            <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                              {isUploading ? (
                                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                              ) : (
                                <Volume2 className="h-4 w-4" />
                              )}
                            </div>
                            <div className="text-xs text-slate-600">
                              {isUploading ? t('createQuestionPage.uploadingAudio') : t('createQuestionPage.dropAudioSingleHint')}
                            </div>
                            <button
                              type="button"
                              disabled={isUploading}
                              onClick={() => audioInputRef.current?.click()}
                              className="px-3.5 py-1.5 border rounded border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {t('createQuestionPage.chooseAudioFromDevice')}
                            </button>
                          </div>

                          {/* Điền link URL audio trực tiếp */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-600">
                              {t('createQuestionPage.orDirectAudioUrl')}
                            </label>
                            <input
                              type="url"
                              value={audioUrl}
                              onChange={(e) => {
                                setAudioUrl(e.target.value);
                                if (e.target.value && !audioFileName) {
                                  setAudioFileName('audio-from-link.mp3');
                                }
                              }}
                              placeholder="https://example.com/audio.mp3"
                              className="w-full h-9 px-3 border rounded border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          {audioUrl && (
                            <div className="p-2.5 border rounded border-slate-200 bg-white space-y-2 shadow-xs">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-800 truncate">
                                  {audioFileName || t('createQuestionPage.singleAudioBadge')}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAudioUrl('');
                                    setAudioFileName('');
                                  }}
                                  className="text-red-500 hover:text-red-700 font-semibold cursor-pointer"
                                >
                                  {t('createQuestionPage.deleteBtn')}
                                </button>
                              </div>
                              <audio controls src={audioUrl} className="w-full h-8" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Card 4: Đáp án đúng & Giải thích */}
              <div className="bg-white border rounded border-slate-200 p-5 shadow-xs space-y-3">
                <h2 className="text-base font-bold text-slate-900">
                  {t('createQuestionPage.answersExplanationTitle')}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  {/* Đáp án đúng */}
                  <div className="md:col-span-4 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800">
                      {t('createQuestionPage.correctAnswerLabel')} <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      {(part === 2 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D']).map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setCorrectAnswer(key as any)}
                          className={`w-9 h-9 border rounded font-bold text-xs transition-all cursor-pointer ${
                            correctAnswer === key
                              ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Giải thích */}
                  <div className="md:col-span-8 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800">
                      {t('createQuestionPage.explanationLabel')}
                    </label>
                    <textarea
                      rows={2}
                      value={explanation}
                      onChange={(e) => setExplanation(e.target.value)}
                      placeholder={t('createQuestionPage.explanationPlaceholder')}
                      className="w-full p-2.5 border rounded border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (4 cols sticky): Live Preview & Guide */}
        <div className="lg:col-span-4 space-y-5 sticky top-20">
          {/* Card Guide */}
          <div className="bg-white border rounded border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <BookOpen className="h-4 w-4 text-blue-600" />
              <span>{t('createQuestionPage.guidePartCharacteristics', { part })}</span>
            </div>

            <div className="text-xs text-slate-600 space-y-2">
              {part === 1 && (
                <p>
                  <strong>Part 1</strong>: {t('createQuestionPage.guidePart1')}
                </p>
              )}
              {part === 2 && (
                <p>
                  <strong>Part 2</strong>: {t('createQuestionPage.guidePart2')}
                </p>
              )}
              {part === 3 && (
                <p>
                  <strong>Part 3</strong>: {t('createQuestionPage.guidePart3')}
                </p>
              )}
              {part === 4 && (
                <p>
                  <strong>Part 4</strong>: {t('createQuestionPage.guidePart4')}
                </p>
              )}
              {part === 5 && (
                <p>
                  <strong>Part 5</strong>: {t('createQuestionPage.guidePart5')}
                </p>
              )}
              {part === 6 && (
                <p>
                  <strong>Part 6</strong>: {t('createQuestionPage.guidePart6')}
                </p>
              )}
              {part === 7 && (
                <p>
                  <strong>Part 7</strong>: {t('createQuestionPage.guidePart7')}
                </p>
              )}
            </div>
          </div>

          {/* Card Live Preview */}
          <div className="bg-white border rounded border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Eye className="h-4 w-4 text-blue-600" />
                <span>{t('createQuestionPage.livePreviewTitle')}</span>
              </div>
              <span className="text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                Part {part}
              </span>
            </div>

            {/* Live Preview for Group Mode */}
            {isGroupPart ? (
              <div className="space-y-3 text-xs">
                {groupType === 'AUDIO' ? (
                  <div className="p-3 bg-slate-50 border rounded border-slate-200 space-y-2">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Volume2 className="h-4 w-4 text-indigo-600" />
                      <span>{groupTitle || t('createQuestionPage.previewSharedAudio')}</span>
                    </div>
                    {groupAudioUrl ? (
                      <audio controls src={groupAudioUrl} className="w-full h-8" />
                    ) : (
                      <p className="text-slate-400 italic text-[11px]">{t('createQuestionPage.previewNoAudio')}</p>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border rounded border-slate-200 space-y-2">
                    <div className="font-bold text-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        {readingPassageType === 'image' ? (
                          <ImageIcon className="h-4 w-4 text-teal-600 shrink-0" />
                        ) : (
                          <FileText className="h-4 w-4 text-teal-600 shrink-0" />
                        )}
                        <span className="truncate">{groupTitle || t('createQuestionPage.previewSharedReading')}</span>
                      </div>
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 shrink-0">
                        {readingPassageType === 'image' ? t('createQuestionPage.readingTypeImage') : t('createQuestionPage.readingTypeText')}
                      </span>
                    </div>

                    {readingPassageType === 'image' ? (
                      groupImageUrl ? (
                        <div className="border rounded border-slate-200 overflow-hidden bg-white p-1">
                          <img
                            src={groupImageUrl}
                            alt="Reading Preview"
                            className="w-full max-h-48 object-contain bg-slate-50 rounded"
                          />
                        </div>
                      ) : (
                        <p className="text-slate-400 italic text-[11px]">{t('createQuestionPage.previewNoReadingImage')}</p>
                      )
                    ) : groupContent ? (
                      <p className="text-slate-600 text-[11px] line-clamp-4 italic bg-white p-2 border rounded border-slate-200 whitespace-pre-line">
                        {groupContent}
                      </p>
                    ) : (
                      <p className="text-slate-400 italic text-[11px]">{t('createQuestionPage.previewNoReading')}</p>
                    )}
                  </div>
                )}

                {/* Sub questions summary */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    {t('createQuestionPage.previewSubQuestionsCount', { count: subQuestions.length })}
                  </span>
                  {subQuestions.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      onClick={() => setActiveSubIndex(idx)}
                      className={`p-2.5 border rounded cursor-pointer transition-all ${
                        activeSubIndex === idx
                          ? 'border-blue-400 bg-blue-50/50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-[11px]">
                        <span>{t('createQuestionPage.previewQuestionNum', { num: order + idx })}</span>
                        <span className="px-1.5 py-0.5 border rounded bg-blue-100 border-blue-200 text-blue-700">
                          {t('createQuestionPage.previewAnswerLabel', { answer: q.correctAnswer })}
                        </span>
                      </div>
                      <p className="text-slate-700 truncate mt-1 text-xs">
                        {q.content.trim() || <span className="text-slate-400 italic">{t('createQuestionPage.previewNoContent')}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Live Preview for Single Question
              <div className="space-y-3 text-xs">
                {imageUrl && (
                  <div className="border rounded border-slate-200 overflow-hidden">
                    <img src={imageUrl} alt="Preview" className="w-full h-36 object-cover" />
                  </div>
                )}
                {audioUrl && (
                  <div className="p-2 bg-slate-50 border rounded border-slate-200">
                    <audio controls src={audioUrl} className="w-full h-8" />
                  </div>
                )}

                <div className="font-bold text-slate-900 text-xs">
                  Q. {content.trim() ? content : <span className="text-slate-400 font-normal italic">{t('createQuestionPage.previewNoQuestion')}</span>}
                </div>

                <div className="space-y-1.5">
                  <div className={`p-2 border rounded flex items-center justify-between ${correctAnswer === 'A' ? 'bg-blue-50 border-blue-300 font-bold' : 'border-slate-200 bg-white'}`}>
                    <span>A. {optionA.trim() || <span className="text-slate-400 italic">{t('createQuestionPage.previewOption', { opt: 'A' })}</span>}</span>
                    {correctAnswer === 'A' && <Check className="h-3.5 w-3.5 text-blue-600" />}
                  </div>
                  <div className={`p-2 border rounded flex items-center justify-between ${correctAnswer === 'B' ? 'bg-emerald-50 border-emerald-300 font-bold' : 'border-slate-200 bg-white'}`}>
                    <span>B. {optionB.trim() || <span className="text-slate-400 italic">{t('createQuestionPage.previewOption', { opt: 'B' })}</span>}</span>
                    {correctAnswer === 'B' && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                  </div>
                  <div className={`p-2 border rounded flex items-center justify-between ${correctAnswer === 'C' ? 'bg-amber-50 border-amber-300 font-bold' : 'border-slate-200 bg-white'}`}>
                    <span>C. {optionC.trim() || <span className="text-slate-400 italic">{t('createQuestionPage.previewOption', { opt: 'C' })}</span>}</span>
                    {correctAnswer === 'C' && <Check className="h-3.5 w-3.5 text-amber-600" />}
                  </div>
                  {part !== 2 && (
                    <div className={`p-2 border rounded flex items-center justify-between ${correctAnswer === 'D' ? 'bg-rose-50 border-rose-300 font-bold' : 'border-slate-200 bg-white'}`}>
                      <span>D. {optionD.trim() || <span className="text-slate-400 italic">{t('createQuestionPage.previewOption', { opt: 'D' })}</span>}</span>
                      {correctAnswer === 'D' && <Check className="h-3.5 w-3.5 text-rose-600" />}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <Link
                href={`/${locale}/assessment/${examId}`}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              >
                {t('createPage.cancel')}
              </Link>

              <button
                type="button"
                onClick={handleManualReset}
                title={t('createQuestionPage.resetFormBtn')}
                className="px-3 py-2 border rounded border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{t('createQuestionPage.resetFormBtn')}</span>
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => (isGroupPart ? handleGroupSubmit(true) : handleSingleSubmit(true))}
                className="px-4 py-2 border rounded border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
              >
                {t('createPage.saveDraft')}
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => (isGroupPart ? handleGroupSubmit(false) : handleSingleSubmit(false))}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 rounded text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>{t('createQuestionPage.savingBtn')}</span>
                  </>
                ) : (
                  <span>{isGroupPart ? t('createQuestionPage.saveGroupBtn', { count: subQuestions.length }) : t('createQuestionPage.saveSingleBtn')}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
