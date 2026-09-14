import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { createReadStream } from "node:fs";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { UserRole } from "../../generated/prisma/client";
import { MediaService } from "./media.service";

@Controller("media")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post("upload")
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 100 * 1024 * 1024 } }))
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.media.upload(user, file);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.media.list(user);
  }

  @Get("files/:id")
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  async stream(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const file = await this.media.protectedFile(user, id);
    this.pipe(file, response);
  }

  @Get("public/files/:id")
  @Public()
  async publicStream(@Param("id") id: string, @Res() response: Response) {
    const file = await this.media.publicFile(id);
    this.pipe(file, response);
  }

  private pipe(
    { media, path }: Awaited<ReturnType<MediaService["publicFile"]>>,
    response: Response,
  ): void {
    response.setHeader("Content-Type", media.mimeType);
    response.setHeader("Content-Length", media.sizeBytes.toString());
    response.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(media.originalName)}`);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    createReadStream(path).pipe(response);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  archive(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.media.archive(user, id);
  }
}
