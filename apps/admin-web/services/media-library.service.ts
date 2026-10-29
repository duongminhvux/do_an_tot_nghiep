import apiClient from "@/lib/axios";
import type {
  MediaItemKind,
  MediaLibraryDetail,
  MediaLibraryList,
} from "@repo/shared-types";

export const mediaLibraryService = {
  async list(
    category: "dictation" | "vocab" | "toeic" | "games",
    params: {
      kind?: MediaItemKind;
      search?: string;
      page: number;
      pageSize: number;
    },
  ) {
    return (
      await apiClient.get<{ data: MediaLibraryList }>(
        `/admin/media-library/${category}/items`,
        { params },
      )
    ).data.data;
  },
  async detail(
    category: "dictation" | "vocab" | "toeic" | "games",
    id: string,
    kind?: MediaItemKind,
  ) {
    return (
      await apiClient.get<{ data: MediaLibraryDetail }>(
        `/admin/media-library/${category}/items/${id}`,
        { params: { kind } },
      )
    ).data.data;
  },
};
