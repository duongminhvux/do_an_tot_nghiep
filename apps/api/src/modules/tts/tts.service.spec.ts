import { describe, expect, it, vi } from "vitest";
import { UserRole } from "../../generated/prisma/client";
import { TtsService } from "./tts.service";

describe("TtsService generation authorization", () => {
  it("checks exercise scope before calling the provider", async () => {
    const accessError = new Error("not assigned");
    const exerciseAccess = {
      assertManage: vi.fn().mockRejectedValue(accessError),
    };
    const provider = { synthesize: vi.fn() };
    const service = new TtsService(
      {} as never,
      {} as never,
      exerciseAccess as never,
      provider as never,
      { get: vi.fn() } as never,
      {} as never,
    );
    const teacher = {
      id: "teacher-id",
      email: "teacher@test.local",
      role: UserRole.TEACHER,
      clientType: "ADMIN_WEB" as const,
    };

    await expect(
      service.generate(teacher, "unassigned-exercise", {
        text: "Generate me",
      }),
    ).rejects.toBe(accessError);
    expect(exerciseAccess.assertManage).toHaveBeenCalledWith(
      teacher,
      "unassigned-exercise",
    );
    expect(provider.synthesize).not.toHaveBeenCalled();
  });

  it("returns 503 without calling a provider after scope authorization", async () => {
    const exerciseAccess = {
      assertManage: vi.fn().mockResolvedValue(undefined),
    };
    const provider = { synthesize: vi.fn() };
    const service = new TtsService(
      {} as never,
      {} as never,
      exerciseAccess as never,
      provider as never,
      { get: vi.fn() } as never,
      {} as never,
    );
    const teacher = {
      id: "teacher-id",
      email: "teacher@test.local",
      role: UserRole.TEACHER,
      clientType: "ADMIN_WEB" as const,
    };

    await expect(
      service.generate(teacher, "exercise-id", { text: "Generate me" }),
    ).rejects.toMatchObject({
      code: "TTS_PROVIDER_NOT_CONFIGURED",
      status: 503,
    });
    expect(provider.synthesize).not.toHaveBeenCalled();
  });
});
