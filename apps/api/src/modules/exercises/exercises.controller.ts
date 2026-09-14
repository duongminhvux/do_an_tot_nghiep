import { Body, Controller, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { UserRole } from "../../generated/prisma/client";
import {
  AttachAudioDto,
  CreateAudioSegmentDto,
  CreateExerciseDto,
  CreateGroupDto,
  CreateOptionDto,
  CreateQuestionDto,
  SaveExerciseDraftDto,
  UpdateExerciseDto,
} from "./dto/exercises.dto";
import { ExercisesService } from "./exercises.service";

@ApiTags("exercises")
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.TEACHER)
@Controller("admin/exercises")
export class ExercisesController {
  constructor(private readonly exercises: ExercisesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.exercises.adminList(user);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.exercises.adminGet(user, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateExerciseDto,
  ) {
    return this.exercises.create(user, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: UpdateExerciseDto,
  ) {
    return this.exercises.update(user, id, body);
  }

  @Put(":id/draft")
  saveDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: SaveExerciseDraftDto,
  ) {
    return this.exercises.saveDraft(user, id, body);
  }

  @Post(":id/groups")
  addGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: CreateGroupDto,
  ) {
    return this.exercises.addGroup(user, id, body);
  }

  @Post(":id/questions")
  addQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: CreateQuestionDto,
  ) {
    return this.exercises.addQuestion(user, id, body);
  }

  @Post(":id/questions/:questionId/options")
  addOption(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("questionId") questionId: string,
    @Body() body: CreateOptionDto,
  ) {
    return this.exercises.addOption(user, id, questionId, body);
  }

  @Post(":id/audio-segments")
  addAudioSegment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: CreateAudioSegmentDto,
  ) {
    return this.exercises.addAudioSegment(user, id, body);
  }

  @Patch(":id/audio")
  attachAudio(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: AttachAudioDto,
  ) {
    return this.exercises.attachAudio(user, id, body);
  }

  @Post(":id/publish")
  publish(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.exercises.publish(user, id);
  }

  @Post(":id/archive")
  archive(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.exercises.archive(user, id);
  }

  @Get(":id/preview")
  preview(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.exercises.preview(user, id);
  }
}
