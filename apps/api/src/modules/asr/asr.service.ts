import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AsrWordTiming {
  word: string;
  startMs: number;
  endMs: number;
  probability: number;
}

export interface AsrSegmentResult {
  text: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  confidence: number;
  words: AsrWordTiming[];
}

export interface AsrTranscriptionResult {
  text: string;
  language: string;
  languageProbability: number;
  durationMs: number;
  model: string;
  device: string;
  computeType: string;
  segments: AsrSegmentResult[];
}

@Injectable()
export class AsrService {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = (
      this.configService.get<string>('ASR_SERVICE_URL') ??
      'http://asr-service:8002'
    ).replace(/\/$/, '');

    const configuredTimeout = Number(
      this.configService.get<string>('ASR_REQUEST_TIMEOUT_MS') ?? '600000',
    );
    this.timeoutMs = Number.isFinite(configuredTimeout)
      ? configuredTimeout
      : 600_000;
  }

  async health(): Promise<unknown> {
    const response = await this.fetchAsr('/health', { method: 'GET' });
    if (!response.ok) await this.throwUpstreamError(response, '/health');
    return response.json();
  }

  async transcribe(
    audio: Buffer,
    filename: string,
    contentType: string,
    language = 'en',
  ): Promise<AsrTranscriptionResult> {
    const form = new FormData();
    const arrayBuffer = audio.buffer.slice(
      audio.byteOffset,
      audio.byteOffset + audio.byteLength,
    ) as ArrayBuffer;
    form.append(
      'file',
      new Blob([arrayBuffer], { type: contentType || 'application/octet-stream' }),
      filename,
    );
    form.append('language', language);

    const response = await this.fetchAsr('/v1/transcribe', {
      method: 'POST',
      body: form,
    });
    if (!response.ok) await this.throwUpstreamError(response, '/v1/transcribe');
    return response.json() as Promise<AsrTranscriptionResult>;
  }

  private async fetchAsr(
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
          `ASR service timed out after ${this.timeoutMs} ms`,
        );
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new ServiceUnavailableException(
        `ASR service is unavailable: ${message}`,
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
      `ASR request ${path} failed with ${response.status}: ${detail}`,
    );
  }
}
