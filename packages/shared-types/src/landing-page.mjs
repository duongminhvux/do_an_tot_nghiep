/** Singleton row in public.system_settings that holds the public landing page images. */
export const LANDING_PAGE_SETTINGS_ID = "00000000-0000-4000-8000-000000000012";
export const LANDING_IMAGE_KEYS = Object.freeze([
  "heroImageUrl",
  "vocabularyImageUrl",
  "toeicImageUrl",
  "dictationImageUrl",
  "gamesImageUrl",
  "arenaImageUrl",
]);
export const DEFAULT_LANDING_PAGE_SETTINGS = Object.freeze(
  Object.fromEntries(LANDING_IMAGE_KEYS.map((key) => [key, ""])),
);
/** Same rule as site branding images: empty, http(s) URL, or a root-relative path. */
export const LANDING_IMAGE_URL_PATTERN = /^(?:$|https?:\/\/[^\s]+|\/(?!\/)[^\s\\]*)$/;
export function normalizeLandingPageSettings(input) {
  const result = { ...DEFAULT_LANDING_PAGE_SETTINGS };
  if (!input || typeof input !== "object") return result;
  for (const key of LANDING_IMAGE_KEYS) {
    const value = typeof input[key] === "string" ? input[key].trim() : "";
    if (value.length <= 2000 && LANDING_IMAGE_URL_PATTERN.test(value)) result[key] = value;
  }
  return result;
}
