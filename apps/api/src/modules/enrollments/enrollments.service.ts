import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { EnrollmentStatus, UserRole } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CourseAccessService } from "../access/course-access.service";

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
  ) {}

  async courseStudents(user: AuthenticatedUser, courseId: string) {
    await this.access.assertManage(user, courseId);
    return this.prisma.courseEnrollment.findMany({
      where: { courseId },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            email: true,
            status: true,
            studentProfile: true,
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    });
  }

  async enroll(
    actor: AuthenticatedUser,
    courseId: string,
    studentId: string,
  ) {
    await this.access.assertManage(actor, courseId);
    await this.prisma.user.findFirstOrThrow({ where: { id: studentId, role: UserRole.STUDENT } });
    return this.prisma.courseEnrollment.upsert({
      where: { courseId_studentId: { courseId, studentId } },
      update: {
        status: EnrollmentStatus.ACTIVE,
        enrolledById: actor.id,
        completedAt: null,
      },
      create: { courseId, studentId, enrolledById: actor.id },
    });
  }

  async update(
    actor: AuthenticatedUser,
    courseId: string,
    studentId: string,
    status: EnrollmentStatus,
  ) {
    await this.access.assertManage(actor, courseId);
    return this.prisma.courseEnrollment.update({
      where: { courseId_studentId: { courseId, studentId } },
      data: {
        status,
        completedAt: status === EnrollmentStatus.COMPLETED ? new Date() : null,
      },
    });
  }

  async mine(studentId: string) {
    return this.prisma.courseEnrollment.findMany({
      where: { studentId },
      include: { course: true },
      orderBy: { lastAccessedAt: "desc" },
    });
  }
}
