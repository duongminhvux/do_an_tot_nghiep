import { z } from "zod";

const booleanValue = z.preprocess(
  (value) => value === true || value === "true" || value === "1",
  z.boolean(),
);

const knownJwtDefaults = new Set([
  "listenup-development-access-secret-change-me",
  "listenup-compose-access-secret-change-before-production",
  "replace-with-at-least-32-random-characters",
]);
const knownDatabasePasswords = new Set([
  "listenup_dev_password",
  "listenup_dev_only",
]);

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    API_PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1),
    CORS_ORIGINS: z
      .string()
      .default("http://localhost:3000,http://localhost:3001"),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32)
      .default("listenup-development-access-secret-change-me"),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    REFRESH_TOKEN_EXPIRES_IN: z.string().default("7d"),
    COOKIE_SECURE: booleanValue.default(false),
    MEDIA_ROOT: z.string().default("./storage/media"),
    MEDIA_PUBLIC_BASE_URL: z
      .string()
      .default("http://localhost:4000/api/v1/media"),
    MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().max(100).default(25),
    TTS_ENABLED: booleanValue.default(false),
    TTS_PROVIDER: z.enum(["none", "kokoro"]).default("none"),
    KOKORO_TTS_URL: z.string().url().default("http://tts-service:8001"),
    KOKORO_TTS_TIMEOUT_MS: z.coerce.number().int().positive().max(300000).default(120000),
    RESET_URL_BASE: z
      .string()
      .url()
      .default("http://localhost:3000/reset-password"),
    ADMIN_RESET_URL_BASE: z
      .string()
      .url()
      .default("http://localhost:3001/reset-password"),
  })
  .superRefine((value, context) => {
    if (
      value.NODE_ENV === "production" &&
      knownJwtDefaults.has(value.JWT_ACCESS_SECRET)
    ) {
      context.addIssue({
        code: "custom",
        path: ["JWT_ACCESS_SECRET"],
        message: "Production requires a non-default JWT_ACCESS_SECRET.",
      });
    }
    if (value.NODE_ENV === "production") {
      try {
        const database = new URL(value.DATABASE_URL);
        if (
          !database.password ||
          database.password.length < 12 ||
          knownDatabasePasswords.has(decodeURIComponent(database.password))
        ) {
          context.addIssue({
            code: "custom",
            path: ["DATABASE_URL"],
            message:
              "Production requires a non-default PostgreSQL password of at least 12 characters.",
          });
        }
      } catch {
        context.addIssue({
          code: "custom",
          path: ["DATABASE_URL"],
          message: "DATABASE_URL must be a valid PostgreSQL URL.",
        });
      }
    }
    if (value.NODE_ENV === "production" && !value.COOKIE_SECURE) {
      context.addIssue({
        code: "custom",
        path: ["COOKIE_SECURE"],
        message: "COOKIE_SECURE must be true in production.",
      });
    }
    if (value.TTS_ENABLED && value.TTS_PROVIDER !== "kokoro") {
      context.addIssue({
        code: "custom",
        path: ["TTS_PROVIDER"],
        message: "Enabled TTS currently requires TTS_PROVIDER=kokoro.",
      });
    }
    if (!value.TTS_ENABLED && value.TTS_PROVIDER !== "none") {
      context.addIssue({
        code: "custom",
        path: ["TTS_PROVIDER"],
        message: "Disabled TTS must use TTS_PROVIDER=none.",
      });
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  input: Record<string, unknown>,
): Environment {
  return environmentSchema.parse(input);
}

export function parseDurationSeconds(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2];
  return amount * ({ s: 1, m: 60, h: 3600, d: 86400 }[unit] ?? 1);
}
