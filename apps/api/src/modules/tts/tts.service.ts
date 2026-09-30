import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SynthesizeSequenceTtsDto,
  SynthesizeTtsDto,
} from './tts.dto.js';

export interface TtsAudioResult {
  audio: Buffer;
  contentType: string;
  durationMs?: string;
  sampleRate?: string;
  provider?: string;
  device?: string;
}

@Injectable()
export class TtsService {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = (
      this.configService.get<string>('TTS_SERVICE_URL') ??
      'http://tts-service:8001'
    ).replace(/\/$/, '');

    const configuredTimeout = Number(
      this.configService.get<string>('TTS_REQUEST_TIMEOUT_MS') ?? '120000',
    );
    this.timeoutMs = Number.isFinite(configuredTimeout)
      ? configuredTimeout
      : 120_000;
  }

  async health(): Promise<unknown> {
    return this.requestJson('/health');
  }

  async voices(): Promise<unknown> {
    return this.requestJson('/voices');
  }

  async synthesize(payload: SynthesizeTtsDto): Promise<TtsAudioResult> {
    return this.requestAudio('/v1/synthesize', payload);
  }

  async synthesizeSequence(
    payload: SynthesizeSequenceTtsDto,
  ): Promise<TtsAudioResult> {
    return this.requestAudio('/v1/synthesize-sequence', payload);
  }

  private async requestJson(path: string): Promise<unknown> {
    const response = await this.fetchTts(path, { method: 'GET' });
    if (!response.ok) {
      await this.throwUpstreamError(response, path);
    }
    return response.json();
  }

  private async requestAudio(
    path: string,
    payload: SynthesizeTtsDto | SynthesizeSequenceTtsDto,
  ): Promise<TtsAudioResult> {
    const response = await this.fetchTts(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      await this.throwUpstreamError(response, path);
    }

    return {
      audio: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') ?? 'audio/wav',
      durationMs: response.headers.get('x-audio-duration-ms') ?? undefined,
      sampleRate: response.headers.get('x-audio-sample-rate') ?? undefined,
      provider: response.headers.get('x-tts-provider') ?? undefined,
      device: response.headers.get('x-tts-device') ?? undefined,
    };
  }

  private async fetchTts(
    path: string,
    init: RequestInit,
  ): Promise<globalThis.Response> {
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new GatewayTimeoutException(
          `TTS service timed out after ${this.timeoutMs} ms`,
        );
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new ServiceUnavailableException(
        `TTS service is unavailable: ${message}`,
      );
    }
  }

  private async throwUpstreamError(
    response: globalThis.Response,
    path: string,
  ): Promise<never> {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (body?.detail) {
        detail =
          typeof body.detail === 'string'
            ? body.detail
            : JSON.stringify(body.detail);
      }
    } catch {
      // Keep statusText when the upstream body is not JSON.
    }

    throw new BadGatewayException(
      `TTS request ${path} failed with ${response.status}: ${detail}`,
    );
  }
}
