import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { UserRole } from "../../generated/prisma/client";
import { AssignTeacherDto } from "./dto/assignments.dto";
import { TeacherAssignmentsService } from "./teacher-assignments.service";

@ApiTags("teacher-assignments")
@ApiBearerAuth()
@Controller("admin/courses/:courseId/assignments")
export class TeacherAssignmentsController {
  constructor(private readonly assignments: TeacherAssignmentsService) {}

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Param("courseId") courseId: string) {
    return this.assignments.list(user, courseId);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courseId") courseId: string,
    @Body() body: AssignTeacherDto,
  ) {
    return this.assignments.assign(user, courseId, body.teacherId);
  }

  @Roles(UserRole.ADMIN)
  @Delete(":teacherId")
  remove(@Param("courseId") courseId: string, @Param("teacherId") teacherId: string) {
    return this.assignments.remove(courseId, teacherId);
  }
}
