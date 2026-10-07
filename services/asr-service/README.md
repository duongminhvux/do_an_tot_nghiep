# Faster Whisper ASR service

Internal FastAPI service used by the NestJS API to turn uploaded Dictation audio into transcript + sentence/word timestamps.

- `GET /health`
- `POST /v1/transcribe` multipart field `file`, optional form field `language=en`

Important env vars: `ASR_MODEL`, `ASR_DEVICE`, `ASR_COMPUTE_TYPE`, `ASR_VAD_FILTER`, `ASR_BEAM_SIZE`, `ASR_SENTENCE_GAP_MS`, `ASR_MAX_UPLOAD_MB`.


Environment configuration is centralized in the repository root `.env` / `.env.example`; do not create a service-local `.env`. Docker Compose passes only the variables required by this service.
