import { Module } from "@nestjs/common";
import { LocalStorageService } from "./local-storage.service";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { STORAGE_SERVICE } from "./storage.service";

@Module({
  controllers: [MediaController],
  providers: [
    LocalStorageService,
    { provide: STORAGE_SERVICE, useExisting: LocalStorageService },
    MediaService,
  ],
  exports: [MediaService, STORAGE_SERVICE],
})
export class MediaModule {}
