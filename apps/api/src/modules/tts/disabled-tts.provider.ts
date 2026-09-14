import { Injectable } from "@nestjs/common";
import { AppException } from "../../common/errors/app.exception";
import type {
  TtsProvider,
  TtsProviderHealth,
  TtsSequenceRequest,
  TtsSynthesisRequest,
  TtsSynthesisResult,
  TtsVoice,
} from "./tts-provider";

@Injectable()
export class DisabledTtsProvider implements TtsProvider {
  async getVoices(): Promise<TtsVoice[]> {
    return [];
  }

  async synthesize(_request: TtsSynthesisRequest): Promise<TtsSynthesisResult> {
    throw new AppException(
      "TTS_PROVIDER_NOT_CONFIGURED",
      "Text-to-speech is disabled because no provider is configured.",
      503,
    );
  }

  async synthesizeSequence(
    _request: TtsSequenceRequest,
  ): Promise<TtsSynthesisResult> {
    throw new AppException(
      "TTS_PROVIDER_NOT_CONFIGURED",
      "Text-to-speech is disabled because no provider is configured.",
      503,
    );
  }

  async healthCheck(): Promise<TtsProviderHealth> {
    return { configured: false, healthy: false, provider: "none" };
  }
}
