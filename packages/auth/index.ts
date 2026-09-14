export const ADMIN_SESSION_STORAGE_KEY = "listenup-admin-session-v1";
export const STUDENT_SESSION_STORAGE_KEY = "listenup-session";
export const FUTURE_ADMIN_COOKIE_NAME = "__Host-listenup_admin_session";
export const ADMIN_TOKEN_AUDIENCE = "listenup-admin";
export function isAdminStorageKey(key: string) { return key === ADMIN_SESSION_STORAGE_KEY; }
export function isAllowedAdminOrigin(origin: string, configuredOrigin: string) { return origin === configuredOrigin && !origin.includes("*"); }
