export const TTS_PROVIDER = Symbol("TTS_PROVIDER");

export interface TtsVoice {
  id: string;
  name: string;
  language: string;
  gender?: string;
}

export interface TtsSynthesisRequest {
  text: string;
  voiceId: string;
  language: string;
  speed: number;
}

export interface TtsSequenceSegment {
  text: string;
  voiceId?: string;
  language?: string;
  speed?: number;
  pauseAfterMs?: number;
}

export interface TtsSequenceRequest {
  segments: TtsSequenceSegment[];
  defaultVoiceId: string;
  defaultLanguage: string;
  defaultSpeed: number;
}

export interface TtsSynthesisResult {
  audio: Buffer;
  mimeType: string;
  durationMs?: number;
}

export interface TtsProviderHealth {
  configured: boolean;
  healthy: boolean;
  provider: string;
  model?: string;
  device?: string;
  gpuName?: string | null;
  error?: string | null;
}

export interface TtsProvider {
  getVoices(): Promise<TtsVoice[]>;
  synthesize(request: TtsSynthesisRequest): Promise<TtsSynthesisResult>;
  synthesizeSequence(request: TtsSequenceRequest): Promise<TtsSynthesisResult>;
  healthCheck(): Promise<TtsProviderHealth>;
}
