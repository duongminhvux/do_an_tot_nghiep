import { Controller, Get } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { AttemptStatus, UserRole } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CourseAccessService } from "../access/course-access.service";

@Controller("admin/reports")
@Roles(UserRole.ADMIN, UserRole.TEACHER)
export class ReportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
  ) {}

  @Get()
  async overview(@CurrentUser() user: AuthenticatedUser) {
    const courseIds =
      user.role === UserRole.TEACHER ? await this.access.assignedCourseIds(user.id) : undefined;
    const exerciseWhere = courseIds ? { lesson: { courseId: { in: courseIds } } } : {};
    const attemptWhere = {
      status: AttemptStatus.GRADED,
      ...(courseIds ? { exercise: exerciseWhere } : {}),
    };
    const [students, courses, exercises, attempts, passed, tts] = await Promise.all([
      this.prisma.user.count({
        where: {
          role: UserRole.STUDENT,
          ...(courseIds
            ? {
                courseEnrollments: {
                  some: { courseId: { in: courseIds } },
                },
              }
            : {}),
        },
      }),
      this.prisma.course.count({ where: courseIds ? { id: { in: courseIds } } : {} }),
      this.prisma.listeningExercise.count({ where: exerciseWhere }),
      this.prisma.listeningAttempt.aggregate({ where: attemptWhere, _count: true, _avg: { score: true } }),
      this.prisma.listeningAttempt.count({ where: { ...attemptWhere, passed: true } }),
      this.prisma.ttsJob.groupBy({
        by: ["status"],
        where: courseIds
          ? { exercise: { lesson: { courseId: { in: courseIds } } } }
          : {},
        _count: true,
      }),
    ]);
    return {
      system: { students, courses, exercises, attempts: attempts._count },
      performance: {
        averageScore: Number(attempts._avg.score ?? 0),
        passRate: attempts._count ? Math.round((passed / attempts._count) * 10000) / 100 : 0,
      },
      tts: tts.map((item) => ({ status: item.status, count: item._count })),
    };
  }
}
