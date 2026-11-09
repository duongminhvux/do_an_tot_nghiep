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
  /** Derived admin state. Present on API responses after the Phase 2 refactor. */
  visibility?: PublicationVisibility;
  /** Live validation of the saved content (read-only, not persisted). */
  currentIssues?: PublicationIssue[];
  isActive?: boolean;
  audit?: {
    action: string;
    actorId: string;
    revision: number;
    createdAt: string;
    /** Errors recorded with the action (a refused "Show" is a VALIDATE with errors). */
    issueCount?: number;
  }[];
}
export const PUBLICATION_STATES: PublicationStatus[];
export type PublicationVisibility = "VISIBLE" | "HIDDEN" | "INCOMPLETE";
export const VISIBILITY_STATES: PublicationVisibility[];
export function publicationVisibility(
  item: {
    publicationStatus?: string;
    publicationRevision?: number;
    publicationValidation?: { revision?: number; issues?: { severity: string }[] } | null;
    isActive?: boolean;
    is_active?: boolean;
  } | null | undefined,
  issues?: { severity: string }[],
): PublicationVisibility;
export function validatePublication(
  kind: PublicationKind,
  data: Record<string, any>,
  language?: string,
): PublicationIssue[];
