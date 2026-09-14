import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AccessModule } from "../access/access.module";
import { MediaModule } from "../media/media.module";
import { DisabledTtsProvider } from "./disabled-tts.provider";
import { KokoroTtsProvider } from "./kokoro-tts.provider";
import { TtsController } from "./tts.controller";
import { TTS_PROVIDER } from "./tts-provider";
import { TtsService } from "./tts.service";

@Module({
  imports: [AccessModule, MediaModule],
  controllers: [TtsController],
  providers: [
    DisabledTtsProvider,
    KokoroTtsProvider,
    {
      provide: TTS_PROVIDER,
      inject: [ConfigService, DisabledTtsProvider, KokoroTtsProvider],
      useFactory: (
        config: ConfigService,
        disabled: DisabledTtsProvider,
        kokoro: KokoroTtsProvider,
      ) => {
        const enabled = config.get<boolean>("TTS_ENABLED", false);
        const provider = config.get<string>("TTS_PROVIDER", "none");
        return enabled && provider === "kokoro" ? kokoro : disabled;
      },
    },
    TtsService,
  ],
  exports: [TtsService, TTS_PROVIDER],
})
export class TtsModule {}
