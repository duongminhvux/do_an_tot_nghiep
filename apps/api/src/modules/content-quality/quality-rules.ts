import {
  validatePublication,
  type PublicationKind,
} from '@repo/shared-types/publication';

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
        category: /DUPLICATE/.test(issue.code)
          ? 'DUPLICATE'
          : /AUDIO|MEDIA|IMAGE|URL/.test(issue.code) ||
              /audio|image|media|URL/i.test(issue.message)
            ? 'MEDIA'
            : 'DATA',
        messageVi: vi[index]?.message ?? issue.message,
        messageEn: issue.message,
      }),
    );
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
