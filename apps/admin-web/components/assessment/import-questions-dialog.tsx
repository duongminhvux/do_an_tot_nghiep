'use client';

import React, { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ExamItem, QuestionItem } from '@/types';
import { examService } from '@/services/assessment.service';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  FileText,
  Upload,
  Download,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  FileCode,
  FileType,
  Layers,
  ChevronRight,
  ArrowLeft,
  X,
  Loader2,
  HelpCircle,
  BookOpen,
  Headphones,
  Eye,
  ExternalLink,
  ClipboardPaste,
  RotateCcw,
  Trash2,
  Plus,
  Image as ImageIcon,
  Volume2,
} from 'lucide-react';
import {
  getAvailableParts,
  parseQuestionsFromText,
  generateWordTemplateHtml,
  generateTxtTemplate,
  shouldShowQuestionImageInput,
  shouldShowQuestionAudioInput,
  ExamPartConfig,
} from './import-parts-config';

export type { ExamPartConfig };

interface ImportQuestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: ExamItem;
  onSuccess?: () => void;
}

export function ImportQuestionsDialog({
  open,
  onOpenChange,
  exam,
  onSuccess,
}: ImportQuestionsDialogProps) {
  const { t } = useTranslation('assessment');
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';

  // Workflow steps: 1 = Chọn Part, 2 = Chọn File & Format, 3 = Xem trước & Import
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPartId, setSelectedPartId] = useState<number>(1);
  const [filterSection, setFilterSection] = useState<'ALL' | 'LISTENING' | 'READING'>('ALL');
  
  // Input method: 'paste' | 'file'
  const [inputMethod, setInputMethod] = useState<'paste' | 'file'>('paste');

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileContent, setFileContent] = useState<string>('');
  
  // Template tab: 'sample' | 'rules'
  const [activeFormatTab, setActiveFormatTab] = useState<'sample' | 'rules'>('sample');
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

  // Generate parts configuration dynamically based on exam type, section, and locale
  const availableParts: ExamPartConfig[] = useMemo(() => getAvailableParts(exam, locale), [exam, locale]);

  // Current selected part config
  const currentPart = useMemo(() => {
    return availableParts.find((p) => p.id === selectedPartId) || availableParts[0] || null;
  }, [availableParts, selectedPartId]);

  // If initial part is not in available, select first
  React.useEffect(() => {
    if (availableParts.length > 0 && !availableParts.some((p) => p.id === selectedPartId)) {
      const first = availableParts[0];
      if (first) {
        setSelectedPartId(first.id);
      }
    }
  }, [availableParts, selectedPartId]);

  // Reset dialog state
  const resetAll = () => {
    setStep(1);
    setSelectedFile(null);
    setFileContent('');
    setErrorMessage(null);
    setParsedPassage(null);
    setParsedQuestions([]);
    setIsImporting(false);
    setImportProgress(null);
    setImportSuccessMessage(null);
    setActiveFormatTab('sample');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetAll();
    }
    onOpenChange(nextOpen);
  };

  // Copy sample text to clipboard
  const handleCopySample = () => {
    if (!currentPart) return;
    navigator.clipboard.writeText(currentPart.sampleText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download Word template (.doc format with Word HTML header)
  const handleDownloadWordTemplate = () => {
    if (!currentPart) return;
    const filename = `Template_${exam.type || 'TOEIC'}_Part_${currentPart.id}.doc`;
    const htmlContent = generateWordTemplateHtml(exam.name || 'Exam', exam.type || 'TOEIC', currentPart, locale);
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

  // Download plain text template (.txt)
  const handleDownloadTxtTemplate = () => {
    if (!currentPart) return;
    const filename = `Template_${exam.type || 'TOEIC'}_Part_${currentPart.id}.txt`;
    const txtContent = generateTxtTemplate(exam.name || 'Exam', exam.type || 'TOEIC', currentPart, locale);
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

  // Handle file selection
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

    // Read text directly if .txt
    if (lowerName.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setFileContent(text);
      };
      reader.readAsText(file, 'UTF-8');
    } else {
      // For Word or PDF: Store file reference, and set default sample text as fallback to inspect
      setFileContent(currentPart?.sampleText || '');
    }
  };

  // Proceed to Preview (Step 3)
  const handleProceedToPreview = async () => {
    if (!currentPart) return;
    setErrorMessage(null);

    // If file is selected and not a plain text file, call backend parse API
    if (selectedFile && !selectedFile.name.toLowerCase().endsWith('.txt') && !fileContent.trim()) {
      setIsAnalyzing(true);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('part', String(currentPart.id));
        formData.append('section', currentPart.section);
        const res = await examService.parseQuestions(exam._id, formData);
        const result = (res as any)?.data || res;
        if (result?.questions && Array.isArray(result.questions) && result.questions.length > 0) {
          setParsedPassage(result.passage || null);
          setParsedQuestions(result.questions);
          setStep(3);
          return;
        }
      } catch (err: any) {
        console.warn('Backend parse error, falling back to local text parser', err);
      } finally {
        setIsAnalyzing(false);
      }
    }

    // Fallback or text-based parsing
    const textToParse = fileContent.trim() || currentPart.sampleText;
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

  // Execute import mutation (save into MongoDB via backend API)
  const handleConfirmImport = async () => {
    if (!currentPart || parsedQuestions.length === 0) return;
    setIsImporting(true);
    setErrorMessage(null);
    setImportSuccessMessage(null);

    try {
      // 1. Call backend batch import endpoint
      const res = await examService.importQuestions(exam._id, {
        section: currentPart.section,
        part: currentPart.id,
        passage: parsedPassage || undefined,
        questions: parsedQuestions,
      });

      // Invalidate queries so detail page updates immediately
      queryClient.invalidateQueries({ queryKey: ['admin-exam-questions', exam._id] });
      queryClient.invalidateQueries({ queryKey: ['admin-exam-passages', exam._id] });
      queryClient.invalidateQueries({ queryKey: ['admin-exam', exam._id] });

      const importedTotal =
        (res as any)?.data?.importedCount || (res as any)?.importedCount || parsedQuestions.length;
      setImportSuccessMessage(
        t('importModal.msg.importSuccess', { count: importedTotal, part: currentPart.id })
      );
      setTimeout(() => {
        onSuccess?.();
        handleOpenChange(false);
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
          onSuccess?.();
          handleOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-6xl w-[96vw] max-h-[92vh] p-0 overflow-hidden rounded bg-white border border-slate-200/90 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between flex-wrap gap-3">
          <div>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-600" />
              <span>{t('importModal.title')}</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100/70 text-blue-700">
                {exam.type || 'TOEIC'}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              {t('importModal.subtitle', { name: exam.name })}
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/${locale}/assessment/${exam._id}/questions/import`}
              onClick={() => handleOpenChange(false)}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-blue-200 bg-blue-50/60 hover:bg-blue-100/70 transition-colors shadow-2xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>{t('importModal.openDedicatedPageBtn')}</span>
            </Link>
          </div>
        </div>

        {/* Stepper Navigation */}
        <div className="px-6 py-2.5 bg-slate-50/30 border-b border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`flex items-center gap-1.5 font-semibold transition-colors cursor-pointer ${
                step === 1 ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-bold ${
                  step === 1
                    ? 'bg-blue-600 text-white'
                    : step > 1
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {step > 1 ? <Check className="h-3 w-3" /> : '1'}
              </span>
              <span>{t('importModal.step1')}</span>
            </button>

            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />

            <button
              type="button"
              onClick={() => setStep(2)}
              className={`flex items-center gap-1.5 font-semibold transition-colors cursor-pointer ${
                step === 2 ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-bold ${
                  step === 2
                    ? 'bg-blue-600 text-white'
                    : step > 2
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {step > 2 ? <Check className="h-3 w-3" /> : '2'}
              </span>
              <span>{t('importModal.step2')}</span>
            </button>

            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />

            <span
              className={`flex items-center gap-1.5 font-semibold ${
                step === 3 ? 'text-blue-600' : 'text-slate-400'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-bold ${
                  step === 3 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                3
              </span>
              <span>{t('importModal.step3')}</span>
            </span>
          </div>

          {currentPart && (
            <div className="hidden md:flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <span className="text-slate-400">{t('importModal.currentSelected')}</span>
              <span className={`px-2 py-0.5 rounded-full ${currentPart.tagBg}`}>
                Part {currentPart.id}
              </span>
            </div>
          )}
        </div>

        {/* Error / Success Notifications */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {importSuccessMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded flex items-center gap-2 text-xs text-emerald-800 font-semibold animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{importSuccessMessage}</span>
          </div>
        )}

        {/* Step Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: CHỌN PART CÂU HỎI */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {t('importModal.step1Title')}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('importModal.step1Desc')}
                  </p>
                </div>

                {/* Section filter if exam is full test */}
                {exam.section === 'FULL_TEST' && (
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded text-xs">
                    <button
                      type="button"
                      onClick={() => setFilterSection('ALL')}
                      className={`px-2.5 py-1 rounded font-medium transition-colors ${
                        filterSection === 'ALL' ? 'bg-white shadow-xs text-blue-600 font-bold' : 'text-slate-600'
                      }`}
                    >
                      {t('importModal.filterAll')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterSection('LISTENING')}
                      className={`px-2.5 py-1 rounded font-medium transition-colors ${
                        filterSection === 'LISTENING' ? 'bg-white shadow-xs text-blue-600 font-bold' : 'text-slate-600'
                      }`}
                    >
                      {t('importModal.filterListening')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterSection('READING')}
                      className={`px-2.5 py-1 rounded font-medium transition-colors ${
                        filterSection === 'READING' ? 'bg-white shadow-xs text-blue-600 font-bold' : 'text-slate-600'
                      }`}
                    >
                      {t('importModal.filterReading')}
                    </button>
                  </div>
                )}
              </div>

              {/* Part Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
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
                        className={`relative p-4 rounded border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/40 shadow-xs ring-1 ring-blue-500/20'
                            : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded ${p.tagBg}`}
                              >
                                Part {p.id}
                              </span>
                              <span className="text-xs font-bold text-slate-800">{p.title}</span>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                              {p.desc}
                            </p>
                          </div>

                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                              isSelected
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-medium text-slate-600">{p.badge}</span>
                          <span className="text-slate-400">{p.questionCountHint}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold inline-flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                >
                  <span>{t('importModal.continueStep2')}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CHỌN FILE HOẶC DÁN NỘI DUNG & XEM MẪU FORMAT */}
          {step === 2 && currentPart && (
            <div className="space-y-4">
              {/* Selected Part Banner & Mode Switcher */}
              <div className="p-3.5 rounded bg-slate-50 border border-slate-200/80 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded ${currentPart.tagBg}`}>
                    Part {currentPart.id}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{currentPart.title}</h4>
                    <p className="text-[11px] text-slate-500">{currentPart.subtitle} • {currentPart.badge}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Mode switcher: Paste vs Upload */}
                  <div className="flex items-center p-1 bg-white rounded border border-slate-200 shadow-2xs text-xs">
                    <button
                      type="button"
                      onClick={() => setInputMethod('paste')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-semibold transition-all cursor-pointer ${
                        inputMethod === 'paste'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>{t('importModal.inputMethodPaste')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMethod('file')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-semibold transition-all cursor-pointer ${
                        inputMethod === 'file'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>{t('importModal.inputMethodFile')}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer inline-flex items-center gap-1 px-2.5 py-1.5 rounded hover:bg-blue-50/60"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>{t('importModal.changePart')}</span>
                  </button>
                </div>
              </div>

              {/* MODE 1: DÁN NỘI DUNG VĂN BẢN TRỰC TIẾP (RỘNG RÃI) */}
              {inputMethod === 'paste' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Editor column: 8 cols */}
                  <div className="lg:col-span-8 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-800">
                          {t('importModal.pasteTitle', { part: currentPart.id })}
                        </label>
                        <span className="text-[11px] text-slate-400">
                          {t('importModal.pasteStats', {
                            chars: fileContent.length.toLocaleString(),
                            lines: fileContent.split('\n').filter((l) => l.trim().length > 0).length,
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const text = await navigator.clipboard.readText();
                              if (text) setFileContent(text);
                            } catch {
                              // clipboard denied or not supported
                            }
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <ClipboardPaste className="h-3.5 w-3.5 text-blue-600" />
                          <span>{t('importModal.pasteClipboardBtn')}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFileContent(currentPart.sampleText)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>{t('importModal.loadSampleBtn', { part: currentPart.id })}</span>
                        </button>

                        {fileContent && (
                          <button
                            type="button"
                            onClick={() => setFileContent('')}
                            className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors cursor-pointer"
                            title={t('importModal.clearContentBtn')}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <textarea
                      value={fileContent}
                      onChange={(e) => setFileContent(e.target.value)}
                      placeholder={`1. Look at the photo and choose the best statement.\nImage: https://images.unsplash.com/...\nAudio: https://example.com/audio.mp3\nA. Option A\nB. Option B\nC. Option C\nD. Option D\nAnswer: B\nExplanation: Giải thích chi tiết...`}
                      className="w-full p-4 rounded border border-slate-800 bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed min-h-[420px] max-h-[540px] focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner scrollbar-thin resize-y selection:bg-blue-600"
                    />

                    <div className="flex items-center justify-between pt-1">
                      <p className="text-[11px] text-slate-400">
                        {t('importModal.pasteFormatHint')}
                      </p>

                      <button
                        type="button"
                        disabled={isAnalyzing}
                        onClick={handleProceedToPreview}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded text-xs font-semibold inline-flex items-center gap-2 cursor-pointer shadow-xs transition-colors shrink-0"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>{t('importModal.analyzing')}</span>
                          </>
                        ) : (
                          <span>{t('importModal.btnAnalyze')}</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Sidebar column: 4 cols */}
                  <div className="lg:col-span-4 bg-slate-50/70 border border-slate-200/90 rounded p-4 space-y-3.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <FileCode className="h-4 w-4 text-blue-600" />
                        <span>{t('importModal.standardFormatTitle', { part: currentPart.id })}</span>
                      </h4>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleDownloadWordTemplate}
                          className="px-2 py-1 bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 rounded text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          title="Word"
                        >
                          <Download className="h-3 w-3" />
                          <span>{t('importModal.downloadWord')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadTxtTemplate}
                          className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          title="TXT"
                        >
                          <Download className="h-3 w-3" />
                          <span>{t('importModal.downloadTxt')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Tabs: Sample vs Rules */}
                    <div className="flex items-center gap-2 border-b border-slate-200 text-xs">
                      <button
                        type="button"
                        onClick={() => setActiveFormatTab('sample')}
                        className={`pb-2 px-1 font-semibold transition-colors cursor-pointer ${
                          activeFormatTab === 'sample'
                            ? 'border-b-2 border-blue-600 text-blue-600'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {t('importModal.tabSample')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveFormatTab('rules')}
                        className={`pb-2 px-1 font-semibold transition-colors cursor-pointer ${
                          activeFormatTab === 'rules'
                            ? 'border-b-2 border-blue-600 text-blue-600'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {t('importModal.tabRules')}
                      </button>
                    </div>

                    {activeFormatTab === 'sample' && (
                      <div className="relative">
                        <div className="absolute right-2 top-2 z-10">
                          <button
                            type="button"
                            onClick={handleCopySample}
                            className="px-2 py-1 rounded bg-white/90 hover:bg-white text-slate-700 border border-slate-200 text-[10px] font-semibold inline-flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                          >
                            {copied ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600" />
                                <span className="text-emerald-700">Đã sao chép</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Sao chép</span>
                              </>
                            )}
                          </button>
                        </div>

                        <pre className="p-3 rounded bg-slate-900 text-slate-100 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-[340px] border border-slate-800 select-all scrollbar-thin">
                          <code>{currentPart.sampleText}</code>
                        </pre>
                      </div>
                    )}

                    {/* Rules Guide (Dynamically tailored to the specific Part and Exercise Type) */}
                    {activeFormatTab === 'rules' && (
                      <div className="p-3 bg-white rounded border border-slate-200 text-xs space-y-2.5 leading-relaxed text-slate-700 max-h-[340px] overflow-y-auto">
                        <div className="space-y-1">
                          <p className="font-bold text-slate-900">
                            {locale === 'en' ? currentPart.exerciseTypeNameEn : currentPart.exerciseTypeName}
                          </p>
                          <p className="text-[11px] text-slate-500 italic">
                            {locale === 'en' ? currentPart.exerciseTypeDescEn : currentPart.exerciseTypeDesc}
                          </p>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-slate-100">
                          <p className="font-bold text-slate-900 text-[11px]">
                            {t('importModal.quickSyntaxRules', { part: currentPart.id })}
                          </p>
                          {(locale === 'en' ? currentPart.formatRulesEn : currentPart.formatRules).map((rule, rIdx) => (
                            <p key={rIdx} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                              <span className="text-blue-600 font-bold shrink-0">•</span>
                              <span>{rule}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dedicated page promo box */}
                    <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded space-y-1.5">
                      <p className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                        <ExternalLink className="h-3.5 w-3.5 text-blue-600" />
                        <span>{t('importModal.needMoreSpaceTitle')}</span>
                      </p>
                      <p className="text-[11px] text-blue-700 leading-relaxed">
                        {t('importModal.needMoreSpaceDesc')}
                      </p>
                      <Link
                        href={`/${locale}/assessment/${exam._id}/questions/import`}
                        onClick={() => handleOpenChange(false)}
                        className="text-[11px] font-bold text-blue-700 hover:text-blue-800 underline inline-block pt-0.5"
                      >
                        {t('importModal.goToDedicatedPage')}
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 2: TẢI TỆP TIN (.DOCX, .DOC, .PDF, .TXT) */}
              {inputMethod === 'file' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Left 5 Cols: File Upload Section */}
                  <div className="lg:col-span-5 space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-800 block">
                        {t('importModal.fileUploadLabel')}
                      </label>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {t('importModal.fileUploadDesc', { part: currentPart.id })}
                      </p>
                    </div>

                    {/* Drag and Drop Container */}
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
                      className={`border-2 border-dashed rounded p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-3 ${
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
                        className={`w-12 h-12 rounded flex items-center justify-center shadow-xs ${
                          selectedFile
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-blue-50 text-blue-600'
                        }`}
                      >
                        {selectedFile ? (
                          <FileText className="h-6 w-6" />
                        ) : (
                          <Upload className="h-6 w-6" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-800">
                          {selectedFile ? selectedFile.name : t('importModal.dragDropMain')}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {t('importModal.dragDropSub')}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap justify-center pt-1">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                          .DOCX
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                          .DOC
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800">
                          .PDF
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {t('importModal.maxSize')}
                        </span>
                      </div>
                    </div>

                    {/* Selected File Details */}
                    {selectedFile && (
                      <div className="p-3 bg-white border border-slate-200 rounded flex items-center justify-between gap-3 shadow-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">
                              {selectedFile.name}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {(selectedFile.size / 1024).toFixed(1)} KB • {t('importModal.readyToAnalyze')}
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
                          className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500 transition-colors"
                          title={t('importModal.cancelFile')}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {/* Action Button */}
                    <div className="pt-2">
                      <button
                        type="button"
                        disabled={isAnalyzing}
                        onClick={handleProceedToPreview}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>{t('importModal.analyzing')}</span>
                          </>
                        ) : (
                          <span>{t('importModal.btnAnalyze')}</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Right 7 Cols: Format Template & Download */}
                  <div className="lg:col-span-7 bg-slate-50/70 border border-slate-200/90 rounded p-4 space-y-3.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <FileCode className="h-4 w-4 text-blue-600" />
                          <span>{t('importModal.formatStandardTitle', { part: currentPart.id })}</span>
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {t('importModal.formatStandardDesc')}
                        </p>
                      </div>

                      {/* Download template buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleDownloadWordTemplate}
                          className="px-2.5 py-1.5 bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 rounded text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          title={t('importModal.downloadWordBtn')}
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>{t('importModal.downloadWordBtn')}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleDownloadTxtTemplate}
                          className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          title={t('importModal.downloadTxtBtn')}
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>{t('importModal.downloadTxtBtn')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Tabs: Sample text vs Rules Guide */}
                    <div className="flex items-center gap-2 border-b border-slate-200 text-xs">
                      <button
                        type="button"
                        onClick={() => setActiveFormatTab('sample')}
                        className={`pb-2 px-1 font-semibold transition-colors cursor-pointer ${
                          activeFormatTab === 'sample'
                            ? 'border-b-2 border-blue-600 text-blue-600'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {t('importModal.tabSample')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveFormatTab('rules')}
                        className={`pb-2 px-1 font-semibold transition-colors cursor-pointer ${
                          activeFormatTab === 'rules'
                            ? 'border-b-2 border-blue-600 text-blue-600'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {t('importModal.tabRules')}
                      </button>
                    </div>

                    {/* Live Sample Code Box */}
                    {activeFormatTab === 'sample' && (
                      <div className="relative">
                        <div className="absolute right-2.5 top-2.5 z-10">
                          <button
                            type="button"
                            onClick={handleCopySample}
                            className="px-2 py-1 rounded bg-white/90 hover:bg-white text-slate-700 border border-slate-200 text-[10px] font-semibold inline-flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                          >
                            {copied ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600" />
                                <span className="text-emerald-700">{t('importModal.copiedSuccess')}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>{t('importModal.copySampleBtn')}</span>
                              </>
                            )}
                          </button>
                        </div>

                        <pre className="p-3.5 rounded bg-slate-900 text-slate-100 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-72 border border-slate-800 select-all scrollbar-thin">
                          <code>{currentPart.sampleText}</code>
                        </pre>
                      </div>
                    )}

                    {/* Rules Guide */}
                    {activeFormatTab === 'rules' && (
                      <div className="p-3.5 bg-white rounded border border-slate-200 text-xs space-y-2.5 leading-relaxed text-slate-700 max-h-72 overflow-y-auto">
                        <div className="space-y-1">
                          <p className="font-bold text-slate-900">{t('importModal.rules.qAndA')}</p>
                          <p className="text-[11px] text-slate-600">
                            {t('importModal.rules.qPrefix')}
                          </p>
                          <p className="text-[11px] text-slate-600">
                            {t('importModal.rules.optPrefix')}
                          </p>
                          <p className="text-[11px] text-slate-600">
                            {t('importModal.rules.ansPrefix')}
                          </p>
                          <p className="text-[11px] text-slate-600">
                            {t('importModal.rules.expPrefix')}
                          </p>
                        </div>

                        {currentPart.hasPassage && (
                          <div className="space-y-1 pt-2 border-t border-slate-100">
                            <p className="font-bold text-slate-900">{t('importModal.rules.passageGroup')}</p>
                            <p className="text-[11px] text-slate-600">
                              {t('importModal.rules.passagePrefix')}
                            </p>
                            <p className="text-[11px] text-slate-600">
                              {t('importModal.rules.passageTitle')}
                            </p>
                            <p className="text-[11px] text-slate-600">
                              {t('importModal.rules.passageLink')}
                            </p>
                          </div>
                        )}

                        <div className="space-y-1 pt-2 border-t border-slate-100">
                          <p className="font-bold text-slate-900">{t('importModal.rules.mediaGroup')}</p>
                          <p className="text-[11px] text-slate-600">
                            {t('importModal.rules.imagePrefix')}
                          </p>
                          <p className="text-[11px] text-slate-600">
                            {t('importModal.rules.audioPrefix')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: XEM TRƯỚC, CHỈNH SỬA & XÁC NHẬN IMPORT */}
          {step === 3 && currentPart && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>{t('importModal.step3Title')}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                      {t('importModal.step3Count', { count: parsedQuestions.length })}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Part {currentPart.id} • {currentPart.title} • {t('importModal.step3Hint')}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>{t('importModal.backToEditBtn')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={isImporting || parsedQuestions.length === 0}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs font-semibold inline-flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>
                          {t('importModal.importingProgress', {
                            current: importProgress?.current || 0,
                            total: importProgress?.total || 0,
                          })}
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{t('importModal.confirmImportBtn')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Attached Passage editable card if present */}
              {parsedPassage && (
                <div className="p-4 rounded bg-blue-50/60 border border-blue-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                      <BookOpen className="h-4 w-4 text-blue-600" />
                      <span>{t('importModal.passageCardTitle')}</span>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={parsedPassage.title || ''}
                    onChange={(e) => handleUpdatePassage('title', e.target.value)}
                    placeholder={t('importModal.passageTitlePlaceholder')}
                    className="w-full text-xs font-semibold text-blue-950 p-2 rounded border border-blue-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <textarea
                    rows={3}
                    value={parsedPassage.content || ''}
                    onChange={(e) => handleUpdatePassage('content', e.target.value)}
                    placeholder={t('importModal.passageContentPlaceholder')}
                    className="w-full text-xs text-slate-700 p-2.5 rounded border border-blue-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y leading-relaxed"
                  />

                  {/* Passage Audio (cho Listening có passage: Part 3, 4) */}
                  {currentPart.hasAudio && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded border border-blue-200">
                      <Volume2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <input
                        type="text"
                        value={parsedPassage.audioUrl || ''}
                        onChange={(e) => handleUpdatePassage('audioUrl', e.target.value)}
                        placeholder="URL file audio đoạn hội thoại / bài nói..."
                        className="w-full bg-transparent text-[11px] text-slate-700 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Passage Image (cho Reading có passage dạng scan/ảnh: Part 6, 7) */}
                  {currentPart.section === 'READING' && currentPart.hasImage && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded border border-blue-200">
                      <ImageIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
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

              {/* Questions Editable Preview List */}
              <div className="space-y-3.5 max-h-[55vh] overflow-y-auto pr-1.5 scrollbar-thin">
                {parsedQuestions.map((q, idx) => {
                  const showImg = shouldShowQuestionImageInput(currentPart, q);
                  const showAud = shouldShowQuestionAudioInput(currentPart, q);

                  return (
                    <div
                      key={idx}
                      className="p-4 rounded border border-slate-200/90 bg-white hover:border-slate-300 transition-colors space-y-3 shadow-2xs"
                    >
                      {/* Header: Question order + delete button */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {t('importModal.currentCorrectBadge')}{' '}
                            <strong className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
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
                          className="w-full text-xs font-semibold text-slate-800 p-2.5 rounded border border-slate-200 bg-slate-50/40 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y leading-relaxed"
                        />
                      </div>

                      {/* Options Grid (Click letter badge to set correct answer, edit text in input) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                                className={`w-6 h-6 rounded text-[11px] flex items-center justify-center font-bold shrink-0 cursor-pointer transition-all ${
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
                                  isCorrect ? 'font-semibold text-emerald-950' : 'text-slate-800'
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
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded border border-slate-200">
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
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded border border-slate-200">
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
                          className="flex-1 text-xs px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Add new question button */}
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="w-full py-2.5 border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 text-blue-600 rounded text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t('importModal.addNewQuestionBtn')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
