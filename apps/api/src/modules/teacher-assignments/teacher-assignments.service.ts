import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { AssignmentStatus, UserRole } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CourseAccessService } from "../access/course-access.service";

@Injectable()
export class TeacherAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
  ) {}

  async list(user: AuthenticatedUser, courseId: string) {
    await this.access.assertManage(user, courseId);
    return this.prisma.courseTeacherAssignment.findMany({
      where: { courseId },
      include: { teacher: { select: { id: true, fullName: true, email: true, status: true } } },
      orderBy: { assignedAt: "desc" },
    });
  }

  async assign(actor: AuthenticatedUser, courseId: string, teacherId: string) {
    await this.prisma.user.findFirstOrThrow({ where: { id: teacherId, role: UserRole.TEACHER } });
    return this.prisma.courseTeacherAssignment.upsert({
      where: { courseId_teacherId: { courseId, teacherId } },
      update: {
        status: AssignmentStatus.ACTIVE,
        assignedAt: new Date(),
        assignedById: actor.id,
        endedAt: null,
      },
      create: { courseId, teacherId, assignedById: actor.id },
    });
  }

  async remove(courseId: string, teacherId: string) {
    return this.prisma.courseTeacherAssignment.update({
      where: { courseId_teacherId: { courseId, teacherId } },
      data: { status: AssignmentStatus.ENDED, endedAt: new Date() },
    });
  }
}
