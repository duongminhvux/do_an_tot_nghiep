import { Injectable } from "@nestjs/common";
import { AppException } from "../../common/errors/app.exception";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { UserRole } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CourseAccessService } from "./course-access.service";

@Injectable()
export class AttemptAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courses: CourseAccessService,
  ) {}

  async assertView(user: AuthenticatedUser, attemptId: string): Promise<void> {
    const attempt = await this.prisma.listeningAttempt.findUnique({
      where: { id: attemptId },
      select: {
        studentId: true,
        exercise: { select: { lesson: { select: { courseId: true } } } },
      },
    });
    if (!attempt) throw new AppException("ATTEMPT_NOT_FOUND", "Attempt not found.", 404);
    if (user.role === UserRole.STUDENT) {
      if (attempt.studentId !== user.id) {
        throw new AppException("ATTEMPT_ACCESS_DENIED", "This attempt belongs to another student.", 403);
      }
      return;
    }
    await this.courses.assertManage(user, attempt.exercise.lesson.courseId);
  }

  async assertOwner(user: AuthenticatedUser, attemptId: string): Promise<void> {
    const attempt = await this.prisma.listeningAttempt.findUnique({
      where: { id: attemptId },
      select: { studentId: true },
    });
    if (!attempt) throw new AppException("ATTEMPT_NOT_FOUND", "Attempt not found.", 404);
    if (user.role !== UserRole.STUDENT || attempt.studentId !== user.id) {
      throw new AppException("ATTEMPT_ACCESS_DENIED", "This attempt is not yours.", 403);
    }
  }
}
