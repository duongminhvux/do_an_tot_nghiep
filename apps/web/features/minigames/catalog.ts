import apiClient from "@/lib/axios";
export interface CatalogGame {
  _id: string;
  code: string;
  name: string;
  nameEn?: string;
  description: string;
  descriptionEn?: string;
  imageUrl: string;
  destination: string;
  category: "SOLO" | "MULTIPLAYER";
  order: number;
}
export async function getGameCatalog() {
  return (await apiClient.get<{ data: CatalogGame[] }>("/minigames/catalog"))
    .data.data;
}
