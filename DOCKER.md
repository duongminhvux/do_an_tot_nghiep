# Docker stack for the TOEIC platform

The stack contains five services:

- `web`: Next.js user application on `http://localhost:3000`
- `admin-web`: Next.js admin application on `http://localhost:3001`
- `api`: NestJS API on `http://localhost:5000/api`
- `mongo`: MongoDB, available only inside the Docker network
- `tts-service`: FastAPI + Kokoro, available only inside the Docker network

## 1. Prepare backend environment

Keep the existing `apps/api/.env`. Docker Compose loads secrets and application settings from that file, but overrides container-specific addresses such as MongoDB and TTS.

If the file does not exist, create it first:

```bash
cp apps/api/.env.example apps/api/.env
```

Then fill in the JWT, Google OAuth, mail, and Cloudinary values you actually use.

## 2. Start the complete stack

CPU-compatible mode, works without an NVIDIA GPU:

```bash
docker compose up --build
```

Run detached:

```bash
docker compose up --build -d
```

The first TTS startup downloads Kokoro model files into the persistent `kokoro_models` volume. Later starts reuse that cache.

## 3. NVIDIA GPU mode

Requirements on the Docker host:

- NVIDIA driver
- NVIDIA Container Toolkit / Docker GPU support

Start the same stack with the GPU override:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

This switches the TTS image to the PyTorch CUDA 12.6 wheel, sets `KOKORO_DEVICE=cuda`, and grants the container access to the GPU.

## 4. Backend -> TTS HTTP flow

Inside Docker, NestJS calls:

```text
http://tts-service:8001
```

The TTS container is not published to the host. Client applications should call NestJS, not FastAPI directly.

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

# Follow only API/TTS logs
docker compose logs -f api tts-service

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

Do not configure the API container to call Mongo or TTS using `localhost`.

## 7. Existing local Mongo data

The Dockerized MongoDB uses the named volume `mongo_data`. Data from a MongoDB instance previously running directly on the host is not copied automatically. Export/import that database separately if you need the existing users or application data inside the Docker volume.
