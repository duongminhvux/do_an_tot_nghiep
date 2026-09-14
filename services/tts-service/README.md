# ListenUp local Kokoro TTS service

This service is a small FastAPI wrapper around `hexgrad/Kokoro-82M`. It is designed to run as the `tts-service` container in the root Docker Compose stack and use one NVIDIA GPU.

Runtime:

- Python 3.11
- Kokoro 0.9.4
- PyTorch 2.7.1 CUDA 12.6 wheel
- 24 kHz PCM WAV output
- American English (`en-US`) and British English (`en-GB`)
- persistent Hugging Face model/voice cache at `/models/huggingface`

Endpoints:

```text
GET  /health
GET  /voices
POST /v1/synthesize
POST /v1/synthesize-sequence
```

`/v1/synthesize-sequence` is used for multi-segment TOEIC stimuli. NestJS composes the authoring segments and can assign a separate Kokoro voice to each speaker before calling this endpoint.

The service deliberately fails startup when `KOKORO_DEVICE=cuda` is requested but CUDA is unavailable. This avoids silently running a supposedly GPU-backed deployment on CPU.
