# Kokoro TTS service

Internal FastAPI service for local English TTS.

Endpoints:

- `GET /health`
- `GET /voices`
- `POST /v1/synthesize`
- `POST /v1/synthesize-sequence`

`/v1/synthesize-sequence` synthesizes each requested segment separately in memory, concatenates all segments (and configured pauses) into one WAV, and returns exact segment offsets in the response header:

```text
X-Segment-Timings-Ms: 0:3210,3510:7040,...
```

This lets NestJS persist one lesson audio file while still supporting sentence-by-sentence playback.

Runtime device is selected with `KOKORO_DEVICE=cpu|cuda`. Docker CPU/GPU commands are documented in `DOCKER.md`.


Environment configuration is centralized in the repository root `.env` / `.env.example`; do not create a service-local `.env`. Docker Compose passes only the variables required by this service.
