import { describe, expect, it } from "vitest";
import { validateEnvironment } from "./env.validation";

const production = {
  NODE_ENV: "production",
  DATABASE_URL:
    "postgresql://listenup:a-strong-database-password@db:5432/listenup",
  JWT_ACCESS_SECRET: "a-strong-access-secret-with-more-than-32-characters",
  COOKIE_SECURE: "true",
};

describe("production environment validation", () => {
  it("rejects a missing production JWT secret", () => {
    expect(() =>
      validateEnvironment({ ...production, JWT_ACCESS_SECRET: undefined }),
    ).toThrow();
  });

  it.each([
    "replace-with-at-least-32-random-characters",
    "listenup-compose-access-secret-change-before-production",
    "listenup-development-access-secret-change-me",
  ])("rejects known default secret %s", (JWT_ACCESS_SECRET) => {
    expect(() =>
      validateEnvironment({ ...production, JWT_ACCESS_SECRET }),
    ).toThrow();
  });

  it("rejects a too-short secret and default database password", () => {
    expect(() =>
      validateEnvironment({
        ...production,
        JWT_ACCESS_SECRET: "too-short",
        DATABASE_URL:
          "postgresql://listenup:listenup_dev_password@db:5432/listenup",
      }),
    ).toThrow();
  });

  it("accepts strong, non-default production secrets", () => {
    expect(validateEnvironment(production)).toMatchObject({
      NODE_ENV: "production",
      COOKIE_SECURE: true,
    });
  });

  it("accepts local Kokoro when enabled and rejects mismatched TTS configuration", () => {
    expect(
      validateEnvironment({
        ...production,
        TTS_ENABLED: "true",
        TTS_PROVIDER: "kokoro",
      }),
    ).toMatchObject({ TTS_ENABLED: true, TTS_PROVIDER: "kokoro" });
    expect(() =>
      validateEnvironment({
        ...production,
        TTS_ENABLED: "false",
        TTS_PROVIDER: "kokoro",
      }),
    ).toThrow();
    expect(
      validateEnvironment({
        ...production,
        TTS_ENABLED: "false",
        TTS_PROVIDER: "none",
      }),
    ).toMatchObject({ TTS_ENABLED: false, TTS_PROVIDER: "none" });
  });
});
