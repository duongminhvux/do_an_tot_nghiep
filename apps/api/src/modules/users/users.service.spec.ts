import { describe, expect, it, vi } from "vitest";
import { EnglishLevel } from "../../generated/prisma/client";
import { UsersService } from "./users.service";

const profileRecord = {
  id: "student-id",
  fullName: "Student",
  email: "student@test.local",
  role: "STUDENT",
  status: "ACTIVE",
  studentProfile: {
    targetLevel: EnglishLevel.INTERMEDIATE,
    learningGoal: "Listen better",
  },
};

describe("UsersService profile level contract", () => {
  it("returns the canonical enum and safely handles an unset level", async () => {
    const prisma = {
      user: { findUniqueOrThrow: vi.fn().mockResolvedValue(profileRecord) },
    };
    const service = new UsersService(prisma as never, {} as never);
    await expect(service.profile("student-id")).resolves.toMatchObject({
      targetLevel: "INTERMEDIATE",
    });

    prisma.user.findUniqueOrThrow.mockResolvedValue({
      ...profileRecord,
      studentProfile: null,
    });
    await expect(service.profile("student-id")).resolves.toMatchObject({
      targetLevel: "",
    });
  });

  it("persists and returns the same canonical enum", async () => {
    const tx = {
      user: { update: vi.fn() },
      studentProfile: { upsert: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (work) => work(tx)),
      user: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...profileRecord,
          studentProfile: {
            ...profileRecord.studentProfile,
            targetLevel: EnglishLevel.UPPER_INTERMEDIATE,
          },
        }),
      },
    };
    const service = new UsersService(prisma as never, {} as never);
    await expect(
      service.updateProfile("student-id", {
        targetLevel: EnglishLevel.UPPER_INTERMEDIATE,
      }),
    ).resolves.toMatchObject({ targetLevel: "UPPER_INTERMEDIATE" });
    expect(tx.studentProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          targetLevel: EnglishLevel.UPPER_INTERMEDIATE,
        }),
      }),
    );
  });
});
