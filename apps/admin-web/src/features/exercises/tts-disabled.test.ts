import { beforeEach, describe, expect, it } from "vitest";
import { UserRole, UserStatus } from "@listenup/domain";
import { adminMockApi } from "@/lib/api/mock-service";

const admin = {
  id: "admin-id",
  fullName: "Admin",
  email: "admin@test.local",
  role: UserRole.ADMIN,
  status: UserStatus.ACTIVE,
  assignedCourseIds: [],
};

describe("disabled exercise TTS", () => {
  beforeEach(() => localStorage.clear());

  it("rejects one real-script request without fabricating completion", async () => {
    const before = adminMockApi.getExerciseDraft();
    await expect(
      adminMockApi.createTts(admin, "exercise-id", {
        text: "The actual exercise script",
        voiceId: "future-voice",
        language: "en-US",
        speed: 0.95,
      }),
    ).rejects.toMatchObject({
      code: "TTS_PROVIDER_NOT_CONFIGURED",
      status: 503,
    });
    const after = adminMockApi.getExerciseDraft();
    expect(after).toEqual(before);
    expect(after).not.toMatchObject({
      ttsStatus: "COMPLETED",
      audioReady: true,
    });
  });
});
