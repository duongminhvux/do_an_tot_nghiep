export interface ImportOption {
  key: string;
  text: string;
}
export interface ImportQuestion {
  content: string;
  options: ImportOption[];
  correctAnswer: string;
  explanation?: string;
  order?: number;
  sourceLine?: number;
  passageGroupTempId?: string;
  passageTempId?: string;
  imageUrl?: string;
  audioUrl?: string;
  isActive?: boolean;
}
export interface ImportPassage {
  id: string;
  tempId: string;
  groupTempId?: string;
  type: "TEXT" | "EMAIL" | "ADVERTISEMENT" | "ARTICLE" | "NOTICE" | "CHAT";
  title?: string;
  content: string;
  imageUrl?: string;
  audioUrl?: string;
  order?: number;
  inputMode?: "TEXT" | "IMAGE";
}
export interface ImportGroup {
  id: string;
  tempId: string;
  title: string;
  order: number;
  passages: ImportPassage[];
  hasCustomTitle?: boolean;
}
export interface ImportDraft {
  groups: ImportGroup[];
  passages: ImportPassage[];
  questions: ImportQuestion[];
  passage?: ImportPassage | null;
  warnings?: ImportIssue[];
}
export interface ImportIssue {
  severity: "error" | "warning";
  message: string;
  questionIndex?: number;
  groupId?: string;
  passageId?: string;
  line?: number;
}
export function parseImportText(
  text: string,
  part?: number,
  section?: string,
): ImportDraft;
export function serializeImportDraft(
  draft: Pick<ImportDraft, "groups" | "questions">,
): string;
export function validateImportDraft(
  draft: Pick<ImportDraft, "groups" | "questions">,
  part: number,
  locale?: string,
  optionsCount?: number,
): ImportIssue[];
