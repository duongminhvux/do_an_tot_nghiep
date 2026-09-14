from __future__ import annotations

import io
import os
import threading
from contextlib import asynccontextmanager
from typing import Literal

import numpy as np
import soundfile as sf
import torch
from fastapi import FastAPI, HTTPException, Response
from kokoro import KPipeline
from pydantic import BaseModel, Field, field_validator

SAMPLE_RATE = 24_000
MODEL_ID = os.getenv("KOKORO_MODEL_ID", "hexgrad/Kokoro-82M")
DEVICE = os.getenv("KOKORO_DEVICE", "cuda").strip().lower()

US_VOICES = [
    ("af_heart", "Heart", "Female"),
    ("af_alloy", "Alloy", "Female"),
    ("af_aoede", "Aoede", "Female"),
    ("af_bella", "Bella", "Female"),
    ("af_jessica", "Jessica", "Female"),
    ("af_kore", "Kore", "Female"),
    ("af_nicole", "Nicole", "Female"),
    ("af_nova", "Nova", "Female"),
    ("af_river", "River", "Female"),
    ("af_sarah", "Sarah", "Female"),
    ("af_sky", "Sky", "Female"),
    ("am_adam", "Adam", "Male"),
    ("am_echo", "Echo", "Male"),
    ("am_eric", "Eric", "Male"),
    ("am_fenrir", "Fenrir", "Male"),
    ("am_liam", "Liam", "Male"),
    ("am_michael", "Michael", "Male"),
    ("am_onyx", "Onyx", "Male"),
    ("am_puck", "Puck", "Male"),
    ("am_santa", "Santa", "Male"),
]
GB_VOICES = [
    ("bf_alice", "Alice", "Female"),
    ("bf_emma", "Emma", "Female"),
    ("bf_isabella", "Isabella", "Female"),
    ("bf_lily", "Lily", "Female"),
    ("bm_daniel", "Daniel", "Male"),
    ("bm_fable", "Fable", "Male"),
    ("bm_george", "George", "Male"),
    ("bm_lewis", "Lewis", "Male"),
]
VOICE_IDS = {voice[0] for voice in US_VOICES + GB_VOICES}


class VoiceDto(BaseModel):
    id: str
    name: str
    language: Literal["en-US", "en-GB"]
    gender: Literal["Female", "Male"]


class SynthesisRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20_000)
    voiceId: str | None = None
    language: Literal["en-US", "en-GB"] = "en-US"
    speed: float = Field(default=1.0, ge=0.5, le=2.0)

    @field_validator("text")
    @classmethod
    def clean_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Text cannot be blank")
        return cleaned


class SequenceSegment(BaseModel):
    text: str = Field(default="", max_length=20_000)
    voiceId: str | None = None
    language: Literal["en-US", "en-GB"] | None = None
    speed: float | None = Field(default=None, ge=0.5, le=2.0)
    pauseAfterMs: int = Field(default=0, ge=0, le=10_000)


class SequenceRequest(BaseModel):
    segments: list[SequenceSegment] = Field(min_length=1, max_length=200)
    defaultVoiceId: str = "af_heart"
    defaultLanguage: Literal["en-US", "en-GB"] = "en-US"
    defaultSpeed: float = Field(default=1.0, ge=0.5, le=2.0)


class KokoroRuntime:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.pipelines: dict[str, KPipeline] = {}
        self.device = DEVICE
        self.ready = False
        self.error: str | None = None

    def load(self) -> None:
        try:
            if self.device == "cuda" and not torch.cuda.is_available():
                raise RuntimeError(
                    "KOKORO_DEVICE=cuda was requested but torch.cuda.is_available() is false"
                )
            us = KPipeline(
                lang_code="a",
                repo_id=MODEL_ID,
                device=self.device,
            )
            gb = KPipeline(
                lang_code="b",
                repo_id=MODEL_ID,
                model=us.model,
            )
            self.pipelines = {"en-US": us, "en-GB": gb}
            self.ready = True
            self.error = None
        except Exception as exc:  # surfaced by health endpoint
            self.ready = False
            self.error = str(exc)
            raise

    @staticmethod
    def default_voice(language: str) -> str:
        return "bf_emma" if language == "en-GB" else "af_heart"

    @staticmethod
    def validate_voice(voice_id: str, language: str) -> None:
        if voice_id not in VOICE_IDS:
            raise ValueError(f"Unknown Kokoro voice: {voice_id}")
        if language == "en-US" and not voice_id.startswith(("af_", "am_")):
            raise ValueError(f"Voice {voice_id} is not an American English voice")
        if language == "en-GB" and not voice_id.startswith(("bf_", "bm_")):
            raise ValueError(f"Voice {voice_id} is not a British English voice")

    def synthesize_array(
        self,
        text: str,
        voice_id: str,
        language: str,
        speed: float,
    ) -> np.ndarray:
        self.validate_voice(voice_id, language)
        pipeline = self.pipelines[language]
        chunks: list[np.ndarray] = []
        with torch.inference_mode():
            for result in pipeline(text, voice=voice_id, speed=speed):
                # Kokoro 0.9.x returns a Result object and also preserves tuple
                # compatibility. Supporting both forms keeps the service resilient
                # across compatible Kokoro patch releases.
                audio_tensor = getattr(result, "audio", None)
                if audio_tensor is None:
                    try:
                        audio_tensor = result[2]
                    except (IndexError, TypeError):
                        audio_tensor = None
                if audio_tensor is None:
                    continue
                chunks.append(
                    audio_tensor.detach().float().cpu().numpy().reshape(-1)
                )
        if not chunks:
            raise RuntimeError("Kokoro returned no audio samples")
        return np.concatenate(chunks).astype(np.float32, copy=False)

    @staticmethod
    def wav_bytes(audio: np.ndarray) -> bytes:
        buffer = io.BytesIO()
        sf.write(buffer, audio, SAMPLE_RATE, format="WAV", subtype="PCM_16")
        return buffer.getvalue()

    def synthesize(self, request: SynthesisRequest) -> tuple[bytes, int]:
        voice = request.voiceId or self.default_voice(request.language)
        with self.lock:
            audio = self.synthesize_array(
                request.text,
                voice,
                request.language,
                request.speed,
            )
        duration_ms = round(len(audio) / SAMPLE_RATE * 1000)
        return self.wav_bytes(audio), duration_ms

    def synthesize_sequence(self, request: SequenceRequest) -> tuple[bytes, int]:
        pieces: list[np.ndarray] = []
        with self.lock:
            for segment in request.segments:
                language = segment.language or request.defaultLanguage
                voice = (
                    segment.voiceId
                    or (request.defaultVoiceId if language == request.defaultLanguage else None)
                    or self.default_voice(language)
                )
                speed = segment.speed or request.defaultSpeed
                if segment.text.strip():
                    pieces.append(
                        self.synthesize_array(
                            segment.text.strip(),
                            voice,
                            language,
                            speed,
                        )
                    )
                if segment.pauseAfterMs:
                    silence_samples = round(SAMPLE_RATE * segment.pauseAfterMs / 1000)
                    pieces.append(np.zeros(silence_samples, dtype=np.float32))
        if not pieces:
            raise ValueError("Sequence contains neither speakable text nor pauses")
        audio = np.concatenate(pieces).astype(np.float32, copy=False)
        duration_ms = round(len(audio) / SAMPLE_RATE * 1000)
        return self.wav_bytes(audio), duration_ms


runtime = KokoroRuntime()


@asynccontextmanager
async def lifespan(_: FastAPI):
    runtime.load()
    yield


app = FastAPI(title="ListenUp Local Kokoro TTS", version="1.0.0", lifespan=lifespan)


def audio_response(audio: bytes, duration_ms: int) -> Response:
    return Response(
        content=audio,
        media_type="audio/wav",
        headers={
            "X-Audio-Duration-Ms": str(duration_ms),
            "X-Audio-Sample-Rate": str(SAMPLE_RATE),
            "X-TTS-Provider": "kokoro",
            "X-TTS-Device": runtime.device,
        },
    )


@app.get("/health")
def health() -> dict[str, object]:
    gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
    return {
        "provider": "kokoro",
        "model": MODEL_ID,
        "ready": runtime.ready,
        "device": runtime.device,
        "cudaAvailable": torch.cuda.is_available(),
        "gpuName": gpu_name,
        "sampleRate": SAMPLE_RATE,
        "error": runtime.error,
    }


@app.get("/voices")
def voices() -> dict[str, list[VoiceDto]]:
    data = [
        VoiceDto(id=voice_id, name=name, language="en-US", gender=gender)
        for voice_id, name, gender in US_VOICES
    ] + [
        VoiceDto(id=voice_id, name=name, language="en-GB", gender=gender)
        for voice_id, name, gender in GB_VOICES
    ]
    return {"voices": data}


@app.post("/v1/synthesize")
def synthesize(request: SynthesisRequest) -> Response:
    if not runtime.ready:
        raise HTTPException(status_code=503, detail=runtime.error or "Kokoro is not ready")
    try:
        audio, duration_ms = runtime.synthesize(request)
        return audio_response(audio, duration_ms)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Kokoro synthesis failed: {exc}") from exc


@app.post("/v1/synthesize-sequence")
def synthesize_sequence(request: SequenceRequest) -> Response:
    if not runtime.ready:
        raise HTTPException(status_code=503, detail=runtime.error or "Kokoro is not ready")
    try:
        audio, duration_ms = runtime.synthesize_sequence(request)
        return audio_response(audio, duration_ms)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Kokoro sequence synthesis failed: {exc}") from exc
