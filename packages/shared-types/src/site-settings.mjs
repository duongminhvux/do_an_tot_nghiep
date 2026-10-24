export const DEFAULT_SITE_SETTINGS = Object.freeze({
  siteName: "English Platform",
  siteDescription: "Learn English vocabulary and grammar effectively",
  logoUrl: "",
  iconUrl: "",
  faviconUrl: "",
  timezone: "Asia/Ho_Chi_Minh",
});
export function normalizeSiteSettings(input) {
  const result = { ...DEFAULT_SITE_SETTINGS };
  if (!input || typeof input !== "object") return result;
  for (const key of Object.keys(result)) {
    if (typeof input[key] === "string") result[key] = input[key].trim();
  }
  if (!result.siteName) result.siteName = DEFAULT_SITE_SETTINGS.siteName;
  try {
    new Intl.DateTimeFormat("en", { timeZone: result.timezone });
  } catch {
    result.timezone = DEFAULT_SITE_SETTINGS.timezone;
  }
  return result;
}
