import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { UserRole } from "../../generated/prisma/client";
import { EnrollStudentDto, UpdateEnrollmentDto } from "./dto/enrollments.dto";
import { EnrollmentsService } from "./enrollments.service";

@ApiTags("enrollments")
@ApiBearerAuth()
@Controller()
export class EnrollmentsController {
  constructor(private readonly enrollments: EnrollmentsService) {}

  @Roles(UserRole.STUDENT)
  @Get("student/enrollments")
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.enrollments.mine(user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get("admin/courses/:courseId/enrollments")
  courseStudents(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courseId") courseId: string,
  ) {
    return this.enrollments.courseStudents(user, courseId);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Post("admin/courses/:courseId/enrollments")
  enroll(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courseId") courseId: string,
    @Body() body: EnrollStudentDto,
  ) {
    return this.enrollments.enroll(user, courseId, body.studentId);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Patch("admin/courses/:courseId/enrollments/:studentId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courseId") courseId: string,
    @Param("studentId") studentId: string,
    @Body() body: UpdateEnrollmentDto,
  ) {
    return this.enrollments.update(user, courseId, studentId, body.status);
  }
}
