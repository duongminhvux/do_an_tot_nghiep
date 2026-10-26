export type PublicationKind = "exams" | "words" | "lessons" | "dictation";
export type PublicationStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED";
export interface PublicationIssue {
  code: string;
  path: string;
  severity: "error" | "warning";
  message: string;
}
export interface PublicationInfo {
  id: string;
  publicationStatus: PublicationStatus;
  publicationRevision: number;
  publicationValidation?: {
    revision: number;
    checkedAt: string;
    issues: PublicationIssue[];
  } | null;
  publishedBy?: string;
  publishedAt?: string;
  audit?: {
    action: string;
    actorId: string;
    revision: number;
    createdAt: string;
  }[];
}
export const PUBLICATION_STATES: PublicationStatus[];
export function validatePublication(
  kind: PublicationKind,
  data: Record<string, any>,
  language?: string,
): PublicationIssue[];
