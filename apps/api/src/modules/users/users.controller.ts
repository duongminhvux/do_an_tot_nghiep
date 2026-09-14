import { Body, Controller, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { UserRole } from "../../generated/prisma/client";
import {
  CreateTeacherDto,
  UpdatePreferenceDto,
  UpdateProfileDto,
  UpdateStudentStatusDto,
  UpdateTeacherDto,
} from "./dto/users.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Roles(UserRole.STUDENT)
  @Get("student/profile")
  profile(@CurrentUser() user: AuthenticatedUser) {
    return this.users.profile(user.id);
  }

  @Roles(UserRole.STUDENT)
  @Patch("student/profile")
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateProfileDto) {
    return this.users.updateProfile(user.id, body);
  }

  @Roles(UserRole.STUDENT)
  @Get("student/preferences")
  preferences(@CurrentUser() user: AuthenticatedUser) {
    return this.users.preferences(user.id);
  }

  @Roles(UserRole.STUDENT)
  @Put("student/preferences")
  updatePreferences(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdatePreferenceDto) {
    return this.users.updatePreferences(user.id, body);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get("admin/students")
  students(@CurrentUser() user: AuthenticatedUser) {
    return this.users.students(user);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get("admin/students/:id")
  student(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.users.student(user, id);
  }

  @Roles(UserRole.ADMIN)
  @Patch("admin/students/:id/status")
  setStudentStatus(@Param("id") id: string, @Body() body: UpdateStudentStatusDto) {
    return this.users.setStudentStatus(id, body.status);
  }

  @Roles(UserRole.ADMIN)
  @Get("admin/teachers")
  teachers() {
    return this.users.teachers();
  }

  @Roles(UserRole.ADMIN)
  @Post("admin/teachers")
  createTeacher(@Body() body: CreateTeacherDto) {
    return this.users.createTeacher(body);
  }

  @Roles(UserRole.ADMIN)
  @Get("admin/teachers/:id")
  teacher(@Param("id") id: string) {
    return this.users.teacher(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch("admin/teachers/:id")
  updateTeacher(@Param("id") id: string, @Body() body: UpdateTeacherDto) {
    return this.users.updateTeacher(id, body);
  }
}
