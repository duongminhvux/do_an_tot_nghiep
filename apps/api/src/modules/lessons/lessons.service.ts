import { ConflictException, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import {
  ContentStatus,
  ExerciseType,
  ProgressStatus,
  Prisma,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CourseAccessService } from "../access/course-access.service";
import type {
  CreateLessonDto,
  ExpressionDto,
  LessonResourceDto,
  SaveLessonDraftDto,
  UpdateLessonDto,
  VocabularyDto,
} from "./dto/lessons.dto";

@Injectable()
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
  ) {}

  async listAdmin(user: AuthenticatedUser, courseId: string) {
    await this.access.assertManage(user, courseId);
    return this.prisma.lesson.findMany({
      where: { courseId },
      orderBy: { orderIndex: "asc" },
      include: { _count: { select: { exercises: true } } },
    });
  }

  async getAdmin(user: AuthenticatedUser, courseId: string, lessonId: string) {
    await this.access.assertManage(user, courseId);
    return this.prisma.lesson.findFirstOrThrow({
      where: { id: lessonId, courseId },
      include: {
        vocabulary: { orderBy: { orderIndex: "asc" } },
        expressions: { orderBy: { orderIndex: "asc" } },
        resources: {
          orderBy: { orderIndex: "asc" },
          include: { media: true },
        },
        exercises: { orderBy: { orderIndex: "asc" } },
      },
    });
  }

  async create(
    user: AuthenticatedUser,
    courseId: string,
    input: CreateLessonDto,
  ) {
    await this.access.assertManage(user, courseId);
    const slug = await this.availableSlug(courseId, input.slug || input.title);
    return this.prisma.lesson.create({
      data: {
        courseId,
        slug,
        title: input.title.trim(),
        description: input.description.trim(),
        content: (input.content ?? { blocks: [] }) as Prisma.InputJsonValue,
        estimatedDurationMinutes: input.estimatedDurationMinutes ?? 0,
        orderIndex: input.orderIndex,
        createdById: user.id,
      },
    });
  }

  async update(
    user: AuthenticatedUser,
    courseId: string,
    lessonId: string,
    input: UpdateLessonDto,
  ) {
    await this.access.assertManage(user, courseId);
    return this.prisma.lesson.update({
      where: { id: lessonId, courseId },
      data: {
        title: input.title?.trim(),
        slug: input.slug?.trim(),
        description: input.description?.trim(),
        content: input.content as Prisma.InputJsonValue | undefined,
        estimatedDurationMinutes: input.estimatedDurationMinutes,
        orderIndex: input.orderIndex,
      },
    });
  }

  async saveDraft(
    user: AuthenticatedUser,
    courseId: string,
    lessonId: string,
    input: SaveLessonDraftDto,
  ) {
    await this.assertLesson(user, courseId, lessonId);
    await this.prisma.$transaction(async (tx) => {
      await tx.lesson.update({
        where: { id: lessonId, courseId },
        data: {
          title: input.title.trim(),
          slug: input.slug?.trim(),
          description: input.description.trim(),
          content: input.content as Prisma.InputJsonValue,
          estimatedDurationMinutes: input.estimatedDurationMinutes ?? 0,
          orderIndex: input.orderIndex,
        },
      });
      await tx.vocabularyItem.deleteMany({ where: { lessonId } });
      if (input.vocabulary.length) {
        await tx.vocabularyItem.createMany({
          data: input.vocabulary.map((item, orderIndex) => ({
            lessonId,
            ...item,
            orderIndex,
          })),
        });
      }
      await tx.expressionItem.deleteMany({ where: { lessonId } });
      if (input.expressions.length) {
        await tx.expressionItem.createMany({
          data: input.expressions.map((item, orderIndex) => ({
            lessonId,
            ...item,
            orderIndex,
          })),
        });
      }
      await tx.lessonResource.deleteMany({ where: { lessonId } });
      if (input.resources.length) {
        await tx.lessonResource.createMany({
          data: input.resources.map((item, orderIndex) => ({
            lessonId,
            ...item,
            orderIndex,
          })),
        });
      }
    });
    return this.getAdmin(user, courseId, lessonId);
  }

  async publish(user: AuthenticatedUser, courseId: string, lessonId: string) {
    await this.access.assertManage(user, courseId);
    const lesson = await this.prisma.lesson.findFirstOrThrow({
      where: { id: lessonId, courseId },
    });
    if (!lesson.title.trim() || !lesson.description.trim()) {
      throw new ConflictException("Lesson title and description are required.");
    }
    return this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(),
        archivedAt: null,
      },
    });
  }

  async unpublish(user: AuthenticatedUser, courseId: string, lessonId: string) {
    await this.access.assertManage(user, courseId);
    return this.prisma.lesson.update({
      where: { id: lessonId, courseId },
      data: { status: ContentStatus.DRAFT, publishedAt: null },
    });
  }

  async archive(user: AuthenticatedUser, courseId: string, lessonId: string) {
    await this.access.assertManage(user, courseId);
    return this.prisma.lesson.update({
      where: { id: lessonId, courseId },
      data: { status: ContentStatus.ARCHIVED, archivedAt: new Date() },
    });
  }

  async addVocabulary(
    user: AuthenticatedUser,
    courseId: string,
    lessonId: string,
    input: VocabularyDto,
  ) {
    await this.assertLesson(user, courseId, lessonId);
    return this.prisma.vocabularyItem.create({ data: { lessonId, ...input } });
  }

  async updateVocabulary(
    user: AuthenticatedUser,
    courseId: string,
    lessonId: string,
    id: string,
    input: VocabularyDto,
  ) {
    await this.assertLesson(user, courseId, lessonId);
    return this.prisma.vocabularyItem.update({
      where: { id, lessonId },
      data: input,
    });
  }

  async deleteVocabulary(
    user: AuthenticatedUser,
    courseId: string,
    lessonId: string,
    id: string,
  ) {
    await this.assertLesson(user, courseId, lessonId);
    await this.prisma.vocabularyItem.delete({ where: { id, lessonId } });
  }

  async addExpression(
    user: AuthenticatedUser,
    courseId: string,
    lessonId: string,
    input: ExpressionDto,
  ) {
    await this.assertLesson(user, courseId, lessonId);
    return this.prisma.expressionItem.create({ data: { lessonId, ...input } });
  }

  async updateExpression(
    user: AuthenticatedUser,
    courseId: string,
    lessonId: string,
    id: string,
    input: ExpressionDto,
  ) {
    await this.assertLesson(user, courseId, lessonId);
    return this.prisma.expressionItem.update({
      where: { id, lessonId },
      data: input,
    });
  }

  async deleteExpression(
    user: AuthenticatedUser,
    courseId: string,
    lessonId: string,
    id: string,
  ) {
    await this.assertLesson(user, courseId, lessonId);
    await this.prisma.expressionItem.delete({ where: { id, lessonId } });
  }

  async addResource(
    user: AuthenticatedUser,
    courseId: string,
    lessonId: string,
    input: LessonResourceDto,
  ) {
    await this.assertLesson(user, courseId, lessonId);
    return this.prisma.lessonResource.create({ data: { lessonId, ...input } });
  }

  async studentDetail(
    user: AuthenticatedUser,
    courseSlug: string,
    lessonSlug: string,
  ) {
    const course = await this.prisma.course.findUniqueOrThrow({
      where: { slug: courseSlug },
    });
    await this.access.assertStudentView(user, course.id);
    const lesson = await this.prisma.lesson.findFirstOrThrow({
      where: {
        courseId: course.id,
        slug: lessonSlug,
        status: ContentStatus.PUBLISHED,
      },
      include: {
        vocabulary: { orderBy: { orderIndex: "asc" } },
        expressions: { orderBy: { orderIndex: "asc" } },
        resources: {
          orderBy: { orderIndex: "asc" },
          include: { media: true },
        },
      },
    });
    const siblings = await this.prisma.lesson.findMany({
      where: { courseId: course.id, status: ContentStatus.PUBLISHED },
      orderBy: { orderIndex: "asc" },
      include: {
        _count: {
          select: {
            exercises: { where: { status: ContentStatus.PUBLISHED } },
          },
        },
        progress: { where: { studentId: user.id }, take: 1 },
      },
    });
    const exercises = await this.prisma.listeningExercise.findMany({
      where: { lessonId: lesson.id, status: ContentStatus.PUBLISHED },
      orderBy: { orderIndex: "asc" },
      select: { id: true, title: true, type: true },
    });
    return {
      id: lesson.id,
      slug: lesson.slug,
      courseSlug: course.slug,
      courseTitle: course.title,
      title: lesson.title,
      description: lesson.description,
      duration: lesson.estimatedDurationMinutes,
      vocabulary: lesson.vocabulary.map((item) => ({
        term: item.word,
        pronunciation: item.ipa ?? "",
        definition: item.meaning,
      })),
      expressions: lesson.expressions.map((item) => ({
        phrase: item.expression,
        meaning: item.meaning,
      })),
      resources: lesson.resources.map((resource) => ({
        id: resource.id,
        type: resource.type,
        title: resource.title,
        url: resource.media
          ? `/api/v1/media/files/${resource.media.id}`
          : (resource.externalUrl ?? undefined),
        duration: resource.media?.durationMs
          ? Math.ceil(resource.media.durationMs / 1000)
          : undefined,
        mimeType: resource.media?.mimeType,
      })),
      lessons: siblings.map((item, index) => ({
        id: item.id,
        slug: item.slug,
        order: item.orderIndex + 1,
        title: item.title,
        duration: item.estimatedDurationMinutes,
        state: this.lessonState(siblings, index),
        exerciseCount: item._count.exercises,
      })),
      exercises: exercises.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type as ExerciseType,
        available: true,
      })),
    };
  }

  private async assertLesson(
    user: AuthenticatedUser,
    courseId: string,
    lessonId: string,
  ): Promise<void> {
    await this.access.assertManage(user, courseId);
    await this.prisma.lesson.findFirstOrThrow({
      where: { id: lessonId, courseId },
    });
  }

  private lessonState(
    lessons: { progress: { status: ProgressStatus }[] }[],
    index: number,
  ): "COMPLETED" | "CURRENT" | "NOT_STARTED" | "LOCKED" {
    const status = lessons[index]?.progress[0]?.status;
    if (status === ProgressStatus.COMPLETED) return "COMPLETED";
    if (status === ProgressStatus.IN_PROGRESS) return "CURRENT";
    return lessons
      .slice(0, index)
      .some((item) => item.progress[0]?.status !== ProgressStatus.COMPLETED)
      ? "LOCKED"
      : "NOT_STARTED";
  }

  private async availableSlug(
    courseId: string,
    value: string,
  ): Promise<string> {
    const base =
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "lesson";
    let slug = base;
    let suffix = 2;
    while (
      await this.prisma.lesson.findUnique({
        where: { courseId_slug: { courseId, slug } },
        select: { id: true },
      })
    ) {
      slug = `${base}-${suffix++}`;
    }
    return slug;
  }
}
