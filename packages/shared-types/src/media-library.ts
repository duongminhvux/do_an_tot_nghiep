export type MediaCategory = "dictation" | "vocab" | "toeic" | "games" | "users";
export type MediaItemKind = "lesson" | "collection" | "word" | "exam" | "game" | "user";
export interface MediaLibraryItem {
  id: string;
  title: string;
  subtitle: string;
  kind: MediaItemKind;
  status: string;
  previewUrl?: string;
}
export interface MediaUsage {
  label: string;
  labelEn: string;
  sourceId: string;
}
export interface MediaReference {
  url: string;
  type: "image" | "audio";
  usages: MediaUsage[];
}
export interface MediaLibraryList {
  items: MediaLibraryItem[];
  total: number;
  page: number;
  pageSize: number;
}
export interface MediaLibraryDetail {
  item: MediaLibraryItem;
  assets: MediaReference[];
}
