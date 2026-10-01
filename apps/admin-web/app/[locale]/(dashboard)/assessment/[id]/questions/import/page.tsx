'use client';

import React, { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { examService } from '@/services/assessment.service';
import { ExamItem, QuestionItem } from '@/types';
import {
  getAvailableParts,
  parseQuestionsFromText,
  generateWordTemplateHtml,
  generateTxtTemplate,
  shouldShowQuestionImageInput,
  shouldShowQuestionAudioInput,
  ExamPartConfig,
} from '@/components/assessment/import-parts-config';
import {
  FileText,
  Upload,
  Download,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  FileCode,
  ChevronRight,
  ArrowLeft,
  X,
  Loader2,
  Home,
  BookOpen,
  Headphones,
  Eye,
  Layers,
  RotateCcw,
  ClipboardPaste,
  Trash2,
  Plus,
  Image as ImageIcon,
  Volume2,
} from 'lucide-react';

export default function ImportQuestionsPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const examId = params?.id as string;
  const { t } = useTranslation('assessment');
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Query exam details
  const { data: examResponse, isLoading: isLoadingExam } = useQuery({
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

  // Steps: 1 = Chọn Part, 2 = Nhập / Upload file, 3 = Xem trước & Import
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPartId, setSelectedPartId] = useState<number>(1);
  const [filterSection, setFilterSection] = useState<'ALL' | 'LISTENING' | 'READING'>('ALL');

  // Input mode: 'paste' (Dán văn bản trực tiếp) or 'upload' (Tải file Word/PDF)
  const [inputMode, setInputMode] = useState<'paste' | 'upload'>('paste');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileContent, setFileContent] = useState<string>('');

  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parsed questions state
  const [parsedPassage, setParsedPassage] = useState<{
    title?: string;
    content?: string;
    audioUrl?: string;
    imageUrl?: string;
  } | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<Partial<QuestionItem>[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  // Available parts
  const availableParts = useMemo(() => getAvailableParts(exam, locale), [exam, locale]);

  const currentPart = useMemo(() => {
    return availableParts.find((p) => p.id === selectedPartId) || availableParts[0] || null;
  }, [availableParts, selectedPartId]);

  // Keep selectedPartId valid
  React.useEffect(() => {
    if (availableParts.length > 0 && !availableParts.some((p) => p.id === selectedPartId)) {
      const first = availableParts[0];
      if (first) setSelectedPartId(first.id);
    }
  }, [availableParts, selectedPartId]);

  // Copy sample
  const handleCopySample = () => {
    if (!currentPart) return;
    navigator.clipboard.writeText(currentPart.sampleText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Paste from clipboard into textarea
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setFileContent(text);
        setErrorMessage(null);
      }
    } catch {
      // Browser permissions may block
    }
  };

  // Load sample into textarea
  const handleLoadSampleIntoEditor = () => {
    if (currentPart) {
      setFileContent(currentPart.sampleText);
    }
  };

  // Download Word template
  const handleDownloadWordTemplate = () => {
    if (!currentPart) return;
    const filename = `Mau_Import_${exam.type || 'TOEIC'}_Part_${currentPart.id}.doc`;
    const htmlContent = generateWordTemplateHtml(exam.name || 'TOEIC Exam', exam.type || 'TOEIC', currentPart, locale);
    const blob = new Blob([htmlContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download plain text template
  const handleDownloadTxtTemplate = () => {
    if (!currentPart) return;
    const filename = `Mau_Import_${exam.type || 'TOEIC'}_Part_${currentPart.id}.txt`;
    const txtContent = generateTxtTemplate(exam.name || 'TOEIC Exam', exam.type || 'TOEIC', currentPart, locale);
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // File selection
  const handleFileSelect = (file: File) => {
    setErrorMessage(null);
    const validExtensions = ['.docx', '.doc', '.pdf', '.txt'];
    const lowerName = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isValid) {
      setErrorMessage(t('importModal.msg.invalidFormat'));
      return;
    }

    setSelectedFile(file);

    if (lowerName.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setFileContent(text);
      };
      reader.readAsText(file, 'UTF-8');
    }
  };

  // Proceed to Preview
  const handleProceedToPreview = async () => {
    if (!currentPart) return;
    setErrorMessage(null);

    // If a Word or PDF file is uploaded and textarea is empty, parse via backend API
    if (selectedFile && !selectedFile.name.toLowerCase().endsWith('.txt') && !fileContent.trim()) {
      setIsAnalyzing(true);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('part', String(currentPart.id));
        formData.append('section', currentPart.section);

        const res = await examService.parseQuestions(exam._id, formData);
        const result = (res as any)?.data || res;

        if (result && Array.isArray(result.questions) && result.questions.length > 0) {
          setParsedPassage(result.passage || null);
          setParsedQuestions(result.questions);
          setStep(3);
        } else {
          setErrorMessage(t('importModal.msg.noQuestionsFound'));
        }
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || t('importModal.msg.noQuestionsFound');
        setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
      } finally {
        setIsAnalyzing(false);
      }
      return;
    }

    // Otherwise parse from text (either pasted or read from .txt)
    const textToParse = fileContent.trim();
    if (!textToParse) {
      setErrorMessage(t('importModal.pleaseInputContent'));
      return;
    }

    const { passage, questions } = parseQuestionsFromText(textToParse, currentPart);

    if (questions.length === 0) {
      setErrorMessage(t('importModal.msg.noQuestionsFound'));
      return;
    }

    setParsedPassage(passage);
    setParsedQuestions(questions);
    setStep(3);
  };

  // Handlers for inline editing in Step 3
  const handleUpdateQuestion = (index: number, field: keyof QuestionItem, value: any) => {
    setParsedQuestions((prev) => {
      const next = [...prev];
      const item = next[index];
      if (item) {
        next[index] = { ...item, [field]: value };
      }
      return next;
    });
  };

  const handleUpdateOption = (qIndex: number, optKey: 'A' | 'B' | 'C' | 'D', text: string) => {
    setParsedQuestions((prev) => {
      const next = [...prev];
      const q = next[qIndex];
      if (q && q.options) {
        next[qIndex] = {
          ...q,
          options: q.options.map((opt) => (opt.key === optKey ? { ...opt, text } : opt)),
        };
      }
      return next;
    });
  };

  const handleDeleteQuestion = (index: number) => {
    setParsedQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddQuestion = () => {
    setParsedQuestions((prev) => [
      ...prev,
      {
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
  };

  const handleUpdatePassage = (
    field: 'title' | 'content' | 'audioUrl' | 'imageUrl',
    value: string,
  ) => {
    setParsedPassage((prev) => {
      if (!prev) return { [field]: value };
      return { ...prev, [field]: value };
    });
  };

  // Confirm Import
  const handleConfirmImport = async () => {
    if (!currentPart || parsedQuestions.length === 0) return;
    setIsImporting(true);
    setErrorMessage(null);

    try {
      const res = await examService.importQuestions(exam._id, {
        part: currentPart.id,
        passage: parsedPassage || undefined,
        questions: parsedQuestions,
      });

      queryClient.invalidateQueries({ queryKey: ['admin-exam-questions', exam._id] });
      queryClient.invalidateQueries({ queryKey: ['admin-exam-passages', exam._id] });
      queryClient.invalidateQueries({ queryKey: ['admin-exam', exam._id] });

      const importedTotal =
        (res as any)?.data?.importedCount || (res as any)?.importedCount || parsedQuestions.length;
      setImportSuccessMessage(
        t('importModal.msg.importSuccess', { count: importedTotal, part: currentPart.id })
      );
      setTimeout(() => {
        router.push(`/${locale}/assessment/${examId}`);
      }, 1500);
    } catch (err: any) {
      console.warn('API import failed, trying fallback sequential question creation:', err);

      try {
        let createdPassageId: string | undefined = undefined;

        if (
          parsedPassage &&
          (parsedPassage.title || parsedPassage.content || parsedPassage.audioUrl || parsedPassage.imageUrl)
        ) {
          const passageRes = await examService.createPassage({
            examId: exam._id,
            section: currentPart.section,
            title: parsedPassage.title || `Passage Part ${currentPart.id}`,
            content: parsedPassage.content || '',
            audioUrl: parsedPassage.audioUrl,
            imageUrl: parsedPassage.imageUrl,
            order: 1,
          });
          createdPassageId = (passageRes as any)?.data?._id || (passageRes as any)?._id;
        }

        const total = parsedQuestions.length;
        let count = 0;
        for (const q of parsedQuestions) {
          count++;
          setImportProgress({ current: count, total });

          await examService.createQuestion({
            examId: exam._id,
            section: currentPart.section,
            part: currentPart.id,
            content: q.content || 'Câu hỏi',
            options: q.options || [],
            correctAnswer: q.correctAnswer || 'A',
            explanation: q.explanation || '',
            order: count,
            status: 'ACTIVE',
            passageId: createdPassageId,
            passageTitle: parsedPassage?.title,
            imageUrl: q.imageUrl,
            audioUrl: q.audioUrl,
          });
        }

        queryClient.invalidateQueries({ queryKey: ['admin-exam-questions', exam._id] });
        queryClient.invalidateQueries({ queryKey: ['admin-exam-passages', exam._id] });
        queryClient.invalidateQueries({ queryKey: ['admin-exam', exam._id] });

        setImportSuccessMessage(
          t('importModal.msg.importSuccess', { count: total, part: currentPart.id })
        );
        setTimeout(() => {
          router.push(`/${locale}/assessment/${examId}`);
        }, 1500);
      } catch (fallbackErr: any) {
        const msg =
          fallbackErr.response?.data?.message ||
          fallbackErr.message ||
          t('importModal.msg.importError');
        setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
      }
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  // Word & Line stats for pasted text
  const textStats = useMemo(() => {
    if (!fileContent) return { lines: 0, chars: 0 };
    const lines = fileContent.split('\n').filter((l) => l.trim().length > 0).length;
    return { lines, chars: fileContent.length };
  }, [fileContent]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 space-y-6 w-full">
      {/* 1. Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
        <Link href={`/${locale}/assessment`} className="hover:text-blue-600 transition-colors flex items-center gap-1">
          <Home className="h-3.5 w-3.5" />
          <span>{exam.type || 'TOEIC'}</span>
        </Link>
        <span>&rsaquo;</span>
        <Link href={`/${locale}/assessment`} className="hover:text-blue-600 transition-colors">
          {t('importModal.breadcrumbExam')}
        </Link>
        <span>&rsaquo;</span>
        <Link href={`/${locale}/assessment/${examId}`} className="hover:text-blue-600 transition-colors truncate max-w-xs">
          {exam.name || t('createQuestionPage.breadcrumbDetail')}
        </Link>
        <span>&rsaquo;</span>
        <span className="font-semibold text-slate-900">{t('importModal.breadcrumbImport')}</span>
      </div>

      {/* 2. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Upload className="h-6 w-6 text-blue-600" />
              <span>{t('importModal.pageTitle')}</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-bold border bg-blue-50 border-blue-200 text-blue-700">
              {exam.type || 'TOEIC'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('importModal.examHeaderSub', { name: exam.name })}
          </p>
        </div>

        <Link
          href={`/${locale}/assessment/${examId}`}
          className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer w-fit shadow-2xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{t('importModal.backToExamBtn')}</span>
        </Link>
      </div>

      {/* 3. Steps Navigation Bar */}
      <div className="bg-white border rounded border-slate-200/90 p-4 shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-6 text-xs flex-wrap">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex items-center gap-2 font-semibold cursor-pointer transition-colors ${
              step === 1 ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${
                step === 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              1
            </span>
            <span>{t('importModal.step1Nav')}</span>
          </button>

          <ChevronRight className="h-4 w-4 text-slate-300" />

          <button
            type="button"
            onClick={() => setStep(2)}
            className={`flex items-center gap-2 font-semibold cursor-pointer transition-colors ${
              step === 2 ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${
                step === 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              2
            </span>
            <span>{t('importModal.step2Nav')}</span>
          </button>

          <ChevronRight className="h-4 w-4 text-slate-300" />

          <button
            type="button"
            disabled={parsedQuestions.length === 0}
            onClick={() => {
              if (parsedQuestions.length > 0) setStep(3);
            }}
            className={`flex items-center gap-2 font-semibold transition-colors ${
              step === 3
                ? 'text-blue-600'
                : parsedQuestions.length > 0
                ? 'text-slate-500 hover:text-slate-800 cursor-pointer'
                : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${
                step === 3
                  ? 'bg-blue-600 text-white'
                  : parsedQuestions.length > 0
                  ? 'bg-slate-200 text-slate-700'
                  : 'bg-slate-100 text-slate-300'
              }`}
            >
              3
            </span>
            <span>{t('importModal.step3Nav', { count: parsedQuestions.length })}</span>
          </button>
        </div>

        {currentPart && (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span className="text-slate-400">{t('importModal.selectedPartLabel')}</span>
            <span className={`px-2.5 py-1 rounded font-bold ${currentPart.tagBg}`}>
              Part {currentPart.id} – {currentPart.title}
            </span>
          </div>
        )}
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded flex items-center gap-2.5 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="flex-1 font-medium">{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {importSuccessMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded flex items-center gap-2.5 text-xs text-emerald-800 font-semibold animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{importSuccessMessage}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 1: CHỌN PART CÂU HỎI                                      */}
      {/* ============================================================== */}
      {step === 1 && (
        <div className="bg-white border rounded border-slate-200/90 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {t('importModal.step1PageTitle')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('importModal.step1PageSubtitle')}
              </p>
            </div>

            {/* Filter buttons if full test */}
            {exam.section === 'FULL_TEST' && (
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded text-xs">
                <button
                  type="button"
                  onClick={() => setFilterSection('ALL')}
                  className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                    filterSection === 'ALL' ? 'bg-white shadow-xs text-blue-600 font-bold' : 'text-slate-600'
                  }`}
                >
                  {t('detailPage.filterAll')}
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSection('LISTENING')}
                  className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                    filterSection === 'LISTENING' ? 'bg-white shadow-xs text-blue-600 font-bold' : 'text-slate-600'
                  }`}
                >
                  Listening
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSection('READING')}
                  className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                    filterSection === 'READING' ? 'bg-white shadow-xs text-blue-600 font-bold' : 'text-slate-600'
                  }`}
                >
                  Reading
                </button>
              </div>
            )}
          </div>

          {/* Grid Parts Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {availableParts
              .filter((p) => {
                if (filterSection === 'LISTENING') return p.section === 'LISTENING';
                if (filterSection === 'READING') return p.section === 'READING';
                return true;
              })
              .map((p) => {
                const isSelected = selectedPartId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPartId(p.id)}
                    className={`relative p-5 rounded border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/30 shadow-xs ring-1 ring-blue-500/20'
                        : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded ${p.tagBg}`}>
                          Part {p.id}
                        </span>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                      </div>
                      <h3 className="text-sm font-bold text-slate-800">{p.title}</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">{p.desc}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">{p.badge}</span>
                      <span className="text-slate-400">{p.questionCountHint}</span>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <span>{t('importModal.continueToStep2Btn')}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 2: NHẬP VĂN BẢN TRỰC TIẾP HOẶC TẢI FILE                   */}
      {/* ============================================================== */}
      {step === 2 && currentPart && (
        <div className="space-y-5">
          {/* Main 12-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 8 cols: Big Editor / Uploader */}
            <div className="lg:col-span-8 bg-white border rounded border-slate-200/90 p-5 md:p-6 shadow-xs space-y-4">
              {/* Mode Switcher Tabs */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInputMode('paste')}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition-all cursor-pointer ${
                      inputMode === 'paste'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                    <span>{t('importModal.pasteTabRecommend')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputMode('upload')}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition-all cursor-pointer ${
                      inputMode === 'upload'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Upload className="h-4 w-4" />
                    <span>{t('importModal.uploadFileTab')}</span>
                  </button>
                </div>

                {inputMode === 'paste' && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                      title={t('importModal.pasteClipboardBtn')}
                    >
                      <ClipboardPaste className="h-3.5 w-3.5 text-blue-600" />
                      <span>{t('importModal.pasteClipboardBtn')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleLoadSampleIntoEditor}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                      title={t('importModal.loadSampleBtn', { part: currentPart.id })}
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-blue-600" />
                      <span>{t('importModal.loadSampleBtn', { part: currentPart.id })}</span>
                    </button>

                    {fileContent && (
                      <button
                        type="button"
                        onClick={() => setFileContent('')}
                        className="px-2.5 py-1.5 hover:bg-red-50 text-red-600 rounded text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                        title={t('importModal.clearContentBtn')}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>{t('importModal.clearBtn')}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Mode 1: Full-Width Spacious Editor */}
              {inputMode === 'paste' && (
                <div className="space-y-2">
                  <div className="relative">
                    <textarea
                      rows={20}
                      value={fileContent}
                      onChange={(e) => setFileContent(e.target.value)}
                      placeholder={currentPart.sampleText}
                      className="w-full p-4 border rounded border-slate-200 bg-slate-50/40 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white leading-relaxed resize-y min-h-[460px]"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                    <span>
                      {t('importModal.pastedStats', { lines: textStats.lines, chars: textStats.chars })}
                    </span>
                    <span className="text-slate-400">
                      {t('importModal.pasteFormatHint')}
                    </span>
                  </div>
                </div>
              )}

              {/* Mode 2: File Upload Container */}
              {inputMode === 'upload' && (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files?.[0]) {
                        handleFileSelect(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-3 min-h-[300px] ${
                      isDragging
                        ? 'border-blue-600 bg-blue-50/70 scale-[0.99]'
                        : selectedFile
                        ? 'border-emerald-300 bg-emerald-50/30'
                        : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".docx,.doc,.pdf,.txt"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleFileSelect(e.target.files[0]);
                        }
                      }}
                    />

                    <div
                      className={`w-14 h-14 rounded flex items-center justify-center shadow-xs ${
                        selectedFile ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      {selectedFile ? <FileText className="h-7 w-7" /> : <Upload className="h-7 w-7" />}
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-800">
                        {selectedFile ? selectedFile.name : t('importModal.dragDropFileTitle')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {t('importModal.dragDropFileSub')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">.DOCX</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">.DOC</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-800">.PDF</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">{t('importModal.maxSizeLimit')}</span>
                    </div>
                  </div>

                  {selectedFile && (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{selectedFile.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {t('importModal.readyToAnalyze', { size: (selectedFile.size / 1024).toFixed(1) })}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          setFileContent('');
                        }}
                        className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-red-500 transition-colors"
                        title={t('importModal.removeFileTooltip')}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Action Bottom Bar */}
              <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>{t('importModal.changePartBtn')}</span>
                </button>

                <button
                  type="button"
                  disabled={isAnalyzing || (!fileContent.trim() && !selectedFile)}
                  onClick={handleProceedToPreview}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{t('importModal.analyzingBtn')}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('importModal.proceedToPreviewBtn')}</span>
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right 4 cols: Template & Part-Specific Exercise Type Reference */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white border rounded border-slate-200/90 p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <FileCode className="h-4 w-4 text-blue-600 shrink-0" />
                      <span>{t('importModal.standardFormatTitle', { part: currentPart.id })}</span>
                    </div>
                    {(locale === 'en' ? currentPart.exerciseTypeNameEn : currentPart.exerciseTypeName) && (
                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {locale === 'en' ? currentPart.exerciseTypeNameEn : currentPart.exerciseTypeName}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleDownloadWordTemplate}
                      className="p-1.5 hover:bg-blue-50 text-blue-600 rounded text-xs font-semibold transition-colors"
                      title={t('importModal.downloadWordDoc')}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCopySample}
                      className="p-1.5 hover:bg-slate-100 text-slate-600 rounded text-xs font-semibold transition-colors"
                      title={t('importModal.copySampleBtn')}
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {(locale === 'en' ? currentPart.exerciseTypeDescEn : currentPart.exerciseTypeDesc) && (
                  <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-200/70">
                    {locale === 'en' ? currentPart.exerciseTypeDescEn : currentPart.exerciseTypeDesc}
                  </p>
                )}

                <div className="relative">
                  <pre className="p-3.5 rounded bg-slate-900 text-slate-100 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-[300px] border border-slate-800 scrollbar-thin select-all">
                    <code>{currentPart.sampleText}</code>
                  </pre>
                </div>

                {/* Dynamic format rules according to Part and Exercise Type */}
                <div className="pt-2 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                  <p className="font-bold text-slate-800">
                    {t('importModal.quickSyntaxRules', { part: currentPart.id })}
                  </p>
                  <ul className="space-y-1.5 text-[11px] list-disc pl-4 text-slate-600">
                    {(locale === 'en' ? currentPart.formatRulesEn : currentPart.formatRules)?.map((rule, rIdx) => (
                      <li key={rIdx}>{rule}</li>
                    ))}
                  </ul>
                </div>

                <div className="pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadWordTemplate}
                    className="flex-1 py-2 border border-blue-200 bg-blue-50/50 hover:bg-blue-100/60 text-blue-700 rounded text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{t('importModal.downloadWordDoc')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadTxtTemplate}
                    className="py-2 px-3 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>.{t('importModal.downloadTxt')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 3: XEM TRƯỚC DANH SÁCH CÂU HỎI & XÁC NHẬN IMPORT          */}
      {/* ============================================================== */}
      {step === 3 && currentPart && (
        <div className="bg-white border rounded border-slate-200/90 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {t('importModal.step3PageTitle')}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  {t('importModal.step3ValidCount', { count: parsedQuestions.length })}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('importModal.step3Subtitle')}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{t('importModal.backToContentBtn')}</span>
              </button>

              <button
                type="button"
                disabled={isImporting || parsedQuestions.length === 0}
                onClick={handleConfirmImport}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>
                      {importProgress
                        ? t('importModal.savingProgress', { current: importProgress.current, total: importProgress.total })
                        : t('importModal.savingToExam')}
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{t('importModal.confirmImportPart', { count: parsedQuestions.length, part: currentPart.id })}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Attached Passage Card if exists */}
          {parsedPassage && (
            <div className="p-4 rounded border border-indigo-200 bg-indigo-50/40 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                <BookOpen className="h-4 w-4 text-indigo-600" />
                <span>{t('importModal.passageCardTitle')}</span>
              </div>
              <input
                type="text"
                value={parsedPassage.title || ''}
                onChange={(e) => handleUpdatePassage('title', e.target.value)}
                placeholder={t('importModal.passageTitlePlaceholder')}
                className="w-full text-xs font-bold text-indigo-950 p-2 rounded border border-indigo-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <textarea
                rows={3}
                value={parsedPassage.content || ''}
                onChange={(e) => handleUpdatePassage('content', e.target.value)}
                placeholder={t('importModal.passageContentPlaceholder')}
                className="w-full text-xs text-slate-700 p-2.5 rounded border border-indigo-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y leading-relaxed font-mono"
              />

              {/* Passage Audio (cho Listening có passage: Part 3, 4) */}
              {currentPart.hasAudio && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded border border-indigo-200">
                  <Volume2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <input
                    type="text"
                    value={parsedPassage.audioUrl || ''}
                    onChange={(e) => handleUpdatePassage('audioUrl', e.target.value)}
                    placeholder="URL file audio đoạn hội thoại / bài nói..."
                    className="w-full bg-transparent text-[11px] text-slate-700 focus:outline-none"
                  />
                </div>
              )}

              {/* Passage Image (cho Reading có passage ảnh: Part 6, 7) */}
              {currentPart.section === 'READING' && currentPart.hasImage && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded border border-indigo-200">
                  <ImageIcon className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <input
                    type="text"
                    value={parsedPassage.imageUrl || ''}
                    onChange={(e) => handleUpdatePassage('imageUrl', e.target.value)}
                    placeholder="URL ảnh chụp bài đọc (nếu dùng hình ảnh scan thay văn bản)..."
                    className="w-full bg-transparent text-[11px] text-slate-700 focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Editable Questions List */}
          <div className="space-y-4">
            {parsedQuestions.map((q, idx) => {
              const showImg = shouldShowQuestionImageInput(currentPart, q);
              const showAud = shouldShowQuestionAudioInput(currentPart, q);

              return (
                <div
                  key={idx}
                  className="p-5 rounded border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-3.5 shadow-2xs"
                >
                  {/* Header: Question order + delete button */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {t('importModal.currentCorrectBadge')}{' '}
                        <strong className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {q.correctAnswer || 'A'}
                        </strong>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(idx)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                      title={t('importModal.deleteQuestionTooltip')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Question Content Input */}
                  <div>
                    <textarea
                      rows={2}
                      value={q.content || ''}
                      onChange={(e) => handleUpdateQuestion(idx, 'content', e.target.value)}
                      placeholder={t('importModal.questionContentPlaceholder')}
                      className="w-full text-xs font-semibold text-slate-800 p-3 rounded border border-slate-200 bg-slate-50/40 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y leading-relaxed"
                    />
                  </div>

                  {/* Options 4 cols (or 2 cols on mobile) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                    {q.options?.map((opt) => {
                      const isCorrect = opt.key === q.correctAnswer;
                      return (
                        <div
                          key={opt.key}
                          className={`p-1.5 rounded border flex items-center gap-2 transition-all ${
                            isCorrect
                              ? 'border-emerald-300 bg-emerald-50/60 shadow-2xs'
                              : 'border-slate-200 bg-slate-50/30 hover:border-slate-300'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleUpdateQuestion(idx, 'correctAnswer', opt.key)}
                            className={`w-7 h-7 rounded text-xs flex items-center justify-center font-bold shrink-0 cursor-pointer transition-all ${
                              isCorrect
                                ? 'bg-emerald-600 text-white shadow-xs scale-105'
                                : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
                            }`}
                            title={t('importModal.clickToSelectCorrect', { key: opt.key })}
                          >
                            {opt.key}
                          </button>

                          <input
                            type="text"
                            value={opt.text}
                            onChange={(e) => handleUpdateOption(idx, opt.key, e.target.value)}
                            placeholder={t('importModal.optionPlaceholder', { key: opt.key })}
                            className={`flex-1 text-xs px-2 py-1 rounded bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                              isCorrect ? 'font-bold text-emerald-950' : 'text-slate-800'
                            }`}
                          />

                          {isCorrect && (
                            <span className="text-[10px] font-bold text-emerald-700 pr-1 shrink-0">
                              {t('importModal.correctMark')}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Media URLs (Image / Audio) row - CHỈ hiển thị khi Part hoặc câu hỏi thật sự cần */}
                  {(showImg || showAud) && (
                    <div
                      className={`grid grid-cols-1 ${
                        showImg && showAud ? 'sm:grid-cols-2' : ''
                      } gap-2 pt-1 text-[11px]`}
                    >
                      {showImg && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 rounded border border-slate-200">
                          <ImageIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <input
                            type="text"
                            value={q.imageUrl || ''}
                            onChange={(e) => handleUpdateQuestion(idx, 'imageUrl', e.target.value)}
                            placeholder={t('importModal.imageUrlPlaceholder')}
                            className="w-full bg-transparent text-[11px] text-slate-700 focus:outline-none"
                          />
                        </div>
                      )}

                      {showAud && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 rounded border border-slate-200">
                          <Volume2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <input
                            type="text"
                            value={q.audioUrl || ''}
                            onChange={(e) => handleUpdateQuestion(idx, 'audioUrl', e.target.value)}
                            placeholder={t('importModal.audioUrlPlaceholder')}
                            className="w-full bg-transparent text-[11px] text-slate-700 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Explanation Input */}
                  <div className="flex items-center gap-2 pt-1 text-xs">
                    <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                      {t('importModal.explanationField')}
                    </span>
                    <input
                      type="text"
                      value={q.explanation || ''}
                      onChange={(e) => handleUpdateQuestion(idx, 'explanation', e.target.value)}
                      placeholder={t('importModal.explanationPlaceholder')}
                      className="flex-1 text-xs px-2.5 py-1.5 rounded border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              );
            })}

            {/* Add Question Button */}
            <button
              type="button"
              onClick={handleAddQuestion}
              className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 text-blue-600 rounded text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{t('importModal.addNewQuestionBtn')}</span>
            </button>
          </div>

          {/* Bottom Confirmation Bar */}
          <div className="pt-4 flex items-center justify-between border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{t('importModal.backToContentBtn')}</span>
            </button>

            <button
              type="button"
              disabled={isImporting || parsedQuestions.length === 0}
              onClick={handleConfirmImport}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {importProgress
                      ? t('importModal.savingProgress', { current: importProgress.current, total: importProgress.total })
                      : t('importModal.savingToExam')}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{t('importModal.confirmImportAll', { count: parsedQuestions.length })}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
