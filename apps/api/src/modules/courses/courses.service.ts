import { ConflictException, Injectable } from "@nestjs/common";
import { AppException } from "../../common/errors/app.exception";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { pageMeta } from "../../common/pagination/pagination.dto";
import {
  AssignmentStatus,
  ContentStatus,
  CourseVisibility,
  EnrollmentStatus,
  ProgressStatus,
  UserRole,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CourseAccessService } from "../access/course-access.service";
import type {
  CourseQueryDto,
  CreateCourseDto,
  UpdateCourseDto,
} from "./dto/courses.dto";

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
  ) {}

  async adminList(user: AuthenticatedUser, query: CourseQueryDto) {
    const where = {
      ...(query.search
        ? { title: { contains: query.search, mode: "insensitive" as const } }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.level ? { level: query.level } : {}),
      ...(user.role === UserRole.TEACHER
        ? {
            teacherAssignments: {
              some: { teacherId: user.id, status: AssignmentStatus.ACTIVE },
            },
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        include: {
          _count: { select: { lessons: true, enrollments: true } },
          teacherAssignments: {
            where: { status: AssignmentStatus.ACTIVE },
            include: {
              teacher: { select: { id: true, fullName: true, email: true } },
            },
          },
        },
        orderBy: [{ orderIndex: "asc" }, { title: query.direction }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.course.count({ where }),
    ]);
    return {
      data: items.map((course) => this.adminCard(course)),
      meta: pageMeta(query.page, query.limit, total),
    };
  }

  async adminGet(user: AuthenticatedUser, id: string) {
    await this.access.assertManage(user, id);
    const course = await this.prisma.course.findUniqueOrThrow({
      where: { id },
      include: {
        _count: { select: { lessons: true, enrollments: true } },
        teacherAssignments: {
          where: { status: AssignmentStatus.ACTIVE },
          include: {
            teacher: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });
    return this.adminCard(course);
  }

  async create(user: AuthenticatedUser, input: CreateCourseDto) {
    if (user.role !== UserRole.ADMIN) {
      throw new AppException(
        "COURSE_CREATE_FORBIDDEN",
        "Only administrators may create courses.",
        403,
      );
    }
    const slug = await this.availableSlug(input.slug || input.title);
    const course = await this.prisma.$transaction(async (tx) => {
      const created = await tx.course.create({
        data: {
          slug,
          title: input.title.trim(),
          description: input.description.trim(),
          level: input.level,
          category: input.category.trim(),
          visibility: input.visibility ?? CourseVisibility.PUBLIC,
          orderIndex: input.orderIndex ?? 0,
          thumbnailMediaId: input.thumbnailMediaId,
          createdById: user.id,
        },
      });
      await this.syncTeachers(
        tx,
        created.id,
        input.assignedTeacherIds ?? [],
        user.id,
      );
      return created;
    });
    return this.adminGet(user, course.id);
  }

  async update(user: AuthenticatedUser, id: string, input: UpdateCourseDto) {
    await this.access.assertManage(user, id);
    if (
      user.role !== UserRole.ADMIN &&
      input.assignedTeacherIds !== undefined
    ) {
      throw new AppException(
        "TEACHER_ASSIGNMENT_FORBIDDEN",
        "Only administrators may change course teacher assignments.",
        403,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.course.update({
        where: { id },
        data: {
          title: input.title?.trim(),
          slug: input.slug?.trim(),
          description: input.description?.trim(),
          level: input.level,
          category: input.category?.trim(),
          visibility: input.visibility,
          orderIndex: input.orderIndex,
          thumbnailMediaId: input.thumbnailMediaId,
        },
      });
      if (input.assignedTeacherIds) {
        await this.syncTeachers(tx, id, input.assignedTeacherIds, user.id);
      }
    });
    return this.adminGet(user, id);
  }

  async publish(user: AuthenticatedUser, id: string) {
    await this.access.assertManage(user, id);
    const course = await this.prisma.course.findUniqueOrThrow({
      where: { id },
      include: { lessons: { where: { status: ContentStatus.PUBLISHED } } },
    });
    if (
      !course.title.trim() ||
      !course.description.trim() ||
      !course.lessons.length
    ) {
      throw new ConflictException(
        "A course needs title, description, and at least one published lesson.",
      );
    }
    await this.prisma.course.update({
      where: { id },
      data: {
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(),
        archivedAt: null,
      },
    });
    return this.adminGet(user, id);
  }

  async unpublish(user: AuthenticatedUser, id: string) {
    await this.access.assertManage(user, id);
    await this.prisma.course.update({
      where: { id },
      data: { status: ContentStatus.DRAFT, publishedAt: null },
    });
    return this.adminGet(user, id);
  }

  async archive(user: AuthenticatedUser, id: string) {
    await this.access.assertManage(user, id);
    await this.prisma.course.update({
      where: { id },
      data: { status: ContentStatus.ARCHIVED, archivedAt: new Date() },
    });
    return this.adminGet(user, id);
  }

  async studentList(user: AuthenticatedUser, query: CourseQueryDto) {
    const where = {
      status: ContentStatus.PUBLISHED,
      OR: [
        { visibility: CourseVisibility.PUBLIC },
        {
          enrollments: {
            some: {
              studentId: user.id,
              status: { not: EnrollmentStatus.DROPPED },
            },
          },
        },
      ],
      ...(query.search
        ? { title: { contains: query.search, mode: "insensitive" as const } }
        : {}),
    };
    const [courses, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        include: {
          _count: {
            select: {
              lessons: { where: { status: ContentStatus.PUBLISHED } },
              enrollments: true,
            },
          },
          enrollments: { where: { studentId: user.id }, take: 1 },
        },
        orderBy: [{ orderIndex: "asc" }, { title: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.course.count({ where }),
    ]);
    return {
      data: courses.map((course) => ({
        id: course.id,
        slug: course.slug,
        title: course.title,
        category: course.category,
        description: course.description,
        level: this.levelLabel(course.level),
        thumbnailUrl: course.thumbnailMediaId
          ? `/api/v1/media/${
              course.visibility === CourseVisibility.PUBLIC ? "public/" : ""
            }files/${course.thumbnailMediaId}`
          : undefined,
        theme: this.theme(course.category),
        lessonCount: course._count.lessons,
        learnerCount: course._count.enrollments,
        progress: Number(course.enrollments[0]?.progressPercent ?? 0),
        status: this.progressState(
          Number(course.enrollments[0]?.progressPercent ?? 0),
        ),
      })),
      meta: pageMeta(query.page, query.limit, total),
    };
  }

  async studentDetail(user: AuthenticatedUser, slug: string) {
    const course = await this.prisma.course.findUniqueOrThrow({
      where: { slug },
      include: {
        _count: {
            select: {
              lessons: { where: { status: ContentStatus.PUBLISHED } },
              enrollments: true,
            },
          },
        enrollments: { where: { studentId: user.id }, take: 1 },
        lessons: {
          where: { status: ContentStatus.PUBLISHED },
          orderBy: { orderIndex: "asc" },
          include: {
            _count: {
              select: {
                exercises: { where: { status: ContentStatus.PUBLISHED } },
              },
            },
            progress: { where: { studentId: user.id }, take: 1 },
          },
        },
      },
    });
    await this.access.assertStudentView(user, course.id);
    const progress = Number(course.enrollments[0]?.progressPercent ?? 0);
    const lessons = course.lessons.map((lesson, index) => {
      const state = lesson.progress[0]?.status;
      const precedingIncomplete = course.lessons
        .slice(0, index)
        .some((item) => item.progress[0]?.status !== ProgressStatus.COMPLETED);
      return {
        id: lesson.id,
        slug: lesson.slug,
        order: lesson.orderIndex + 1,
        title: lesson.title,
        duration: lesson.estimatedDurationMinutes,
        state:
          state === ProgressStatus.COMPLETED
            ? ("COMPLETED" as const)
            : state === ProgressStatus.IN_PROGRESS
              ? ("CURRENT" as const)
              : precedingIncomplete
                ? ("LOCKED" as const)
                : ("NOT_STARTED" as const),
        exerciseCount: lesson._count.exercises,
      };
    });
    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      category: course.category,
      description: course.description,
      level: this.levelLabel(course.level),
      theme: this.theme(course.category),
      lessonCount: course._count.lessons,
      learnerCount: course._count.enrollments,
      progress,
      status: this.progressState(progress),
      lessons,
      completedLessons: lessons.filter((lesson) => lesson.state === "COMPLETED")
        .length,
    };
  }

  async publicList(query: CourseQueryDto) {
    const guest: AuthenticatedUser = {
      id: "00000000-0000-0000-0000-000000000000",
      email: "",
      role: UserRole.STUDENT,
      clientType: "USER_WEB",
    };
    return this.studentList(guest, query);
  }

  private async availableSlug(value: string): Promise<string> {
    const base =
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "course";
    let slug = base;
    let suffix = 2;
    while (
      await this.prisma.course.findUnique({
        where: { slug },
        select: { id: true },
      })
    ) {
      slug = `${base}-${suffix++}`;
    }
    return slug;
  }

  private async syncTeachers(
    tx: Parameters<Parameters<PrismaService["$transaction"]>[0]>[0],
    courseId: string,
    teacherIds: string[],
    assignedById: string,
  ): Promise<void> {
    const teachers = await tx.user.findMany({
      where: {
        role: UserRole.TEACHER,
        id: { in: teacherIds },
      },
      select: { id: true },
    });
    const foundIds = new Set(teachers.map((teacher) => teacher.id));
    if (foundIds.size !== new Set(teacherIds).size) {
      throw new AppException(
        "INVALID_ASSIGNED_TEACHER_IDS",
        "Every assignedTeacherId must identify an existing teacher.",
        422,
      );
    }
    const activeIds = foundIds;
    await tx.courseTeacherAssignment.updateMany({
      where: {
        courseId,
        teacherId: { notIn: [...activeIds] },
        status: AssignmentStatus.ACTIVE,
      },
      data: { status: AssignmentStatus.ENDED, endedAt: new Date() },
    });
    for (const teacherId of activeIds) {
      await tx.courseTeacherAssignment.upsert({
        where: { courseId_teacherId: { courseId, teacherId } },
        update: {
          status: AssignmentStatus.ACTIVE,
          endedAt: null,
          assignedById,
          assignedAt: new Date(),
        },
        create: { courseId, teacherId, assignedById },
      });
    }
  }

  private adminCard(course: {
    id: string;
    slug: string;
    title: string;
    description: string;
    level: string;
    status: ContentStatus;
    category: string;
    visibility: CourseVisibility;
    orderIndex: number;
    thumbnailMediaId: string | null;
    updatedAt: Date;
    _count: { lessons: number; enrollments: number };
    teacherAssignments: {
      teacher: { id: string; fullName: string; email: string };
    }[];
  }) {
    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description,
      level: this.levelLabel(course.level),
      category: course.category,
      visibility: course.visibility,
      orderIndex: course.orderIndex,
      thumbnailMediaId: course.thumbnailMediaId ?? undefined,
      lessons: course._count.lessons,
      students: course._count.enrollments,
      status: course.status,
      assignedTeacherIds: course.teacherAssignments.map(
        (item) => item.teacher.id,
      ),
      assignedTeachers: course.teacherAssignments.map((item) => item.teacher),
      updatedAt: course.updatedAt.toISOString(),
      theme: this.theme(course.category),
    };
  }

  private levelLabel(level: string): string {
    return level
      .toLowerCase()
      .split("_")
      .map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`)
      .join(" ");
  }

  private theme(category: string): "person" | "meeting" | "headphones" {
    const value = category.toLowerCase();
    return value.includes("business")
      ? "meeting"
      : value.includes("toeic")
        ? "headphones"
        : "person";
  }

  private progressState(
    progress: number,
  ): "IN_PROGRESS" | "NOT_STARTED" | "COMPLETED" {
    return progress >= 100
      ? "COMPLETED"
      : progress > 0
        ? "IN_PROGRESS"
        : "NOT_STARTED";
  }
}
