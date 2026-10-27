import apiClient from "@/lib/axios";
import type {
  PublicationInfo,
  PublicationKind,
} from "@repo/shared-types/publication";
export interface PublicationPreview {
  kind: PublicationKind;
  title: string;
  questions?: {
    _id: string;
    part: number;
    content: string;
    options: { key: string; text: string }[];
    imageUrl?: string;
    audioUrl?: string;
    passages: { content?: string; imageUrl?: string; audioUrl?: string }[];
  }[];
  fullAudioUrl?: string;
  segments?: { id: string; text: string; startMs: number; endMs: number }[];
  parts?: {
    partOfSpeech: string;
    meanings: { definition?: string; translation?: string[] }[];
  }[];
  audio?: { us?: string; uk?: string };
  words?: { id: string; word: string; available: boolean }[];
}
export const publicationService = {
  async info(kind: PublicationKind, id: string): Promise<PublicationInfo> {
    return (await apiClient.get(`/admin/${kind}/${id}/publication`)).data.data;
  },
  async action(
    kind: PublicationKind,
    id: string,
    action: "validate" | "publish" | "unpublish",
    lang: string,
  ): Promise<PublicationInfo> {
    const result = (
      await apiClient.post(`/admin/${kind}/${id}/${action}`, undefined, {
        params: { lang },
      })
    ).data.data;
    // Dictation keeps the legacy lesson response for publish/unpublish.
    return kind === "dictation" && action !== "validate"
      ? this.info(kind, id)
      : result;
  },
  async preview(
    kind: PublicationKind,
    id: string,
  ): Promise<PublicationPreview> {
    return (await apiClient.get(`/admin/${kind}/${id}/preview`)).data.data;
  },
};
