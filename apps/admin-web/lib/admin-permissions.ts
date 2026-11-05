import type { UserProfile } from "@/types/auth";

/** UI hints only. Backend PostgreSQL principal remains the authorization authority. */
export function hasPermissions(
  user: UserProfile | null | undefined,
  ...codes: string[]
) {
  return (
    user?.role === "ADMIN" &&
    user.status === "ACTIVE" &&
    codes.every((code) => user.permissions?.includes(code))
  );
}
export function canManageIam(
  user: UserProfile | null | undefined,
  ...codes: string[]
) {
  return user?.isSuperAdmin === true && hasPermissions(user, ...codes);
}
const pagePolicies: Array<[RegExp, string[], boolean?]> = [
  [/^\/iam\/admins(?:\/|$)/, ["admins.read", "roles.read"], true],
  [/^\/iam\/roles(?:\/|$)/, ["roles.read"], true],
  [/^\/$/, ["dashboard.read"]],
  [/^\/users(?:\/|$)/, ["users.read"]],
  [/^\/vocabulary(?:\/|$)/, ["vocabulary.read"]],
  [/^\/assessment\/create\/ai(?:\/|$)/, ["toeic.create", "ai_import.create"]],
  [/^\/assessment\/create(?:\/|$)/, ["toeic.create"]],
  [/^\/assessment\/ai-learning(?:\/|$)/, ["ai_import.learning.read"]],
  [/^\/assessment\/[^/]+\/questions\/import(?:\/|$)/, ["toeic.import"]],
  [/^\/assessment\/[^/]+\/questions\/create(?:\/|$)/, ["toeic.create"]],
  [/^\/assessment\/[^/]+\/settings(?:\/|$)/, ["toeic.read", "toeic.update"]],
  [/^\/assessment(?:\/|$)/, ["toeic.read"]],
  [/^\/dictation\/create(?:\/|$)/, ["dictation.create"]],
  [/^\/dictation(?:\/|$)/, ["dictation.read"]],
  [/^\/arena\/settings(?:\/|$)/, ["arena.settings.read"]],
  [/^\/arena(?:\/|$)/, ["arena.read"]],
  [/^\/games\/(scores|statistics)(?:\/|$)/, ["games.results.read"]],
  [/^\/games(?:\/|$)/, ["games.read"]],
  [/^\/learning\/mistakes(?:\/|$)/, ["learning_mistakes.read"]],
  [/^\/learning\/recommendations(?:\/|$)/, ["settings.recommendations.read"]],
  [/^\/content\/quality(?:\/|$)/, ["content_quality.read"]],
  [/^\/media(?:\/|$)/, ["media_library.read"]],
  [/^\/infrastructure(?:\/|$)/, ["infrastructure.read"]],
  [/^\/settings\/landing(?:\/|$)/, ["settings.landing.read"]],
  [/^\/settings(?:\/|$)/, ["settings.read"]],
];
export function canVisit(user: UserProfile | null | undefined, path: string) {
  const rule = pagePolicies.find(([pattern]) => pattern.test(path || "/"));
  return (
    !!rule &&
    (rule[2]
      ? canManageIam(user, ...rule[1])
      : hasPermissions(user, ...rule[1]))
  );
}
export function firstAllowedPath(user: UserProfile | null | undefined) {
  return [
    "/",
    "/iam/admins",
    "/iam/roles",
    "/users",
    "/vocabulary/words",
    "/assessment",
    "/dictation",
    "/arena",
    "/games",
    "/media",
    "/settings",
    "/arena/settings",
    "/games/scores",
    "/learning/mistakes",
    "/learning/recommendations",
    "/content/quality",
    "/infrastructure",
    "/settings/landing",
    "/assessment/ai-learning",
    "/assessment/create",
    "/dictation/create",
  ].find((path) => canVisit(user, path));
}
export function verifiedAdminProfile(value: unknown): UserProfile {
  const profile = value as UserProfile;
  if (
    !profile ||
    profile.role !== "ADMIN" ||
    profile.status !== "ACTIVE" ||
    !Array.isArray(profile.permissions) ||
    !profile.permissions.every((code) => typeof code === "string") ||
    !Array.isArray(profile.roleCodes) ||
    !profile.roleCodes.every((code) => typeof code === "string") ||
    typeof profile._id !== "string" ||
    !Number.isInteger(profile.authVersion) ||
    (profile.authVersion || 0) < 1 ||
    typeof profile.isSuperAdmin !== "boolean"
  )
    throw new Error("Invalid admin principal");
  return profile;
}
