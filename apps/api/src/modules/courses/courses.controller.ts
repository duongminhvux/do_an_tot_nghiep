import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { UserRole } from "../../generated/prisma/client";
import { CoursesService } from "./courses.service";
import {
  CourseQueryDto,
  CreateCourseDto,
  UpdateCourseDto,
} from "./dto/courses.dto";

@ApiTags("courses")
@Controller()
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Public()
  @Get("public/courses")
  publicList(@Query() query: CourseQueryDto) {
    return this.courses.publicList(query);
  }

  @Roles(UserRole.STUDENT)
  @ApiBearerAuth()
  @Get("student/courses")
  studentList(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CourseQueryDto,
  ) {
    return this.courses.studentList(user, query);
  }

  @Roles(UserRole.STUDENT)
  @ApiBearerAuth()
  @Get("student/courses/:slug")
  studentDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("slug") slug: string,
  ) {
    return this.courses.studentDetail(user, slug);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiBearerAuth()
  @Get("admin/courses")
  adminList(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CourseQueryDto,
  ) {
    return this.courses.adminList(user, query);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiBearerAuth()
  @Get("admin/courses/:id")
  adminGet(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.courses.adminGet(user, id);
  }

  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Post("admin/courses")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCourseDto,
  ) {
    return this.courses.create(user, body);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiBearerAuth()
  @Patch("admin/courses/:id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: UpdateCourseDto,
  ) {
    return this.courses.update(user, id, body);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiBearerAuth()
  @Post("admin/courses/:id/publish")
  publish(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.courses.publish(user, id);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiBearerAuth()
  @Post("admin/courses/:id/unpublish")
  unpublish(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.courses.unpublish(user, id);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiBearerAuth()
  @Post("admin/courses/:id/archive")
  archive(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.courses.archive(user, id);
  }
}
