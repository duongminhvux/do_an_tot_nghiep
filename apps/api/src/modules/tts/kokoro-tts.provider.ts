import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppException } from "../../common/errors/app.exception";
import type {
  TtsProvider,
  TtsProviderHealth,
  TtsSequenceRequest,
  TtsSynthesisRequest,
  TtsSynthesisResult,
  TtsVoice,
} from "./tts-provider";

interface KokoroHealthResponse {
  provider?: string;
  model?: string;
  ready?: boolean;
  device?: string;
  gpuName?: string | null;
  error?: string | null;
}

interface KokoroVoicesResponse {
  voices?: TtsVoice[];
}

@Injectable()
export class KokoroTtsProvider implements TtsProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (
      config.get<string>("KOKORO_TTS_URL") ?? "http://tts-service:8001"
    ).replace(/\/$/, "");
    this.timeoutMs = config.get<number>("KOKORO_TTS_TIMEOUT_MS") ?? 120_000;
  }

  async getVoices(): Promise<TtsVoice[]> {
    const response = await this.request("/voices", { method: "GET" });
    const body = (await response.json()) as KokoroVoicesResponse;
    return Array.isArray(body.voices) ? body.voices : [];
  }

  async synthesize(request: TtsSynthesisRequest): Promise<TtsSynthesisResult> {
    return this.requestAudio("/v1/synthesize", request);
  }

  async synthesizeSequence(
    request: TtsSequenceRequest,
  ): Promise<TtsSynthesisResult> {
    return this.requestAudio("/v1/synthesize-sequence", request);
  }

  async healthCheck(): Promise<TtsProviderHealth> {
    try {
      const response = await this.request("/health", { method: "GET" }, 5_000);
      const body = (await response.json()) as KokoroHealthResponse;
      return {
        configured: true,
        healthy: Boolean(body.ready),
        provider: body.provider ?? "kokoro",
        model: body.model,
        device: body.device,
        gpuName: body.gpuName,
        error: body.error,
      };
    } catch (error) {
      return {
        configured: true,
        healthy: false,
        provider: "kokoro",
        error: error instanceof Error ? error.message : "Kokoro is unreachable",
      };
    }
  }

  private async requestAudio(
    path: string,
    body: TtsSynthesisRequest | TtsSequenceRequest,
  ): Promise<TtsSynthesisResult> {
    const response = await this.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const durationHeader = response.headers.get("x-audio-duration-ms");
    return {
      audio: Buffer.from(await response.arrayBuffer()),
      mimeType: response.headers.get("content-type")?.split(";")[0] ?? "audio/wav",
      durationMs: durationHeader ? Number(durationHeader) : undefined,
    };
  }

  private async request(
    path: string,
    init: RequestInit,
    timeoutMs = this.timeoutMs,
  ): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new AppException(
        "TTS_PROVIDER_UNAVAILABLE",
        error instanceof Error
          ? `Kokoro service is unavailable: ${error.message}`
          : "Kokoro service is unavailable.",
        503,
      );
    }
    if (!response.ok) {
      let detail = `Kokoro service returned HTTP ${response.status}.`;
      try {
        const body = (await response.json()) as { detail?: string };
        if (body.detail) detail = body.detail;
      } catch {
        // Keep the HTTP status message when the response is not JSON.
      }
      throw new AppException(
        response.status === 422 ? "TTS_INVALID_REQUEST" : "TTS_PROVIDER_ERROR",
        detail,
        response.status >= 500 ? 502 : response.status,
      );
    }
    return response;
  }
}
