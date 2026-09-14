import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { ContentStatus, UserRole } from "../../generated/prisma/client";
import { LessonsController } from "./lessons.controller";
import { LessonsService } from "./lessons.service";

describe("LessonsController role metadata", () => {
  it("explicitly denies students on the lesson draft update route", () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      LessonsController.prototype.saveDraft,
    );
    expect(roles).toEqual([UserRole.ADMIN, UserRole.TEACHER]);
    expect(roles).not.toContain(UserRole.STUDENT);
  });
});

describe("LessonsService student exercise counts", () => {
  it("filters sibling lesson counts to published exercises", async () => {
    const prisma = {
      course: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "course-id",
          slug: "course",
          title: "Course",
        }),
      },
      lesson: {
        findFirstOrThrow: vi.fn().mockResolvedValue({
          id: "lesson-id",
          slug: "lesson",
          title: "Lesson",
          description: "Description",
          estimatedDurationMinutes: 10,
          vocabulary: [],
          expressions: [],
          resources: [],
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "lesson-id",
            slug: "lesson",
            orderIndex: 0,
            title: "Lesson",
            estimatedDurationMinutes: 10,
            progress: [],
            _count: { exercises: 2 },
          },
        ]),
      },
      listeningExercise: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new LessonsService(
      prisma as never,
      { assertStudentView: vi.fn() } as never,
    );
    const student = {
      id: "student-id",
      email: "student@test.local",
      role: UserRole.STUDENT,
      clientType: "USER_WEB" as const,
    };

    const result = await service.studentDetail(student, "course", "lesson");
    expect(result.lessons[0].exerciseCount).toBe(2);
    expect(prisma.lesson.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          _count: {
            select: {
              exercises: { where: { status: ContentStatus.PUBLISHED } },
            },
          },
        }),
      }),
    );
  });
});
