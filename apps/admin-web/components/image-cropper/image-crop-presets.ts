/** Aspect is a crop constraint; output is an upper bound, never CSS display size. */
export type ImageCropPreset = {
  aspectRatio: number | "original";
  outputWidth: number;
  outputHeight: number;
  shape?: "rect" | "round";
  format?: "image/jpeg" | "image/png" | "image/webp";
  quality?: number;
};
export const imageCropPresets = {
  avatar: {
    aspectRatio: 1,
    outputWidth: 512,
    outputHeight: 512,
    shape: "round",
  },
  collection: { aspectRatio: 16 / 9, outputWidth: 1280, outputHeight: 720 },
  content: { aspectRatio: "original", outputWidth: 2000, outputHeight: 2000 },
  word: { aspectRatio: "original", outputWidth: 1600, outputHeight: 1600 },
  game: { aspectRatio: 16 / 9, outputWidth: 1280, outputHeight: 720 },
  topic: { aspectRatio: 1, outputWidth: 512, outputHeight: 512 },
  logo: { aspectRatio: "original", outputWidth: 1200, outputHeight: 600 },
  icon: { aspectRatio: 1, outputWidth: 128, outputHeight: 128 },
  favicon: { aspectRatio: 1, outputWidth: 32, outputHeight: 32 },
  landingFeature: { aspectRatio: 4 / 3, outputWidth: 1200, outputHeight: 900 },
  landingCard: { aspectRatio: 16 / 10, outputWidth: 1280, outputHeight: 800 },
} satisfies Record<string, ImageCropPreset>;
export const cropPresetForLanding = (key: string) =>
  key === "gamesImageUrl" || key === "arenaImageUrl"
    ? imageCropPresets.landingCard
    : imageCropPresets.landingFeature;
