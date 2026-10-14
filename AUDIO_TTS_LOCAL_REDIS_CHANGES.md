# Local audio, Redis queue, Vocabulary + TOEIC TTS

## Storage model

Audio no longer needs Cloudinary during development. The API writes generated or manually uploaded audio to the repository `storage/` directory (bind-mounted as `/app/storage` in Docker) and exposes it through `/media/*`.

```text
storage/
├── vocab/<wordId>/us.wav | uk.wav
├── toeic/questions/<questionId>/audio.wav
├── toeic/passages/<passageId>/audio.wav
└── dictation/<lessonId>/full.wav
```

Images keep the existing Cloudinary path so image features do not regress. Audio records store a URL plus metadata (`source`, `status`, `storageKey`, voice(s), speed, duration, script hash, generation device and segment timings).

## Redis audio jobs

Redis is the temporary job coordinator, not the source of truth. MongoDB keeps final content/audio metadata. Bulk operations enqueue jobs and the API worker executes them with `AUDIO_QUEUE_CONCURRENCY=1` by default so Kokoro/Whisper do not compete for a small GPU.

Admin endpoints:

```text
GET  /api/admin/audio/voices
POST /api/admin/audio/vocabulary/:id/generate
POST /api/admin/audio/vocabulary/:id/upload/:accent
POST /api/admin/audio/vocabulary/bulk
POST /api/admin/audio/toeic/questions/:id/generate
POST /api/admin/audio/toeic/questions/:id/upload
POST /api/admin/audio/toeic/passages/:id/generate
POST /api/admin/audio/toeic/passages/:id/upload
POST /api/admin/audio/toeic/exams/:examId/generate
GET  /api/admin/audio/jobs/:id
```

## Vocabulary

Each dictionary word can have independently generated US and UK pronunciation. Kokoro is the primary stored pronunciation; the existing browser speech synthesis remains a fallback for legacy words without stored audio. Admin supports quick-create, advanced editing, generate/regenerate, manual local upload, playback, status, and bulk generation for selected words.

## TOEIC Listening

- Part 1: one final audio per question, built from the answer statements.
- Part 2: one final audio per question, built from the prompt plus responses (separate prompt/response voices).
- Part 3: one final audio per passage/conversation. Lines such as `A: ...`, `B: ...`, `C: ...` are mapped to different voices.
- Part 4: one final audio per talk, using one narrator voice and internal sentence pauses.

Kokoro may synthesize internal segments separately, but only the final combined audio is persisted. Segment timing metadata is retained for future practice/replay features.

Editing source text marks generated audio `STALE`, so admin can see that regeneration is required. Manual uploaded audio is preserved by bulk generation.

## Environment

Important root `.env` values:

```env
REDIS_URL=redis://localhost:6379
DOCKER_REDIS_URL=redis://redis:6379
AUDIO_QUEUE_CONCURRENCY=1

MEDIA_STORAGE_PATH=./storage
DOCKER_MEDIA_STORAGE_PATH=/app/storage
MEDIA_PUBLIC_BASE_URL=http://localhost:5000/media

VOCAB_TTS_US_VOICE=af_heart
VOCAB_TTS_UK_VOICE=bf_emma
VOCAB_TTS_SPEED=1

TOEIC_TTS_SPEED=1
TOEIC_TTS_OPTION_PAUSE_MS=650
TOEIC_TTS_TURN_PAUSE_MS=350
TOEIC_TTS_SENTENCE_PAUSE_MS=260
TOEIC_P1_VOICE=af_heart
TOEIC_P2_PROMPT_VOICE=am_adam
TOEIC_P2_RESPONSE_VOICE=af_heart
TOEIC_P3_SPEAKER_A_VOICE=am_adam
TOEIC_P3_SPEAKER_B_VOICE=af_heart
TOEIC_P3_SPEAKER_C_VOICE=bm_george
TOEIC_P4_VOICE=bf_emma
```

CPU/GPU selection for Kokoro and Faster Whisper continues to use the existing root env plus `docker-compose.gpu.yml` override.
