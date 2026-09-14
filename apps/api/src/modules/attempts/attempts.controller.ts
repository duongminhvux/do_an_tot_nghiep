import { Body, Controller, Get, Param, Post, Put } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { UserRole } from "../../generated/prisma/client";
import { AttemptsService } from "./attempts.service";
import {
  ConsumeListenDto,
  SaveDraftDto,
  SubmitDictationDto,
  SubmitToeicDto,
} from "./dto/attempts.dto";

@Controller()
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Get("student/exercises/:exerciseId")
  @Roles(UserRole.STUDENT)
  exercise(
    @CurrentUser() user: AuthenticatedUser,
    @Param("exerciseId") exerciseId: string,
  ) {
    return this.attempts.studentExercise(user, exerciseId);
  }

  @Post("student/exercises/:exerciseId/attempts/:attemptId/listens")
  @Roles(UserRole.STUDENT)
  listen(
    @CurrentUser() user: AuthenticatedUser,
    @Param("exerciseId") exerciseId: string,
    @Param("attemptId") attemptId: string,
    @Body() input: ConsumeListenDto,
  ) {
    return this.attempts.consumeListen(
      user,
      exerciseId,
      attemptId,
      input.playbackSpeed,
      input.groupId,
    );
  }

  @Put("student/exercises/:exerciseId/attempts/:attemptId/draft")
  @Roles(UserRole.STUDENT)
  saveDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param("exerciseId") exerciseId: string,
    @Param("attemptId") attemptId: string,
    @Body() input: SaveDraftDto,
  ) {
    return this.attempts.saveDraft(user, exerciseId, attemptId, input.answers);
  }

  @Post("student/exercises/:exerciseId/attempts/:attemptId/submit-dictation")
  @Roles(UserRole.STUDENT)
  dictation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("exerciseId") exerciseId: string,
    @Param("attemptId") attemptId: string,
    @Body() input: SubmitDictationDto,
  ) {
    return this.attempts.submitDictation(
      user,
      exerciseId,
      attemptId,
      input.answer,
    );
  }

  @Post("student/exercises/:exerciseId/attempts/:attemptId/submit-toeic")
  @Roles(UserRole.STUDENT)
  toeic(
    @CurrentUser() user: AuthenticatedUser,
    @Param("exerciseId") exerciseId: string,
    @Param("attemptId") attemptId: string,
    @Body() input: SubmitToeicDto,
  ) {
    return this.attempts.submitToeic(
      user,
      exerciseId,
      attemptId,
      input.answers,
    );
  }

  @Get("student/exercises/:exerciseId/attempts/:attemptId/result")
  @Roles(UserRole.STUDENT)
  result(
    @CurrentUser() user: AuthenticatedUser,
    @Param("exerciseId") exerciseId: string,
    @Param("attemptId") attemptId: string,
  ) {
    return this.attempts.result(user, exerciseId, attemptId);
  }

  @Get("student/history")
  @Roles(UserRole.STUDENT)
  history(@CurrentUser() user: AuthenticatedUser) {
    return this.attempts.history(user);
  }

  @Get("admin/attempts")
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  adminList(@CurrentUser() user: AuthenticatedUser) {
    return this.attempts.adminList(user);
  }

  @Get("admin/attempts/:attemptId")
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  adminDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("attemptId") attemptId: string,
  ) {
    return this.attempts.adminDetail(user, attemptId);
  }
}
