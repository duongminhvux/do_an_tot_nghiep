import { Body, Controller, Get, Param, Post, Put } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { UserRole } from "../../generated/prisma/client";
import { GenerateAudioDto, UpdateTtsSettingsDto } from "./dto/tts.dto";
import { TtsService } from "./tts.service";

@Controller("admin/tts")
@Roles(UserRole.ADMIN, UserRole.TEACHER)
export class TtsController {
  constructor(private readonly tts: TtsService) {}

  @Get("settings")
  settings() {
    return this.tts.settings();
  }

  @Put("settings")
  @Roles(UserRole.ADMIN)
  update(@Body() input: UpdateTtsSettingsDto) {
    return this.tts.updateSettings(input);
  }

  @Get("voices")
  voices() {
    return this.tts.voices();
  }

  @Get("provider-status")
  status() {
    return this.tts.status();
  }

  @Get("jobs")
  jobs(@CurrentUser() user: AuthenticatedUser) {
    return this.tts.list(user);
  }

  @Get("jobs/:id")
  detail(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.tts.detail(user, id);
  }

  @Post("jobs/:id/retry")
  retry(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.tts.retry(user, id);
  }

  @Post("exercises/:exerciseId/generate-audio")
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("exerciseId") exerciseId: string,
    @Body() input: GenerateAudioDto,
  ) {
    return this.tts.generate(user, exerciseId, input);
  }
}
