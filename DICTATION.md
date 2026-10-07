# Dictation module - unified audio/timestamp architecture

## Final storage model

Both Dictation sources now converge to the same persisted shape:

```text
DictationLesson
  fullAudioUrl     -> exactly one persisted lesson audio file
  totalDurationMs
  audioSource      -> TTS | UPLOAD

DictationSegment[]
  text
  normalizedText
  startMs
  endMs
  durationMs
  source           -> TTS | ASR
  voiceId          -> populated for TTS, blank for uploaded audio
  confidence       -> 1 for TTS, ASR confidence for uploaded audio
  words[]          -> word timestamps from Faster Whisper when available
```

Learners never need a separate URL for every sentence. The web player seeks the single lesson audio to `startMs` and pauses at `endMs`.

## TTS flow (Kokoro)

```text
Admin transcript
  -> NestJS splits into segments
  -> NestJS calls Kokoro sequence endpoint
  -> Kokoro synthesizes EACH segment independently in memory
  -> Kokoro appends the generated arrays + configured silence
  -> Kokoro returns one WAV + exact start/end metadata for every segment
  -> NestJS uploads only the final WAV to Cloudinary
  -> MongoDB stores segment timestamps
```

No sentence WAV is uploaded anymore. There is therefore nothing to clean up per sentence in the normal flow. Legacy per-segment Cloudinary assets are deleted the next time an old lesson is regenerated.

Kokoro returns a compact `X-Segment-Timings-Ms` header in the form:

```text
0:3240,3540:7180,7480:10250
```

NestJS converts this to `startMs/endMs/durationMs` metadata.

## Uploaded-audio flow (Faster Whisper)

The create screen now has two sources:

- `Kokoro TTS`
- `Upload audio`

Upload flow:

```text
Admin uploads MP3/WAV/M4A/OGG/WEBM/...
  -> NestJS sends bytes to asr-service
  -> Faster Whisper transcribes English audio
  -> word_timestamps=true
  -> ASR service groups words into sentence-like segments
  -> NestJS adds small configurable playback padding
  -> original upload becomes the one persisted lesson audio file
  -> transcript + start/end + word metadata are stored in MongoDB
  -> admin reviews text/timestamps before publishing
```

The admin detail screen can play any segment by seeking the full audio. Text, start time, end time and speaker can be edited without cutting or re-uploading audio.

## ASR service

Internal Docker service:

```text
http://asr-service:8002
```

Endpoints:

```text
GET  /health
POST /v1/transcribe
```

NestJS endpoint used by admin:

```text
POST /api/admin/dictation/:id/analyze-audio
multipart/form-data field: file
```

Other admin endpoints added/updated:

```text
GET   /api/admin/dictation/processors/health
PATCH /api/admin/dictation/:id/segments
POST  /api/admin/dictation/:id/generate-audio
```

## CPU / GPU configuration

### CPU

Default stack:

```bash
docker compose up --build
```

Defaults:

```env
KOKORO_DEVICE=cpu
ASR_DEVICE=cpu
ASR_COMPUTE_TYPE=int8
ASR_MODEL=small.en
```

### NVIDIA GPU

Requirements: NVIDIA driver + NVIDIA Container Toolkit.

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

GPU override values are also configured in root `.env`:

```env
KOKORO_DEVICE_GPU=cuda
ASR_DEVICE_GPU=cuda
ASR_COMPUTE_TYPE_GPU=float16
```

`docker-compose.gpu.yml` maps these GPU-specific values onto the runtime `KOKORO_DEVICE`, `ASR_DEVICE`, and `ASR_COMPUTE_TYPE` variables.

Kokoro uses the CUDA PyTorch wheel in the GPU compose override. Faster Whisper uses the CUDA/cuDNN ASR image.

## Relevant env vars

```env
# Kokoro
KOKORO_DEVICE=cpu
KOKORO_MODEL_ID=hexgrad/Kokoro-82M
TTS_REQUEST_TIMEOUT_MS=120000

# Faster Whisper
ASR_DEVICE=cpu
ASR_COMPUTE_TYPE=int8
ASR_MODEL=small.en
ASR_VAD_FILTER=true
ASR_BEAM_SIZE=5
ASR_SENTENCE_GAP_MS=900
ASR_MAX_UPLOAD_MB=100
ASR_REQUEST_TIMEOUT_MS=600000

# Playback padding for uploaded audio
DICTATION_SEGMENT_START_PADDING_MS=100
DICTATION_SEGMENT_END_PADDING_MS=150
```

All Dictation, Kokoro and Faster Whisper configuration is centralized in the repository root `.env`. Use root `.env.example` as the template; there are no app-level env files.

## Notes

- Faster Whisper output is an automatic draft. Admin review is intentionally kept in the workflow because names, numbers and uncommon words can be transcribed incorrectly.
- `words[]` is persisted for uploaded audio so later features such as karaoke highlighting, word-level replay or smarter split/merge can be added without re-running ASR.
- Existing Dictation records created by the old architecture can be regenerated. Their old sentence audio assets are cleaned up during replacement.
