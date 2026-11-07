import {
  validatePublication,
  type PublicationKind,
} from '@repo/shared-types/publication';
import { checkExam, TOEIC_PART_COUNTS } from '@repo/shared-types/exam-checks';

export { TOEIC_PART_COUNTS };

export type QualityCategory = 'DATA' | 'MEDIA' | 'DUPLICATE' | 'FEEDBACK';
export type QualityIssue = {
  category: QualityCategory;
  code: string;
  path: string;
  severity: 'error' | 'warning';
  messageVi: string;
  messageEn: string;
};
export type QualityItem = {
  kind: PublicationKind;
  id: string;
  title: string;
  editPath: string;
  updatedAt: string | null;
  issues: QualityIssue[];
  media: { path: string; url: string }[];
};
export const QUALITY_KINDS: PublicationKind[] = [
  'words',
  'lessons',
  'dictation',
  'exams',
];
export const QUALITY_TABLES = {
  words: 'words',
  lessons: 'lessons',
  dictation: 'dictationlessons',
  exams: 'exams',
};

/** Category by code (not by message wording), so translations never move an issue. */
const MEDIA_CODES = new Set([
  'IMAGE_REQUIRED',
  'AUDIO_REQUIRED',
  'AUDIO_STALE',
  'AUDIO_NOT_READY',
  'MEDIA_MISSING',
  'MEDIA_UNVERIFIED',
]);
const DUPLICATE_CODES = new Set(['DUPLICATE', 'EXACT_WORD']);
export const qualityCategory = (code: string): QualityCategory =>
  DUPLICATE_CODES.has(code)
    ? 'DUPLICATE'
    : MEDIA_CODES.has(code)
      ? 'MEDIA'
      : 'DATA';

const text = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0;
const list = (value: unknown): any[] => (Array.isArray(value) ? value : []);

function wordRecommendations(doc: Record<string, any>) {
  const missing: [string, string][] = [];
  if (!text(doc.ipa?.us) && !text(doc.ipa?.uk))
    missing.push(['phiên âm IPA', 'IPA']);
  const meanings = list(doc.parts).flatMap((part) => list(part?.meanings));
  if (
    meanings.length &&
    !meanings.some((m) => list(m?.examples).some((e) => text(e?.en)))
  )
    missing.push(['câu ví dụ', 'example sentence']);
  if (
    meanings.length &&
    !meanings.some((m) => list(m?.translation).some(text) || text(m?.translation))
  )
    missing.push(['nghĩa tiếng Việt', 'Vietnamese meaning']);
  return missing;
}

/** Exam-size findings (question-level rules already come from validatePublication). */
function examCompleteness(doc: Record<string, any>, language: 'vi' | 'en') {
  return checkExam(
    { exam: { type: doc.type, totalQuestions: doc.totalQuestions }, questions: doc.questions ?? [], groups: doc.groups ?? [] },
    language,
  ).filter((issue) => issue.scope === 'exam' || issue.code === 'TOEIC_PART_COUNT')
    .filter((issue) => issue.code !== 'EMPTY');
}

export function qualityItem(
  kind: PublicationKind,
  doc: Record<string, any>,
): QualityItem {
  const id = String(doc.id);
  const editPath =
    kind === 'words'
      ? `/vocabulary/words?editWordId=${id}`
      : kind === 'lessons'
        ? `/vocabulary/collections?collectionId=${doc.collectionId}&lessonId=${id}`
        : kind === 'exams'
          ? `/assessment/${id}`
          : `/dictation/${id}`;
  const issues: QualityIssue[] = [];
  try {
    const en = validatePublication(kind, doc, 'en');
    const vi = validatePublication(kind, doc, 'vi');
    en.forEach((issue, index) =>
      issues.push({
        ...issue,
        category: qualityCategory(issue.code),
        messageVi: vi[index]?.message ?? issue.message,
        messageEn: issue.message,
      }),
    );
    if (kind === 'words') {
      const missing = wordRecommendations(doc);
      if (missing.length)
        issues.push({
          category: 'DATA',
          code: 'WORD_RECOMMENDED',
          path: 'word',
          severity: 'warning',
          messageVi: `Nên bổ sung: ${missing.map((m) => m[0]).join(', ')}.`,
          messageEn: `Recommended: add ${missing.map((m) => m[1]).join(', ')}.`,
        });
    } else if (kind === 'dictation') {
      const missing: [string, string][] = [];
      if (!text(doc.title)) missing.push(['tiêu đề', 'title']);
      if (!text(doc.slug)) missing.push(['slug', 'slug']);
      if (!doc.topicId) missing.push(['chủ đề', 'topic']);
      if (doc.level == null || doc.level === '')
        missing.push(['trình độ', 'level']);
      if (missing.length)
        issues.push({
          category: 'DATA',
          code: 'DICTATION_FIELDS',
          path: 'lesson',
          severity: 'error',
          messageVi: `Thiếu trường bắt buộc: ${missing.map((m) => m[0]).join(', ')}.`,
          messageEn: `Missing required fields: ${missing.map((m) => m[1]).join(', ')}.`,
        });
    } else if (kind === 'exams') {
      const vi = examCompleteness(doc, 'vi');
      const en = examCompleteness(doc, 'en');
      vi.forEach((issue, index) =>
        issues.push({
          category: 'DATA',
          code: issue.code,
          path: issue.part ? `part.${issue.part}` : 'questions',
          severity: issue.severity,
          messageVi: issue.message,
          messageEn: en[index]?.message ?? issue.message,
        }),
      );
    }
  } catch {
    issues.push({
      category: 'DATA',
      code: 'MALFORMED',
      path: '',
      severity: 'error',
      messageVi:
        'Dữ liệu không đúng cấu trúc; cần kiểm tra trong trình biên tập.',
      messageEn: 'Malformed content; review it in the editor.',
    });
  }
  const media: QualityItem['media'] = [];
  const add = (path: string, value: unknown) => {
    if (typeof value === 'string' && value.trim())
      media.push({ path, url: value.trim() });
  };
  if (kind === 'words') {
    add('audio.us', doc.audio?.us);
    add('audio.uk', doc.audio?.uk);
    if (!media.length)
      issues.push({
        category: 'MEDIA',
        code: 'AUDIO_REQUIRED',
        path: 'audio',
        severity: 'warning',
        messageVi: 'Từ chưa có audio phát âm.',
        messageEn: 'The word has no pronunciation audio.',
      });
    add('imageUrl', doc.imageUrl);
  } else if (kind === 'dictation') {
    add('fullAudioUrl', doc.fullAudioUrl);
    for (const s of doc.segments ?? [])
      add(`segments.${s.id}.audioUrl`, s.audioUrl);
  } else if (kind === 'exams') {
    for (const q of doc.questions ?? []) {
      if (q.isActive === false) continue;
      add(`questions.${q.id}.audioUrl`, q.audioUrl);
      add(`questions.${q.id}.imageUrl`, q.imageUrl);
    }
    for (const g of doc.groups ?? [])
      for (const p of g.passages ?? []) {
        add(`passages.${p.id}.audioUrl`, p.audioUrl);
        add(`passages.${p.id}.imageUrl`, p.imageUrl);
      }
  }
  return {
    kind,
    id,
    title: String(doc.name ?? doc.title ?? doc.word ?? id),
    editPath,
    updatedAt: doc.updatedAt ?? null,
    issues,
    media,
  };
}
