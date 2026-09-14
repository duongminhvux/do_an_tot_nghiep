import { Injectable } from "@nestjs/common";
import { AppException } from "../../common/errors/app.exception";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { UserRole } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CourseAccessService } from "./course-access.service";

@Injectable()
export class ExerciseAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courses: CourseAccessService,
  ) {}

  async courseIdForExercise(exerciseId: string): Promise<string> {
    const exercise = await this.prisma.listeningExercise.findUnique({
      where: { id: exerciseId },
      select: { lesson: { select: { courseId: true } } },
    });
    if (!exercise) throw new AppException("EXERCISE_NOT_FOUND", "Exercise not found.", 404);
    return exercise.lesson.courseId;
  }

  async assertManage(user: AuthenticatedUser, exerciseId: string): Promise<void> {
    await this.courses.assertManage(user, await this.courseIdForExercise(exerciseId));
  }

  async assertStudentView(user: AuthenticatedUser, exerciseId: string): Promise<void> {
    if (user.role !== UserRole.STUDENT) {
      throw new AppException("STUDENT_API_REQUIRED", "A Student session is required.", 403);
    }
    await this.courses.assertStudentView(user, await this.courseIdForExercise(exerciseId));
  }
}
