import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { UserRole } from "../../generated/prisma/client";
import {
  CreateLessonDto,
  ExpressionDto,
  LessonResourceDto,
  SaveLessonDraftDto,
  UpdateLessonDto,
  VocabularyDto,
} from "./dto/lessons.dto";
import { LessonsService } from "./lessons.service";

@ApiTags("lessons")
@ApiBearerAuth()
@Controller()
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}

  @Roles(UserRole.STUDENT)
  @Get("student/courses/:courseSlug/lessons/:lessonSlug")
  studentDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courseSlug") courseSlug: string,
    @Param("lessonSlug") lessonSlug: string,
  ) {
    return this.lessons.studentDetail(user, courseSlug, lessonSlug);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get("admin/courses/:courseId/lessons")
  list(@CurrentUser() user: AuthenticatedUser, @Param("courseId") courseId: string) {
    return this.lessons.listAdmin(user, courseId);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get("admin/courses/:courseId/lessons/:lessonId")
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courseId") courseId: string,
    @Param("lessonId") lessonId: string,
  ) {
    return this.lessons.getAdmin(user, courseId, lessonId);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Post("admin/courses/:courseId/lessons")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courseId") courseId: string,
    @Body() body: CreateLessonDto,
  ) {
    return this.lessons.create(user, courseId, body);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Patch("admin/courses/:courseId/lessons/:lessonId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courseId") courseId: string,
    @Param("lessonId") lessonId: string,
    @Body() body: UpdateLessonDto,
  ) {
    return this.lessons.update(user, courseId, lessonId, body);
  }

  @Put("admin/courses/:courseId/lessons/:lessonId/draft")
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  saveDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courseId") courseId: string,
    @Param("lessonId") lessonId: string,
    @Body() body: SaveLessonDraftDto,
  ) {
    return this.lessons.saveDraft(user, courseId, lessonId, body);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Post("admin/courses/:courseId/lessons/:lessonId/publish")
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courseId") courseId: string,
    @Param("lessonId") lessonId: string,
  ) {
    return this.lessons.publish(user, courseId, lessonId);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Post("admin/courses/:courseId/lessons/:lessonId/unpublish")
  unpublish(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courseId") courseId: string,
    @Param("lessonId") lessonId: string,
  ) {
    return this.lessons.unpublish(user, courseId, lessonId);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Post("admin/courses/:courseId/lessons/:lessonId/archive")
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courseId") courseId: string,
    @Param("lessonId") lessonId: string,
  ) {
    return this.lessons.archive(user, courseId, lessonId);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Post("admin/courses/:courseId/lessons/:lessonId/vocabulary")
  addVocabulary(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courseId") courseId: string,
    @Param("lessonId") lessonId: string,
    @Body() body: VocabularyDto,
  ) {
    return this.lessons.addVocabulary(user, courseId, lessonId, body);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Put("admin/courses/:courseId/lessons/:lessonId/vocabulary/:id")
  updateVocabulary(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courseId") courseId: string,
    @Param("lessonId") lessonId: string,
    @Param("id") id: string,
    @Body() body: VocabularyDto,
  ) {
    return this.lessons.updateVocabulary(user, courseId, lessonId, id, body);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Delete("admin/courses/:courseId/lessons/:lessonId/vocabulary/:id")
  @HttpCode(204)
  deleteVocabulary(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courseId") courseId: string,
    @Param("lessonId") lessonId: string,
    @Param("id") id: string,
  ) {
    return this.lessons.deleteVocabulary(user, courseId, lessonId, id);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Post("admin/courses/:courseId/lessons/:lessonId/expressions")
  addExpression(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courseId") courseId: string,
    @Param("lessonId") lessonId: string,
    @Body() body: ExpressionDto,
  ) {
    return this.lessons.addExpression(user, courseId, lessonId, body);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Put("admin/courses/:courseId/lessons/:lessonId/expressions/:id")
  updateExpression(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courseId") courseId: string,
    @Param("lessonId") lessonId: string,
    @Param("id") id: string,
    @Body() body: ExpressionDto,
  ) {
    return this.lessons.updateExpression(user, courseId, lessonId, id, body);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Delete("admin/courses/:courseId/lessons/:lessonId/expressions/:id")
  @HttpCode(204)
  deleteExpression(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courseId") courseId: string,
    @Param("lessonId") lessonId: string,
    @Param("id") id: string,
  ) {
    return this.lessons.deleteExpression(user, courseId, lessonId, id);
  }

  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Post("admin/courses/:courseId/lessons/:lessonId/resources")
  addResource(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courseId") courseId: string,
    @Param("lessonId") lessonId: string,
    @Body() body: LessonResourceDto,
  ) {
    return this.lessons.addResource(user, courseId, lessonId, body);
  }
}
