# Docker stack for the TOEIC platform

## Local AI: import an existing TOEIC PDF (NVIDIA GPU)

### Create an ETS test from four PDFs

The exam-list **Create exam** button now opens **Manual / Local AI** choices.
The AI flow accepts separate Listening, Reading, Listening answer-key and Reading
answer-key PDFs. Select the Test number (1–10) before starting; ETS answer PDFs
can contain several Tests per page. The importer clips the selected table by its
PDF coordinates, requires 100 LC plus 100 RC answers, and matches question numbers
1–100 / 101–200. Answer extraction does not depend on the language model.

Scanned question booklets are OCRed locally with Tesseract. Two-column questions
are recognized separately to preserve their answer choices. The supplied ETS
Part 6 layout is read as a full-width passage followed by two answer columns;
standalone blank numbers and group headers are retained during extraction. The
layout supports extracting the six Part 1 photographs; rendered source-page
previews are kept under `storage/pdf-ai/` and served by the API for review.
Only after recognition finishes can the admin create an inactive exam draft and
review/save individual Parts. Starting recognition does not create an exam.

The four supplied ETS PDFs contain answer keys, **not Listening audio or
transcripts**. Unprinted questions/options remain empty; shared Listening groups
have empty transcripts and require audio to be supplied before saving. The model
must not manufacture missing listening content. Missing OCR question numbers are
retained as visibly incomplete draft slots for review.

Inference requests contain at most eight recognized question numbers while keeping
the full overlapping source window for shared passages. If Ollama reports a
truncated output (`done_reason=length`), the service automatically retries smaller
question scopes. It never parses truncated JSON or asks the admin to cut the PDFs.
If even a single question cannot be read, its omission is reported for review;
missing text is not invented.

Transient Ollama HTTP 429/500/502/503/504 and transport failures are retried up to
three attempts per request with short backoff. Persistent failures retain the
Ollama error detail rather than returning only a generic HTTP status. Invalid
requests and missing models fail immediately; partial responses are never saved.
The model is kept loaded for five minutes between requests (override with
`PDF_AI_KEEP_ALIVE` in the PDF service environment), avoiding rapid unload/reload
cycles during long extraction requests.
Scoped requests also constrain question numbers and array lengths in the JSON
schema. Each printed Part 7 exercise is sent with its own complete source segment
and at most one passage group, excluding unrelated exercises from that request.

Part 6's four-blank groups are parsed from the printed layout when all four answer
blocks can be identified; each question references its numbered blank. Part 7
inference is scoped to each printed exercise header so unrelated passages are not
merged. LC/RC question ranges also exclude page-footer numbers from extraction.

The local-AI Compose override mounts `./storage/pdf-ai` into the PDF service.
Restart/recreate that service after changing the mount. Admin can also run on the
host with `pnpm --filter admin_web build` then `pnpm --filter admin_web start`;
keep its Docker container stopped when using the same port 3001.

The optional PDF AI service reads text-based PDFs and uses a local Ollama model to
extract questions, answer choices and shared passages. It does not train a model
or send PDF content to a cloud API. Internet access is needed initially to download
images and the model. The default model is `qwen2.5:7b`; change `OLLAMA_MODEL` in the
root `.env` if needed. Windows Docker Desktop needs its WSL2 NVIDIA GPU support.

Use the same Compose files for subsequent `up` operations so the API retains its
`PDF_AI_URL=http://pdf-ai:8003` configuration. In PowerShell, `docker-compose`
can be used in place of `docker compose` when the CLI plugin is not on the path.

```powershell
docker compose -f docker-compose.yml -f docker-compose.ai.yml up -d --build ollama pdf-ai redis
docker compose -f docker-compose.yml -f docker-compose.ai.yml exec ollama ollama pull qwen2.5:7b
docker compose -f docker-compose.yml -f docker-compose.ai.yml up -d --build --no-deps api admin-web
```

In admin, create/open a TOEIC exam, choose **Import questions → AI local · PDF**,
then upload the exam PDF (up to 25 MB / 150 pages). If answers are in a separate
PDF, upload that file too. The AI detects Parts, retains original question numbers
in its draft, and displays progress while processing overlapping page windows.
Review each detected Part using the existing question editor and save it into the
exam. Saved questions use the application's existing append/import workflow.
The operation never overwrites existing questions. Download the JSON result to
keep a copy; in-memory job results expire after 24 hours or a service restart.

Missing answers stay blank, so the existing validator blocks saving incomplete
questions. Answer evidence is checked for presence in the source, but must still
be reviewed for correctness. The single-exam uploader requires selectable text;
use the four-PDF creation flow for scan OCR and Part 1 image extraction. Importing
Listening audio is a separate step. Listening PDFs without transcripts/options cannot
be reconstructed from printed question text alone. Existing image/audio upload
fields remain available during review. Generation of Listening audio continues
through the separate Kokoro feature once its source text has been supplied.

Local API development uses `PDF_AI_URL=http://localhost:8003`. PDF text and Ollama
inference run locally; the PDF AI and Ollama ports bind only to `127.0.0.1`.

```powershell
# Unit tests (no downloaded model required)
cd services/pdf-ai
python -m unittest discover -v
```

The stack contains six services:

- `web`: Next.js user application on `http://localhost:3000`
- `admin-web`: Next.js admin application on `http://localhost:3001`
- `api`: NestJS API on `http://localhost:5000/api`
- `mongo`: MongoDB, available only inside the Docker network
- `tts-service`: FastAPI + Kokoro, available only inside the Docker network
- `asr-service`: FastAPI + Faster Whisper, available only inside the Docker network

## 1. Prepare the single root environment file

All project configuration now lives in one file at the repository root. There are no per-app `.env` files under `apps/api`, `apps/web`, or `apps/admin-web`.

Create the root file when needed:

```bash
cp .env.example .env
```

Then fill in JWT, Google OAuth, mail, Cloudinary and any runtime overrides. Docker Compose automatically reads root `.env` for interpolation. NestJS and both Next.js apps also load this same root file when you run them locally.

The root file intentionally has separate local and Docker service addresses:

```env
MONGO_URI=mongodb://127.0.0.1:27017/english-platform
DOCKER_MONGO_URI=mongodb://mongo:27017/english-platform

TTS_SERVICE_URL=http://localhost:8001
DOCKER_TTS_SERVICE_URL=http://tts-service:8001

ASR_SERVICE_URL=http://localhost:8002
DOCKER_ASR_SERVICE_URL=http://asr-service:8002
```

Local NestJS/scripts use the non-`DOCKER_` values. Docker Compose injects the Docker-network addresses into the API container.

## 2. Start the complete stack

CPU-compatible mode, works without an NVIDIA GPU:

```bash
docker compose up --build
```

Run detached:

```bash
docker compose up --build -d
```

The first TTS/ASR startup downloads model files into the persistent `kokoro_models` and `whisper_models` volumes. Later starts reuse those caches.

## 3. NVIDIA GPU mode

Requirements on the Docker host:

- NVIDIA driver
- NVIDIA Container Toolkit / Docker GPU support

Start the same stack with the GPU override:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

This switches Kokoro to CUDA PyTorch and Faster Whisper to its CUDA/cuDNN image. Both services receive GPU access. Runtime defaults can be overridden from root `.env`.

## 4. Backend -> TTS / ASR HTTP flow

Inside Docker, NestJS calls:

```text
TTS: http://tts-service:8001
ASR: http://asr-service:8002
```

Neither AI service is published to the host. Client applications call NestJS, not the FastAPI services directly.

Available backend endpoints:

```text
GET  /api/tts/health
GET  /api/tts/voices
POST /api/tts/synthesize
POST /api/tts/synthesize-sequence
```

`GET /api/tts/health` and `GET /api/tts/voices` are public for diagnostics and voice selection. Synthesis endpoints keep the project's normal JWT protection.

Example authenticated synthesis request:

```bash
curl -X POST http://localhost:5000/api/tts/synthesize \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --output sample.wav \
  -d '{"text":"Welcome to the TOEIC listening test.","voiceId":"af_heart","language":"en-US","speed":1}'
```

Example multi-speaker request:

```bash
curl -X POST http://localhost:5000/api/tts/synthesize-sequence \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --output conversation.wav \
  -d '{
    "defaultLanguage":"en-US",
    "defaultSpeed":1,
    "segments":[
      {"text":"Good morning. How may I help you?","voiceId":"af_heart","pauseAfterMs":400},
      {"text":"I would like to change my reservation.","voiceId":"am_adam","pauseAfterMs":600}
    ]
  }'
```

The NestJS API forwards the WAV bytes and Kokoro metadata headers back to the caller.

## 5. Useful commands

```bash
# Check containers
docker compose ps

# Follow all logs
docker compose logs -f

# Follow API + audio AI services
docker compose logs -f api tts-service asr-service

# Verify API
curl http://localhost:5000/api/health

# Verify API -> TTS communication
curl http://localhost:5000/api/tts/health

# Stop containers but keep Mongo/model data
docker compose down

# Stop and delete Mongo/model volumes too
docker compose down -v
```


## 6. Important networking rule

`localhost` means different things depending on where code runs:

- Browser -> API: `http://localhost:5000/api`
- API container -> Mongo: `mongodb://mongo:27017/...`
- API container -> TTS: `http://tts-service:8001`
- API container -> ASR: `http://asr-service:8002`

Do not configure the API container to call Mongo or TTS using `localhost`.

## 7. Existing local Mongo data

The Dockerized MongoDB uses the named volume `mongo_data`. Data from a MongoDB instance previously running directly on the host is not copied automatically. Export/import that database separately if you need the existing users or application data inside the Docker volume.

## 8. Dictation audio flow

Dictation now persists exactly one lesson audio file for both sources. Segment playback uses MongoDB timestamps.

TTS:

```text
admin text -> Kokoro per-segment synthesis in memory -> one merged WAV
          -> exact segment start/end metadata -> local ./storage full WAV only
```

Upload:

```text
admin audio -> Faster Whisper word timestamps -> sentence metadata
            -> original full audio in local ./storage
```

Important admin endpoints:

```text
GET   /api/admin/dictation/processors/health
POST  /api/admin/dictation/:id/generate-audio
POST  /api/admin/dictation/:id/analyze-audio
PATCH /api/admin/dictation/:id/segments
```

See `DICTATION.md` for the complete data model and CPU/GPU configuration.

## 9. Admin login / reset seeded admin

The default admin seed and the manual seed script use the same defaults:

```text
email: admin@gmail.com
username: admin
password: admin123
```

For a fresh Mongo volume, the API creates the default admin automatically when no matching admin exists.

If `mongo_data` already contains an admin created by an older build, its bcrypt hash may have been generated from a different old default password. Reset that existing record once with:

```bash
docker compose exec api pnpm --filter api seed:admin admin@gmail.com admin admin123
```

The seed script intentionally preserves the Docker-provided `MONGO_URI`, so the command updates the MongoDB container instead of accidentally trying `localhost` from inside the API container.

You can customize the initial credentials with `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_USERNAME`, and `DEFAULT_ADMIN_PASSWORD`. `DEFAULT_ADMIN_SYNC_PASSWORD` stays `false` by default so restarting the API does not silently overwrite a password in an existing database.


## 10. Environment layout

The supported layout is now:

```text
project/
├── .env
├── .env.example
├── docker-compose.yml
├── docker-compose.gpu.yml
└── apps/
    ├── api/
    ├── web/
    └── admin-web/
```

Do not recreate `apps/api/.env`, `apps/web/.env`, or `apps/admin-web/.env`. The root `.env` is the only configuration source. `.env` is ignored by Git; `.env.example` is safe to commit after keeping real secrets out of it.


## 11. Local media + Redis audio jobs

Generated/uploaded audio is stored on the host under `./storage` and bind-mounted into the API container at `/app/storage`. MongoDB stores the public media URL plus generation metadata; Redis stores only temporary/background job state. Images may still use the existing Cloudinary integration.

```text
./storage/
├── vocab/<wordId>/us.wav | uk.wav
├── toeic/questions/<questionId>/audio.wav
├── toeic/passages/<passageId>/audio.wav
└── dictation/<lessonId>/full.wav
```

The API exposes these files at `/media/*`. Bulk Vocabulary and TOEIC generation jobs are serialized through Redis with `AUDIO_QUEUE_CONCURRENCY=1` by default, which is safer when Kokoro and Faster Whisper share one GPU.
