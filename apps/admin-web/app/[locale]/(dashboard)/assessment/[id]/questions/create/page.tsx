'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { examService } from '@/services/assessment.service';
import { uploadService } from '@/services/upload.service';
import { useDraftUploads } from '@/hooks/use-draft-uploads';
import { QuestionSavingStatus } from '@/components/assessment/question-saving-status';
import { ExamItem, QuestionItem } from '@/types';
import { TiptapEditor } from '@/components/assessment/tiptap-editor';
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

interface ReadingPassageInput {
  id: string;
  type: 'TEXT' | 'EMAIL' | 'ADVERTISEMENT' | 'ARTICLE' | 'NOTICE' | 'CHAT';
  content: string;
  imageUrl?: string;
  imageFileName?: string;
  inputMode?: 'TEXT' | 'IMAGE';
}

const TOEIC_PART_RANGES: Record<number, { start: number; end: number; count: number }> = {
  1: { start: 1, end: 6, count: 6 },
  2: { start: 7, end: 31, count: 25 },
  3: { start: 32, end: 70, count: 39 },
  4: { start: 71, end: 100, count: 30 },
  5: { start: 101, end: 130, count: 30 },
  6: { start: 131, end: 146, count: 16 },
  7: { start: 147, end: 200, count: 54 },
};

function computeNextOrderForPart(partNum: number, questions: QuestionItem[]): number {
  const range = TOEIC_PART_RANGES[partNum] || { start: 1, end: 200, count: 200 };
  const questionsInPart = questions.filter((q) => Number(q.part) === Number(partNum));
  if (questionsInPart.length === 0) {
    return range.start;
  }
  const maxOrderInPart = Math.max(...questionsInPart.map((q) => Number(q.order) || 0));
  return Math.max(range.start + questionsInPart.length, maxOrderInPart + 1);
}

const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const MAX_IMAGE_SIZE = 15 * 1024 * 1024; // 15MB

const ALLOWED_AUDIO_EXTS = ['.mp3', '.wav', '.ogg', '.aac', '.m4a', '.webm'];
const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB

function validateUploadFile(file: File, isImage: boolean): string | null {
  if (!file) return 'Không tìm thấy file để tải lên.';
  if (file.size === 0) return 'File trống không có dữ liệu (0 bytes).';

  const fileNameLower = file.name.toLowerCase();

  if (isImage) {
    const hasValidExt = ALLOWED_IMAGE_EXTS.some((ext) => fileNameLower.endsWith(ext));
    const hasValidType = file.type ? file.type.startsWith('image/') : hasValidExt;
    if (!hasValidExt && !hasValidType) {
      return 'Định dạng ảnh không hợp lệ. Vui lòng chọn file JPG, PNG, WebP hoặc GIF.';
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return 'Dung lượng file ảnh quá lớn (tối đa 15MB).';
    }
  } else {
    const hasValidExt = ALLOWED_AUDIO_EXTS.some((ext) => fileNameLower.endsWith(ext));
    const hasValidType = file.type ? file.type.startsWith('audio/') : hasValidExt;
    if (!hasValidExt && !hasValidType) {
      return 'Định dạng âm thanh không hợp lệ. Vui lòng chọn file MP3, WAV, AAC, M4A hoặc OGG.';
    }
    if (file.size > MAX_AUDIO_SIZE) {
      return 'Dung lượng file âm thanh quá lớn (tối đa 50MB).';
    }
  }

  return null;
}

function isValidHttpUrl(str?: string): boolean {
  if (!str || !str.trim()) return true;
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
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
      isActive: true,
      durationMinutes: 45,
      totalQuestions: 100,
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

  // Sync order when questions load or when part changes
  useEffect(() => {
    const nextOrder = computeNextOrderForPart(part, existingQuestions);
    setOrder(nextOrder);
  }, [part, existingQuestions.length]);

  const currentPartRange = TOEIC_PART_RANGES[part];
  const existingCountInPart = useMemo(() => {
    return existingQuestions.filter((q: QuestionItem) => Number(q.part) === Number(part)).length;
  }, [existingQuestions, part]);



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
  const [isTitleCustom, setIsTitleCustom] = useState(false);
  const [groupAudioUrl, setGroupAudioUrl] = useState('');
  const [groupAudioFileName, setGroupAudioFileName] = useState('');
  const [groupAudioFileSize, setGroupAudioFileSize] = useState('');
  const [groupContent, setGroupContent] = useState(''); // transcript or audio text
  const [groupImageUrl, setGroupImageUrl] = useState('');
  const [groupImageFileName, setGroupImageFileName] = useState('');

  // Multi-passage states for Reading groups (Part 6, 7: hỗ trợ Đoạn đơn, Đoạn kép & Đoạn ba)
  const [readingPassages, setReadingPassages] = useState<ReadingPassageInput[]>([
    { id: '1', type: 'TEXT', content: '' },
  ]);
  const [activeReadingPassageIndex, setActiveReadingPassageIndex] = useState<number>(0);

  const handleAddReadingPassage = () => {
    if (readingPassages.length >= 3) return;
    const newId = String(Date.now());
    setReadingPassages((prev) => [
      ...prev,
      {
        id: newId,
        type: 'TEXT',
        content: '',
      },
    ]);
    setActiveReadingPassageIndex(readingPassages.length);
  };

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittingType, setSubmittingType] = useState<'create' | 'draft' | null>(null);
  const submitInProgress = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const showError = (msg: string) => {
    setErrorMessage(msg);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        const errorEl = document.getElementById('form-error-alert');
        if (errorEl) {
          errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }
  };

  const readingPassagesRef = useRef(readingPassages);
  readingPassagesRef.current = readingPassages;
  const uploadInProgress = useRef(false);
  const draftUploads = useDraftUploads([
    imageUrl, audioUrl, groupAudioUrl, groupImageUrl,
    ...readingPassages.map((p) => p.imageUrl),
  ]);

  const handlePassageImageUpload = async (file: File) => {
    if (!file || uploadInProgress.current || isSubmitting) return;

    const fileError = validateUploadFile(file, true);
    if (fileError) {
      showError(fileError);
      return;
    }

    const targetId = readingPassages[activeReadingPassageIndex]?.id;
    const previousUrl = readingPassages[activeReadingPassageIndex]?.imageUrl;
    uploadInProgress.current = true;
    try {
      setIsUploading(true);
      setErrorMessage(null);
      const res = await uploadService.uploadFile(file);
      if (res?.url) {
        const target = readingPassagesRef.current.find((p) => p.id === targetId);
        if (!target || target.inputMode !== 'IMAGE' || target.imageUrl !== previousUrl) {
          await uploadService.deleteFile(res.url);
          return;
        }
        if (!draftUploads.track(res.url)) return;
        setReadingPassages((prev) => prev.map((p) => p.id === targetId
          ? { ...p, content: '', imageUrl: res.url, imageFileName: file.name } : p));
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Lỗi tải ảnh lên';
      showError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      uploadInProgress.current = false;
      setIsUploading(false);
    }
  };

  const handleRemoveReadingPassage = (idx: number) => {
    if (readingPassages.length <= 1) return;
    const updated = readingPassages.filter((_, i) => i !== idx);
    setReadingPassages(updated);
    if (activeReadingPassageIndex >= updated.length) {
      setActiveReadingPassageIndex(updated.length - 1);
    }
  };

  const updateActiveReadingPassage = (fields: Partial<ReadingPassageInput>) => {
    setReadingPassages((prev) => {
      const copy = [...prev];
      const cur = copy[activeReadingPassageIndex];
      if (!cur) return copy;
      copy[activeReadingPassageIndex] = { ...cur, ...fields };
      return copy;
    });
  };

  const [subQuestions, setSubQuestions] = useState<SubQuestion[]>([
    { id: '1', content: '', options: [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }], correctAnswer: 'A', explanation: '' },
  ]);
  const [activeSubIndex, setActiveSubIndex] = useState<number>(0);

  // Helper: auto compute standard group title based on part, starting order, and question count
  const computeAutoGroupTitle = (partNum: number, startOrder: number, count: number): string => {
    const min = Math.max(1, Number(startOrder) || 1);
    const total = Math.max(1, count);
    const max = min + total - 1;
    const rangeStr = total === 1 ? `Question ${min}` : `Questions ${min}-${max}`;
    let partSuffix = 'Passage';
    if (partNum === 3) partSuffix = 'Part 3 Conversation';
    else if (partNum === 4) partSuffix = 'Part 4 Talk';
    else if (partNum === 6) partSuffix = 'Part 6 Text Completion';
    else if (partNum === 7) partSuffix = 'Part 7 Reading Passage';
    else partSuffix = `Part ${partNum}`;
    return `${rangeStr} (${partSuffix})`;
  };

  // Helper: detect if a title string follows standard auto-generated pattern
  const isAutoGeneratedTitle = (title: string): boolean => {
    if (!title || !title.trim()) return true;
    return /^Questions?\s+\d+(?:-\d+)?\s+\(Part\s+\d+[^)]*\)$/i.test(title.trim());
  };

  // Initialize group subQuestions default count when part changes
  useEffect(() => {
    if (!isGroupPart) return;
    if (part === 6) {
      // Đối với Part 6, câu hỏi được sinh ra và đồng bộ trực tiếp theo ô trống [___] trên bài đọc
      setSubQuestions([]);
      setActiveSubIndex(0);
      setIsTitleCustom(false);
      setGroupTitle(computeAutoGroupTitle(part, order, 4));
      return;
    }
    const defaultSubCount = part === 7 ? 1 : 3;
    setSubQuestions((prev) => {
      if (prev.length === defaultSubCount) return prev;
      return Array.from({ length: defaultSubCount }, (_, idx) => {
        if (prev[idx]) return prev[idx];
        return {
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
        };
      });
    });
    setIsTitleCustom(false);
    setGroupTitle(computeAutoGroupTitle(part, order, defaultSubCount));
  }, [part]);

  // Auto-sync group title with order, part, and number of questions (unless user customized it)
  useEffect(() => {
    if (!isGroupPart) return;
    if (!isTitleCustom || isAutoGeneratedTitle(groupTitle) || !groupTitle.trim()) {
      setGroupTitle(computeAutoGroupTitle(part, order, subQuestions.length));
    }
  }, [part, order, subQuestions.length, isGroupPart]);

  // File upload handler
  const handleFileUpload = async (file: File, target: 'single-image' | 'single-audio' | 'group-audio' | 'group-image') => {
    if (!file || uploadInProgress.current || isSubmitting) return;

    const isImage = target === 'single-image' || target === 'group-image';
    const fileError = validateUploadFile(file, isImage);
    if (fileError) {
      showError(fileError);
      return;
    }

    uploadInProgress.current = true;
    try {
      setIsUploading(true);
      setErrorMessage(null);
      const res = await uploadService.uploadFile(file);
      if (res?.url) {
        if (!draftUploads.track(res.url)) return;
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
      showError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      uploadInProgress.current = false;
      setIsUploading(false);
    }
  };

  // Add / Remove sub questions for group parts
  const handleAddSubQuestion = () => {
    const newId = String(Date.now());
    const nextCount = subQuestions.length + 1;
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
    if (!isTitleCustom || isAutoGeneratedTitle(groupTitle) || !groupTitle.trim()) {
      setGroupTitle(computeAutoGroupTitle(part, order, nextCount));
    }
  };

  // Đồng bộ: Tự động thêm câu hỏi khi bấm "Chèn ô trống [___]" trong bài đọc Part 6
  const handleInsertBlank = (blankNumStr: string) => {
    const parsedNum = parseInt(blankNumStr, 10) || (order + subQuestions.length);
    const newId = String(Date.now() + Math.random());
    const newSub: SubQuestion = {
      id: newId,
      content: `[${parsedNum}]`,
      options: [
        { key: 'A', text: '' },
        { key: 'B', text: '' },
        { key: 'C', text: '' },
        { key: 'D', text: '' },
      ],
      correctAnswer: 'A',
      explanation: '',
    };

    setSubQuestions((prev) => {
      const updated = [...prev, newSub];
      setActiveSubIndex(updated.length - 1);
      if (!isTitleCustom || isAutoGeneratedTitle(groupTitle) || !groupTitle.trim()) {
        setGroupTitle(computeAutoGroupTitle(part, order, Math.max(updated.length, 4)));
      }
      return updated;
    });
  };

  // Quét lại toàn bộ các ô trống [131], [132]... trong bài đọc hiện tại để đồng bộ danh sách câu hỏi
  const handleSyncBlanksFromPassage = () => {
    const curContent = readingPassages[activeReadingPassageIndex]?.content || '';
    const regex = /\[(\d{1,3})\]/g;
    const matches: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(curContent)) !== null) {
      if (m[1]) {
        const num = parseInt(m[1], 10);
        if (!isNaN(num) && !matches.includes(num)) {
          matches.push(num);
        }
      }
    }
    if (matches.length === 0) {
      showError('Không tìm thấy ô trống dạng [131], [132] nào trong bài đọc để đồng bộ.');
      return;
    }
    setSubQuestions((prev) => {
      return matches.map((num, idx) => {
        const existing = prev.find((q) => q.content.includes(String(num))) || prev[idx];
        return {
          id: existing?.id || String(Date.now() + idx),
          content: `[${num}]`,
          options: existing?.options || [
            { key: 'A', text: '' },
            { key: 'B', text: '' },
            { key: 'C', text: '' },
            { key: 'D', text: '' },
          ],
          correctAnswer: existing?.correctAnswer || 'A',
          explanation: existing?.explanation || '',
        };
      });
    });
    setActiveSubIndex(0);
    setSuccessMessage(`Đã đồng bộ ${matches.length} câu hỏi theo các ô trống trong bài đọc: ${matches.map((n) => `[${n}]`).join(', ')}`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleRemoveSubQuestion = (idx: number) => {
    if (part !== 6) {
      if (subQuestions.length <= 1) return;
      const updated = subQuestions.filter((_, i) => i !== idx);
      setSubQuestions(updated);
      if (activeSubIndex >= updated.length) {
        setActiveSubIndex(Math.max(0, updated.length - 1));
      }
      if (!isTitleCustom || isAutoGeneratedTitle(groupTitle) || !groupTitle.trim()) {
        setGroupTitle(computeAutoGroupTitle(part, order, Math.max(updated.length, 1)));
      }
      return;
    }

    // === XỬ LÝ PART 6: Tự động xóa blank trong bài đọc và đánh số lại thứ tự ===
    const targetQ = subQuestions[idx];
    const numMatch = targetQ?.content.match(/\d+/);
    const targetNum = numMatch ? parseInt(numMatch[0], 10) : (order + idx);

    // 1. Xóa ô trống tương ứng trong nội dung bài đọc hiện tại
    const curContent = readingPassages[activeReadingPassageIndex]?.content || '';
    let removed = false;

    // Pattern nhận diện các định dạng ô trống: <strong>_____ [131] _____</strong>, _____ [131] _____, <strong>[131]</strong>, [131]
    const blankRegex = /<strong>\s*_{2,}\s*\[(\d+)\]\s*_{2,}\s*<\/strong>|<strong>\s*\[(\d+)\]\s*<\/strong>|_{2,}\s*\[(\d+)\]\s*_{2,}|\[(\d+)\]/g;

    let contentWithoutBlank = curContent.replace(blankRegex, (fullMatch, g1, g2, g3, g4) => {
      const num = parseInt(g1 || g2 || g3 || g4, 10);
      if (!removed && num === targetNum) {
        removed = true;
        return '';
      }
      return fullMatch;
    });

    // Nếu không khớp theo số (do người dùng đã chỉnh sửa nội dung câu hỏi), xóa theo vị trí ô trống thứ idx
    if (!removed) {
      let count = 0;
      contentWithoutBlank = curContent.replace(blankRegex, (fullMatch) => {
        if (count === idx) {
          count++;
          return '';
        }
        count++;
        return fullMatch;
      });
    }

    // 2. Tự động tính lại số thứ tự cho toàn bộ ô trống còn lại trong bài đọc bắt đầu từ order
    let blankIndex = 0;
    const renumberedContent = contentWithoutBlank.replace(blankRegex, (fullMatch) => {
      const newNum = order + blankIndex;
      blankIndex++;
      if (fullMatch.includes('<strong>') && fullMatch.includes('__')) {
        return `<strong>_____ [${newNum}] _____</strong>`;
      } else if (fullMatch.includes('<strong>')) {
        return `<strong>[${newNum}]</strong>`;
      } else if (fullMatch.includes('__')) {
        return `_____ [${newNum}] _____`;
      } else {
        return `[${newNum}]`;
      }
    });

    // Cập nhật lại nội dung bài đọc Tiptap
    updateActiveReadingPassage({ content: renumberedContent });

    // 3. Tự động tính lại số thứ tự cho danh sách câu hỏi con còn lại
    const remainingSubs = subQuestions.filter((_, i) => i !== idx);
    const renumberedSubs = remainingSubs.map((q, i) => {
      const newNum = order + i;
      return {
        ...q,
        content: `[${newNum}]`,
      };
    });

    setSubQuestions(renumberedSubs);
    if (activeSubIndex >= renumberedSubs.length) {
      setActiveSubIndex(Math.max(0, renumberedSubs.length - 1));
    }

    if (!isTitleCustom || isAutoGeneratedTitle(groupTitle) || !groupTitle.trim()) {
      setGroupTitle(computeAutoGroupTitle(part, order, Math.max(renumberedSubs.length, 4)));
    }

    setSuccessMessage(`Đã xóa câu hỏi [${targetNum}], tự động xóa ô trống và đánh số lại các câu hỏi liên tục.`);
    setTimeout(() => setSuccessMessage(null), 3000);
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
    if (groupAudioInputRef.current) groupAudioInputRef.current.value = '';
    if (groupImageInputRef.current) groupImageInputRef.current.value = '';

    setReadingPassages([{ id: '1', type: 'TEXT', content: '' }]);
    setActiveReadingPassageIndex(0);

    const defaultSubCount = part === 6 ? 0 : part === 7 ? 1 : 3;
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
    setIsTitleCustom(false);

    if (isGroupPart) {
      setGroupTitle(computeAutoGroupTitle(part, targetOrder, part === 6 ? 4 : defaultSubCount));
    } else {
      setGroupTitle('');
    }
  };

  const handleManualReset = () => {
    if (isSubmitting || uploadInProgress.current) return;
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
    if (uploadInProgress.current || submitInProgress.current || isSubmitting) return;
    setErrorMessage(null);
    if (!content.trim()) {
      showError(t('createQuestionPage.msgInputQuestionContent'));
      return;
    }

    // Part 1: Bắt buộc phải có cả hình ảnh và file audio
    if (part === 1) {
      if (!imageUrl || !imageUrl.trim()) {
        showError(t('createQuestionPage.msgPart1ImageRequired'));
        setAttachmentTab('image');
        return;
      }
      if (!audioUrl || !audioUrl.trim()) {
        showError(t('createQuestionPage.msgPart1AudioRequired'));
        setAttachmentTab('audio');
        return;
      }
    }

    // Part 2: Bắt buộc phải có file audio
    if (part === 2) {
      if (!audioUrl || !audioUrl.trim()) {
        showError(t('createQuestionPage.msgPart2AudioRequired'));
        setAttachmentTab('audio');
        return;
      }
      if (!optionA.trim() || !optionB.trim() || !optionC.trim()) {
        showError(t('createQuestionPage.msgPart2OptionsRequired'));
        return;
      }
    } else {
      if (!optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim()) {
        showError(t('createQuestionPage.msgOptionsRequired'));
        return;
      }
    }

    if (imageUrl && !isValidHttpUrl(imageUrl)) {
      showError('Đường dẫn ảnh không hợp lệ (URL phải bắt đầu bằng http:// hoặc https://).');
      return;
    }
    if (audioUrl && !isValidHttpUrl(audioUrl)) {
      showError('Đường dẫn âm thanh không hợp lệ (URL phải bắt đầu bằng http:// hoặc https://).');
      return;
    }

    submitInProgress.current = true;
    setIsSubmitting(true);
    setSubmittingType(asDraft ? 'draft' : 'create');
    setSuccessMessage(null);
    try {
      draftUploads.startSaving();
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
        passageGroupId: passageId !== 'none' ? passageId : undefined,
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

        isActive: asDraft ? false : isActive,
      };

      await examService.createQuestion(payload);
      draftUploads.commit([payload.imageUrl, payload.audioUrl]);
      queryClient.invalidateQueries({ queryKey: ['admin-exam-questions', examId] });
      setSuccessMessage(t('createQuestionPage.msgQuestionCreated'));

      // Clear all form data back to initial defaults & advance order
      resetSingleForm(Number(order) + 1);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || t('createQuestionPage.msgCreateQuestionError');
      showError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      draftUploads.finishSaving();
      submitInProgress.current = false;
      setIsSubmitting(false);
      setSubmittingType(null);
    }
  };

  // Submit Group Questions
  const handleGroupSubmit = async (asDraft: boolean = false) => {
    let createdGroupId: string | undefined;
    if (uploadInProgress.current || submitInProgress.current || isSubmitting) return;
    setErrorMessage(null);

    if (!groupTitle.trim()) {
      showError('Vui lòng nhập tiêu đề cho cụm câu hỏi.');
      return;
    }

    // Validation Part 3 & 4: Audio bắt buộc
    if (groupType === 'AUDIO') {
      if (!groupAudioUrl || !groupAudioUrl.trim()) {
        showError(t('createQuestionPage.msgAudioRequired'));
        return;
      }
      if (!isValidHttpUrl(groupAudioUrl)) {
        showError('Đường dẫn âm thanh không hợp lệ (URL phải bắt đầu bằng http:// hoặc https://).');
        return;
      }
    }

    // Validation Part 6 & 7: Đề bài (văn bản hoặc hình ảnh) bắt buộc
    if (groupType === 'READING') {
      for (let pIdx = 0; pIdx < readingPassages.length; pIdx++) {
        const p = readingPassages[pIdx];
        if (!p || (!p.content.trim() && !p.imageUrl?.trim())) {
          showError(t('createQuestionPage.msgPassageContentRequired') || `Đoạn văn / Đề bài số ${pIdx + 1} không được để trống (cần có nội dung văn bản hoặc hình ảnh).`);
          setActiveReadingPassageIndex(pIdx);
          return;
        }
        if (p.content.trim() && p.imageUrl?.trim()) {
          showError(`Vui lòng chỉ chọn văn bản hoặc hình ảnh cho đoạn văn số ${pIdx + 1}, không dùng cả hai.`);
          setActiveReadingPassageIndex(pIdx);
          return;
        }
        if (p.imageUrl && !isValidHttpUrl(p.imageUrl)) {
          showError(`Đường dẫn ảnh của đoạn văn số ${pIdx + 1} không hợp lệ (URL phải bắt đầu bằng http:// hoặc https://).`);
          setActiveReadingPassageIndex(pIdx);
          return;
        }
      }
    }

    if (subQuestions.length === 0) {
      showError(
        part === 6
          ? 'Vui lòng chèn ít nhất một ô trống [___] vào bài đọc để tạo câu hỏi.'
          : 'Vui lòng tạo ít nhất một câu hỏi con cho cụm đề thi.'
      );
      return;
    }

    for (let i = 0; i < subQuestions.length; i++) {
      const q = subQuestions[i];
      if (!q) continue;
      const effectiveContent = part === 6 ? (q.content.trim() || `[${Number(order) + i}]`) : q.content.trim();
      if (!effectiveContent) {
        showError(t('createQuestionPage.msgSubQuestionContentRequired', { index: i + 1 }));
        setActiveSubIndex(i);
        return;
      }
      const emptyOpt = q.options.find((o) => !o.text.trim());
      if (emptyOpt) {
        showError(t('createQuestionPage.msgSubQuestionOptionsRequired', { index: i + 1 }));
        setActiveSubIndex(i);
        return;
      }
    }

    submitInProgress.current = true;
    setIsSubmitting(true);
    setSubmittingType(asDraft ? 'draft' : 'create');
    setSuccessMessage(null);
    try {
      draftUploads.startSaving();

      if (groupType === 'READING') {
        const autoTitle = computeAutoGroupTitle(part, order, subQuestions.length);
        const passagePayload = {
          examId,
          title: groupTitle.trim() || autoTitle,
          section,
          part: Number(part),
          order: Number(order) || 1,
          passages: readingPassages.map((p, idx) => ({
            type: p.type || 'TEXT',
            content: p.content.trim() || undefined,
            imageUrl: p.imageUrl || undefined,
            order: idx + 1,
          })),
        };

        const groupRes = await examService.createPassageGroup(passagePayload);
        createdGroupId = (groupRes as any)?.data?._id || (groupRes as any)?._id;
      } else {
        const autoTitle = computeAutoGroupTitle(part, order, subQuestions.length);
        const passagePayload = {
          examId,
          title: groupTitle.trim() || autoTitle,
          section,
          part: Number(part),
          order: Number(order) || 1,
          passages: [
            {
              type: 'TEXT',
              content: groupContent.trim() || undefined,
              audioUrl: groupAudioUrl || undefined,
              imageUrl: groupImageUrl || undefined,
              order: 1,
            },
          ],
        };

        const groupRes = await examService.createPassageGroup(passagePayload);
        createdGroupId = (groupRes as any)?.data?._id || (groupRes as any)?._id;
      }

      if (!createdGroupId) throw new Error('Không nhận được ID nhóm câu hỏi.');

      // 2. Create all sub-questions linked to createdGroupId
      for (let i = 0; i < subQuestions.length; i++) {
        const q = subQuestions[i];
        if (!q) continue;
        const qPayload = {
          examId,
          passageGroupId: createdGroupId,
          passageId: createdGroupId,
          section,
          part: Number(part),
          content: part === 6 ? (q.content.trim() || `[${Number(order) + i}]`) : q.content.trim(),
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation.trim(),
          order: Number(order) + i,

          isActive: asDraft ? false : isActive,
        };
        await examService.createQuestion(qPayload);
      }

      queryClient.invalidateQueries({ queryKey: ['admin-exam-questions', examId] });
      queryClient.invalidateQueries({ queryKey: ['admin-exam-passages', examId] });
      draftUploads.commit(groupType === 'READING'
        ? readingPassages.map((p) => p.imageUrl) : [groupAudioUrl, groupImageUrl]);
      setSuccessMessage(t('createQuestionPage.msgGroupCreated', {
        count: subQuestions.length,
        type: groupType === 'AUDIO' ? t('createQuestionPage.typeAudio') : t('createQuestionPage.typeReading')
      }));

      // Clear all group form data back to clean initial state & advance order
      const nextOrder = Number(order) + subQuestions.length;
      resetGroupForm(nextOrder);
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      if (createdGroupId) {
        try {
          await examService.deletePassageGroup(createdGroupId);
        } catch {
          // If rollback fails, preserve assets still referenced by persisted passages.
          draftUploads.commit(groupType === 'READING'
            ? readingPassages.map((p) => p.imageUrl) : [groupAudioUrl, groupImageUrl]);
        }
      }
      const msg = err.response?.data?.message || err.message || t('createQuestionPage.msgSaveGroupError');
      showError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      draftUploads.finishSaving();
      submitInProgress.current = false;
      setIsSubmitting(false);
      setSubmittingType(null);
    }
  };

  return (
    <>
    {isSubmitting && (
      <QuestionSavingStatus
        locale={locale}
        title={
          submittingType === 'draft'
            ? (locale === 'en' ? 'Saving draft…' : 'Đang lưu nháp câu hỏi…')
            : (locale === 'en' ? 'Creating questions…' : (isGroupPart ? `Đang tạo cụm ${subQuestions.length} câu hỏi…` : 'Đang tạo câu hỏi…'))
        }
        description={
          locale === 'en'
            ? 'Please wait until the operation completes, do not click again.'
            : 'Đang lưu dữ liệu vào hệ thống, vui lòng đợi và không thao tác liên tiếp.'
        }
      />
    )}
    <div aria-busy={isSubmitting} className={`min-h-screen bg-slate-50/50 p-6 md:p-8 space-y-6 w-full ${isSubmitting ? 'pointer-events-none select-none' : ''}`}>
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
        <div
          id="form-error-alert"
          tabIndex={-1}
          role="alert"
          className="p-4 bg-red-50 border-2 border-red-400 rounded-lg flex items-start gap-3 text-sm text-red-700 shadow-sm animate-in fade-in duration-200"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-red-900 mb-0.5">
              {locale === 'en' ? 'Validation Error / Save Failed:' : 'Có lỗi xảy ra:'}
            </p>
            <p className="font-medium text-red-700 whitespace-pre-line">{errorMessage}</p>
          </div>
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
                    const nextOrder = computeNextOrderForPart(p, existingQuestions);
                    setOrder(nextOrder);
                  }}
                >
                  <SelectTrigger className="w-full h-10 text-xs border rounded border-slate-200 bg-white font-medium">
                    <SelectValue placeholder={t('createQuestionPage.selectPartPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent className="text-xs border rounded border-slate-200">
                    <SelectItem value="1">{t('createQuestionPage.part1Option')}</SelectItem>
                    <SelectItem value="2">{t('createQuestionPage.part2Option')}</SelectItem>
                    <SelectItem value="3">{t('createQuestionPage.part3Option')}</SelectItem>
                    <SelectItem value="4">{t('createQuestionPage.part4Option')}</SelectItem>
                    <SelectItem value="5">{t('createQuestionPage.part5Option')}</SelectItem>
                    <SelectItem value="6">{t('createQuestionPage.part6Option')}</SelectItem>
                    <SelectItem value="7">{t('createQuestionPage.part7Option')}</SelectItem>
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
                  onChange={(e) => {
                    const newOrder = Number(e.target.value);
                    setOrder(newOrder);
                    if (isGroupPart && (!isTitleCustom || isAutoGeneratedTitle(groupTitle) || !groupTitle.trim())) {
                      setGroupTitle(computeAutoGroupTitle(part, newOrder, subQuestions.length));
                    }
                  }}
                  className="w-full h-10 px-3 border rounded border-slate-200 bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Thống kê thứ tự câu hỏi Part theo chuẩn TOEIC */}
              <div className="sm:col-span-3 bg-blue-50/60 border border-blue-200/80 rounded-md p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-blue-900">
                    Part {part}:
                  </span>
                  <span className="text-slate-700">
                    {currentPartRange ? `Câu ${currentPartRange.start} – ${currentPartRange.end} (gồm ${currentPartRange.count} câu)` : ''}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-600">
                    Đã có: <strong className={existingCountInPart >= (currentPartRange?.count || 0) ? 'text-emerald-600 font-bold' : 'text-blue-700 font-bold'}>{existingCountInPart}</strong>/{currentPartRange?.count || 0} câu
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <span>Số thứ tự câu tiếp theo:</span>
                  <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold text-xs shadow-2xs">
                    #{order}
                  </span>
                </div>
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
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-800">
                      {t('createQuestionPage.groupTitleLabel')} <span className="text-red-500">*</span>
                    </label>
                    {isTitleCustom ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsTitleCustom(false);
                          setGroupTitle(computeAutoGroupTitle(part, order, subQuestions.length));
                        }}
                        className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline font-medium"
                      >
                        {locale === 'en' ? 'Reset to auto title' : 'Tự động tạo theo dải câu'}
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">
                        {locale === 'en' ? 'Auto-syncs with questions' : 'Tự động theo dải câu hỏi'}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={groupTitle}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGroupTitle(val);
                      if (!val.trim()) {
                        setIsTitleCustom(false);
                      } else if (isAutoGeneratedTitle(val)) {
                        setIsTitleCustom(false);
                      } else {
                        setIsTitleCustom(true);
                      }
                    }}
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

                {/* Nếu là Part 6, 7: Soạn thảo Bài đọc (Hỗ trợ Đoạn đơn, Đoạn kép & Đoạn ba) */}
                {groupType === 'READING' && (
                  <div className="space-y-4 pt-2">
                    {/* Header + Thêm đoạn văn (Đoạn kép / Đoạn ba) */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          Danh sách đoạn văn ({readingPassages.length} đoạn)
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                          {readingPassages.length === 1
                            ? 'Đoạn đơn (Single Text)'
                            : readingPassages.length === 2
                            ? 'Đoạn kép (Double Texts)'
                            : 'Đoạn ba (Triple Texts)'}
                        </span>
                      </div>

                      {readingPassages.length < 3 && (
                        <button
                          type="button"
                          onClick={handleAddReadingPassage}
                          className="px-3 py-1.5 border rounded border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Thêm đoạn văn ({readingPassages.length === 1 ? 'Đoạn kép' : 'Đoạn ba'})</span>
                        </button>
                      )}
                    </div>

                    {/* Passage Tabs */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
                      {readingPassages.map((rp, idx) => (
                        <button
                          key={rp.id || idx}
                          type="button"
                          onClick={() => setActiveReadingPassageIndex(idx)}
                          className={`px-3.5 py-1.5 border rounded text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
                            activeReadingPassageIndex === idx
                              ? 'border-teal-600 bg-teal-600 text-white shadow-xs'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>{`Đoạn ${idx + 1}`}</span>
                          {rp.content.trim() || rp.imageUrl ? (
                            <Check className="h-3 w-3 text-emerald-300" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Active Passage Editor */}
                    {readingPassages[activeReadingPassageIndex] && (() => {
                      const curPassage = readingPassages[activeReadingPassageIndex]!;
                      return (
                        <div className="p-4 bg-teal-50/20 border rounded border-teal-200/80 space-y-3.5">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-xs font-bold text-teal-900">
                              Chỉnh sửa Đoạn {activeReadingPassageIndex + 1}
                            </span>
                            {readingPassages.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveReadingPassage(activeReadingPassageIndex)}
                                className="text-xs text-red-500 hover:text-red-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Xóa đoạn này</span>
                              </button>
                            )}
                          </div>

                          <label className="block space-y-1.5 text-xs font-semibold text-slate-800">
                            Loại nội dung
                            <select value={curPassage.inputMode || 'TEXT'} disabled={isUploading || isSubmitting}
                              onChange={(e) => updateActiveReadingPassage({ inputMode: e.target.value as 'TEXT' | 'IMAGE', content: '', imageUrl: '', imageFileName: '' })}
                              className="block h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs">
                              <option value="TEXT">Text — Văn bản</option>
                              <option value="IMAGE">Image — Hình ảnh</option>
                            </select>
                            <span className="block font-normal text-slate-500">Mỗi đoạn chỉ dùng văn bản hoặc ảnh. Đổi loại sẽ xóa nội dung hiện tại.</span>
                          </label>
                          {curPassage.inputMode !== 'IMAGE' && (
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                                <span>Nội dung bài đọc (Soạn thảo văn bản Tiptap)</span>
                                <span className="text-[11px] font-normal text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                  Định dạng văn bản TOEIC Part {part}
                                </span>
                              </label>
                              <TiptapEditor
                                value={curPassage.content}
                                onChange={(content) => updateActiveReadingPassage({ content })}
                                placeholder="Nhập nội dung bài đọc hoặc dán văn bản tại đây..."
                                disabled={isUploading || isSubmitting}
                                showToeicBlankHelper={part === 6}
                                nextBlankNumber={order + subQuestions.length}
                                onInsertBlank={handleInsertBlank}
                                onSyncBlanks={handleSyncBlanksFromPassage}
                              />
                            </div>
                          )}

                          {/* Hình ảnh bài đọc */}
                          {curPassage.inputMode === 'IMAGE' && (<div className="space-y-2 pt-2 border-t border-teal-100">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                                <ImageIcon className="h-3.5 w-3.5 text-teal-600" />
                                <span>Hình ảnh bài đọc (nếu bài đọc dạng ảnh scan / bảng biểu / chụp đề):</span>
                              </label>
                              {curPassage.imageUrl && (
                                <button
                                  type="button"
                                  onClick={() => updateActiveReadingPassage({ imageUrl: '', imageFileName: '' })}
                                  className="text-red-500 hover:text-red-700 text-xs font-semibold cursor-pointer"
                                >
                                  Xóa ảnh
                                </button>
                              )}
                            </div>

                            {curPassage.imageUrl ? (
                              <div className="p-3 border rounded border-teal-200 bg-white space-y-2 shadow-xs">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-teal-900 truncate">
                                    {curPassage.imageFileName || 'Ảnh bài đọc đã chọn'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => updateActiveReadingPassage({ imageUrl: '', imageFileName: '' })}
                                    className="text-red-500 hover:text-red-700 text-xs font-semibold cursor-pointer"
                                  >
                                    Xóa ảnh
                                  </button>
                                </div>
                                <div className="border rounded border-slate-100 overflow-hidden bg-slate-50 max-h-64 flex items-center justify-center p-1">
                                  <img
                                    src={curPassage.imageUrl}
                                    alt="Passage Preview"
                                    className="max-h-60 max-w-full object-contain rounded"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <input
                                  type="file"
                                  ref={groupImageInputRef}
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handlePassageImageUpload(file);
                                    e.target.value = '';
                                  }}
                                />

                                <div
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    const file = e.dataTransfer.files?.[0];
                                    if (file && file.type.startsWith('image/')) {
                                      handlePassageImageUpload(file);
                                    }
                                  }}
                                  className="border rounded border-dashed border-teal-300 hover:border-teal-500 p-5 text-center space-y-2 bg-teal-50/20 transition-colors"
                                >
                                  <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center mx-auto">
                                    {isUploading ? (
                                      <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                                    ) : (
                                      <Upload className="h-4 w-4" />
                                    )}
                                  </div>
                                  <div className="text-xs font-semibold text-slate-700">
                                    {isUploading ? 'Đang tải ảnh lên...' : 'Kéo thả ảnh vào đây hoặc'}
                                  </div>
                                  <button
                                    type="button"
                                    disabled={isUploading}
                                    onClick={() => groupImageInputRef.current?.click()}
                                    className="px-3.5 py-1.5 border rounded border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    Chọn ảnh từ thiết bị
                                  </button>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[11px] font-semibold text-slate-600">
                                    Hoặc dán link URL ảnh bài đọc trực tiếp:
                                  </label>
                                  <input
                                    type="url"
                                    value={curPassage.imageUrl || ''}
                                    onChange={(e) =>
                                      updateActiveReadingPassage({
                                        imageUrl: e.target.value,
                                        imageFileName: e.target.value ? 'Ảnh từ URL' : '',
                                      })
                                    }
                                    placeholder="https://example.com/scanned-passage.jpg"
                                    className="w-full h-9 px-3 border rounded border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                  />
                                </div>
                              </div>
                            )}
                          </div>)}
                        </div>
                      );
                    })()}
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

                  {part !== 6 ? (
                    <button
                      type="button"
                      onClick={handleAddSubQuestion}
                      className="px-3 py-1.5 border rounded border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{t('createQuestionPage.addSubQuestionBtn')}</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-semibold flex items-center gap-1.5 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                        Đồng bộ tự động theo nút &ldquo;Chèn ô trống [___]&rdquo; trên bài đọc
                      </span>
                      <button
                        type="button"
                        onClick={handleSyncBlanksFromPassage}
                        className="px-2.5 py-1 border rounded border-teal-300 bg-white hover:bg-teal-50 text-teal-800 text-[11px] font-semibold cursor-pointer transition-colors flex items-center gap-1 shadow-2xs"
                        title="Quét lại tất cả ô trống dạng [131], [132] trong bài đọc để tạo danh sách câu hỏi"
                      >
                        <RotateCcw className="h-3 w-3 text-teal-600" />
                        <span>Quét lại từ bài đọc</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Sub-question Tabs or Empty State */}
                {subQuestions.length === 0 ? (
                  <div className="p-6 border border-dashed rounded border-teal-200 bg-teal-50/20 text-center space-y-2">
                    <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center mx-auto font-bold text-xs">
                      [___]
                    </div>
                    <div className="text-xs font-bold text-slate-800">
                      Chưa có câu hỏi điền từ nào
                    </div>
                    <p className="text-[11px] text-slate-500 max-w-md mx-auto leading-relaxed">
                      Hãy đặt con trỏ chuột vào vị trí cần điền từ trong bài đọc phía trên và bấm nút{' '}
                      <strong className="text-teal-800 font-semibold">&ldquo;Chèn ô trống [{order}]&rdquo;</strong>{' '}
                      để chèn chỗ trống vào văn bản và tự động tạo câu hỏi điền từ tương ứng bên dưới.
                    </p>
                  </div>
                ) : (
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
                        <span>
                          {part === 6 && q.content.startsWith('[') && q.content.endsWith(']')
                            ? `Câu ${q.content}`
                            : t('createQuestionPage.questionNum', { index: idx + 1, num: order + idx })}
                        </span>
                        {q.options.every((o) => o.text.trim()) ? (
                          <Check className="h-3.5 w-3.5 text-emerald-300" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

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
                          <span>
                            {part === 6
                              ? `Đáp án cho ô trống [${order + activeSubIndex}]`
                              : t('createQuestionPage.activeQuestionContentTitle', { num: order + activeSubIndex })}
                          </span>
                        </div>

                        {(subQuestions.length > 1 || part === 6) && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSubQuestion(activeSubIndex)}
                            className="text-xs text-red-500 hover:text-red-700 font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors px-2 py-1 rounded hover:bg-red-50"
                            title={part === 6 ? 'Xóa câu hỏi này, tự động xóa ô trống tương ứng trong bài đọc và đánh số lại thứ tự' : undefined}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{t('createQuestionPage.removeThisQuestionBtn')}</span>
                          </button>
                        )}
                      </div>

                      {part !== 6 ? (
                        <textarea
                          rows={2}
                          value={currentSub.content}
                          onChange={(e) => updateActiveSubQuestion({ content: e.target.value })}
                          placeholder={t('createQuestionPage.subQuestionPlaceholder')}
                          className="w-full p-3 border rounded border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <div className="px-3.5 py-2.5 rounded bg-teal-50/70 border border-teal-200/80 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-teal-600 text-white font-bold text-xs tracking-wide">
                              Câu [{order + activeSubIndex}]
                            </span>
                            <span className="text-teal-900 font-medium">
                              Điền 4 đáp án lựa chọn (A, B, C, D) cho ô trống [{order + activeSubIndex}] trong bài đọc:
                            </span>
                          </div>
                          <span className="text-[11px] text-teal-700 font-semibold bg-teal-100/60 px-2 py-0.5 rounded border border-teal-200">
                            TOEIC Part 6: Không cần nhập đề
                          </span>
                        </div>
                      )}

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
                            <span className="text-red-500">*</span>
                            {imageUrl && <Check className="h-3 w-3 text-emerald-600 ml-0.5" />}
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
                          {(part === 1 || part === 2) && <span className="text-red-500">*</span>}
                          {audioUrl && <Check className="h-3 w-3 text-emerald-600 ml-0.5" />}
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
                        {readingPassages.some((p) => p.imageUrl) ? (
                          <ImageIcon className="h-4 w-4 text-teal-600 shrink-0" />
                        ) : (
                          <FileText className="h-4 w-4 text-teal-600 shrink-0" />
                        )}
                        <span className="truncate">{groupTitle || t('createQuestionPage.previewSharedReading')}</span>
                      </div>
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 shrink-0">
                        {readingPassages.some((p) => p.imageUrl) ? t('createQuestionPage.readingTypeImage') : t('createQuestionPage.readingTypeText')}
                      </span>
                    </div>

                    {readingPassages.map((p, index) => (
                      <div key={p.id} className="space-y-1 rounded border border-slate-200 bg-white p-2">
                        <span className="text-[11px] font-semibold text-slate-700">
                          {p.imageUrl ? 'Hình ảnh' : 'Văn bản'} #{index + 1}
                        </span>
                        {p.imageUrl && <img src={p.imageUrl} alt={`Đoạn ${index + 1}`} className="max-h-48 w-full object-contain" />}
                        {p.content && (
                          p.content.includes('<') ? (
                            <div
                              className="text-[11px] text-slate-600 line-clamp-6 tiptap-content max-w-none"
                              dangerouslySetInnerHTML={{ __html: p.content }}
                            />
                          ) : (
                            <p className="whitespace-pre-line text-[11px] text-slate-600 line-clamp-4">{p.content}</p>
                          )
                        )}
                        {!p.imageUrl && !p.content && <p className="text-[11px] italic text-slate-400">{t('createQuestionPage.previewNoReading')}</p>}
                      </div>
                    ))}
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
                      <div className="text-slate-700 truncate mt-1 text-xs">
                        {q.content.trim() ? (
                          q.content.includes('<') ? (
                            <span dangerouslySetInnerHTML={{ __html: q.content }} />
                          ) : (
                            q.content
                          )
                        ) : (
                          <span className="text-slate-400 italic">{t('createQuestionPage.previewNoContent')}</span>
                        )}
                      </div>
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
                className={`px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors ${
                  isSubmitting ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                {t('createPage.cancel')}
              </Link>

              <button
                type="button"
                onClick={handleManualReset}
                disabled={isSubmitting || isUploading}
                title={t('createQuestionPage.resetFormBtn')}
                className="px-3 py-2 border rounded border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{t('createQuestionPage.resetFormBtn')}</span>
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={isSubmitting || isUploading}
                onClick={() => (isGroupPart ? handleGroupSubmit(true) : handleSingleSubmit(true))}
                className="px-4 py-2 border rounded border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmitting && submittingType === 'draft' ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>{locale === 'en' ? 'Saving draft…' : 'Đang lưu nháp…'}</span>
                  </>
                ) : (
                  <span>{t('createPage.saveDraft')}</span>
                )}
              </button>

              <button
                type="button"
                disabled={isSubmitting || isUploading}
                onClick={() => (isGroupPart ? handleGroupSubmit(false) : handleSingleSubmit(false))}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 rounded text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer"
              >
                {isSubmitting && submittingType === 'create' ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>{t('createQuestionPage.savingBtn', 'Đang tạo câu hỏi...')}</span>
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
    </>
  );
}
