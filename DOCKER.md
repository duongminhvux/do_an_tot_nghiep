# Docker stack for the TOEIC platform

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
          -> exact segment start/end metadata -> Cloudinary full WAV only
```

Upload:

```text
admin audio -> Faster Whisper word timestamps -> sentence metadata
            -> original full audio on Cloudinary
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
