import { Injectable } from "@nestjs/common";
import { AppException } from "../../common/errors/app.exception";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import {
  AssignmentStatus,
  ContentStatus,
  CourseVisibility,
  EnrollmentStatus,
  UserRole,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CourseAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertManage(user: AuthenticatedUser, courseId: string): Promise<void> {
    if (user.role === UserRole.ADMIN) return;
    if (user.role !== UserRole.TEACHER) {
      throw new AppException("COURSE_ACCESS_DENIED", "You cannot manage this course.", 403);
    }
    const assignment = await this.prisma.courseTeacherAssignment.findUnique({
      where: { courseId_teacherId: { courseId, teacherId: user.id } },
      select: { status: true },
    });
    if (assignment?.status !== AssignmentStatus.ACTIVE) {
      throw new AppException(
        "COURSE_ACCESS_DENIED",
        "The course is outside your assigned scope.",
        403,
      );
    }
  }

  async assertStudentView(user: AuthenticatedUser, courseId: string): Promise<void> {
    if (user.role !== UserRole.STUDENT) {
      throw new AppException("STUDENT_API_REQUIRED", "A Student session is required.", 403);
    }
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { status: true, visibility: true },
    });
    if (!course || course.status !== ContentStatus.PUBLISHED) {
      throw new AppException("COURSE_NOT_FOUND", "Published course not found.", 404);
    }
    if (course.visibility === CourseVisibility.PUBLIC) return;
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId, studentId: user.id } },
      select: { status: true },
    });
    if (!enrollment || enrollment.status === EnrollmentStatus.DROPPED) {
      throw new AppException("COURSE_ACCESS_DENIED", "Enrollment is required.", 403);
    }
  }

  async assignedCourseIds(teacherId: string): Promise<string[]> {
    const assignments = await this.prisma.courseTeacherAssignment.findMany({
      where: { teacherId, status: AssignmentStatus.ACTIVE },
      select: { courseId: true },
    });
    return assignments.map((assignment) => assignment.courseId);
  }
}
