import { describe, expect, it, vi } from "vitest";
import { ContentStatus, UserRole } from "../../generated/prisma/client";
import { CoursesService } from "./courses.service";

const teacher = {
  id: "teacher-id",
  email: "teacher@test.local",
  role: UserRole.TEACHER,
  clientType: "ADMIN_WEB" as const,
};

describe("CoursesService permissions", () => {
  it("rejects course creation by a teacher before writing", async () => {
    const prisma = { course: { create: vi.fn() } };
    const service = new CoursesService(
      prisma as never,
      { assertManage: vi.fn() } as never,
    );

    await expect(
      service.create(teacher, {
        title: "Restricted course",
        description: "Not allowed",
        level: "INTERMEDIATE" as never,
        category: "Business",
      }),
    ).rejects.toMatchObject({ code: "COURSE_CREATE_FORBIDDEN", status: 403 });
    expect(prisma.course.create).not.toHaveBeenCalled();
  });

  it("rejects assignment changes by an assigned teacher", async () => {
    const access = { assertManage: vi.fn().mockResolvedValue(undefined) };
    const prisma = { $transaction: vi.fn() };
    const service = new CoursesService(prisma as never, access as never);

    await expect(
      service.update(teacher, "course-id", {
        assignedTeacherIds: ["00000000-0000-4000-8000-000000000001"],
      }),
    ).rejects.toMatchObject({
      code: "TEACHER_ASSIGNMENT_FORBIDDEN",
      status: 403,
    });
    expect(access.assertManage).toHaveBeenCalledWith(teacher, "course-id");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("assigns duplicate-name teachers by UUID without any name lookup", async () => {
    const ids = [
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
    ];
    const tx = {
      user: {
        findMany: vi.fn().mockResolvedValue(ids.map((id) => ({ id }))),
      },
      courseTeacherAssignment: {
        updateMany: vi.fn(),
        upsert: vi.fn(),
      },
    };
    const service = new CoursesService({} as never, {} as never);

    await (
      service as unknown as {
        syncTeachers(
          tx: unknown,
          courseId: string,
          teacherIds: string[],
          assignedById: string,
        ): Promise<void>;
      }
    ).syncTeachers(tx, "course-id", ids, "admin-id");

    expect(tx.user.findMany).toHaveBeenCalledWith({
      where: { role: UserRole.TEACHER, id: { in: ids } },
      select: { id: true },
    });
    expect(tx.courseTeacherAssignment.upsert).toHaveBeenCalledTimes(2);
  });

  it("rejects unknown or non-teacher assignment IDs", async () => {
    const tx = {
      user: { findMany: vi.fn().mockResolvedValue([]) },
      courseTeacherAssignment: { updateMany: vi.fn(), upsert: vi.fn() },
    };
    const service = new CoursesService({} as never, {} as never);
    await expect(
      (
        service as unknown as {
          syncTeachers(
            tx: unknown,
            courseId: string,
            teacherIds: string[],
            assignedById: string,
          ): Promise<void>;
        }
      ).syncTeachers(
        tx,
        "course-id",
        ["00000000-0000-4000-8000-000000000003"],
        "admin-id",
      ),
    ).rejects.toMatchObject({
      code: "INVALID_ASSIGNED_TEACHER_IDS",
      status: 422,
    });
  });
});

describe("CoursesService student exercise counts", () => {
  it("requests only published exercises in course lesson counts", async () => {
    const course = {
      id: "course-id",
      slug: "course",
      title: "Course",
      category: "Business",
      description: "Course description",
      level: "INTERMEDIATE",
      _count: { lessons: 1, enrollments: 1 },
      enrollments: [{ progressPercent: 0 }],
      lessons: [
        {
          id: "lesson-id",
          slug: "lesson",
          orderIndex: 0,
          title: "Lesson",
          estimatedDurationMinutes: 10,
          _count: { exercises: 2 },
          progress: [],
        },
      ],
    };
    const prisma = {
      course: { findUniqueOrThrow: vi.fn().mockResolvedValue(course) },
    };
    const service = new CoursesService(
      prisma as never,
      { assertStudentView: vi.fn() } as never,
    );
    const student = {
      id: "student-id",
      email: "student@test.local",
      role: UserRole.STUDENT,
      clientType: "USER_WEB" as const,
    };

    const result = await service.studentDetail(student, "course");
    expect(result.lessons[0].exerciseCount).toBe(2);
    expect(prisma.course.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          lessons: expect.objectContaining({
            include: expect.objectContaining({
              _count: {
                select: {
                  exercises: { where: { status: ContentStatus.PUBLISHED } },
                },
              },
            }),
          }),
        }),
      }),
    );
  });
});
