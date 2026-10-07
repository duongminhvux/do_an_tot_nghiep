# Root environment configuration

The repository now uses exactly one application configuration file:

```text
.env
```

It lives at the repository root beside `docker-compose.yml`. Start from:

```bash
cp .env.example .env
```

Per-app env files under `apps/api`, `apps/web`, and `apps/admin-web` have been removed.

## Why local and Docker URLs are separate

The same root file supports both local processes and Docker containers. A process running on the host reaches services through `localhost`, while an API container reaches other containers through Docker DNS names.

```env
MONGO_URI=mongodb://127.0.0.1:27017/english-platform
DOCKER_MONGO_URI=mongodb://mongo:27017/english-platform

TTS_SERVICE_URL=http://localhost:8001
DOCKER_TTS_SERVICE_URL=http://tts-service:8001

ASR_SERVICE_URL=http://localhost:8002
DOCKER_ASR_SERVICE_URL=http://asr-service:8002
```

NestJS and API scripts use the local values when run directly. `docker-compose.yml` maps the `DOCKER_*` values into the API container.

## Next.js

`apps/web/next.config.js` and `apps/admin-web/next.config.ts` load the root `.env` for local builds/dev. Docker builds still receive `NEXT_PUBLIC_API_URL` as a build argument because public Next.js variables are compiled into the client bundle.

## CPU / GPU

CPU defaults live in root `.env`:

```env
KOKORO_DEVICE=cpu
ASR_DEVICE=cpu
ASR_COMPUTE_TYPE=int8
```

The GPU compose override reads its GPU values from the same root file:

```env
KOKORO_DEVICE_GPU=cuda
ASR_DEVICE_GPU=cuda
ASR_COMPUTE_TYPE_GPU=float16
```

CPU:

```bash
docker compose up --build
```

GPU:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

## Security

`.env` is ignored by Git. Keep real JWT, OAuth, mail and Cloudinary credentials only in `.env`. Keep placeholders in `.env.example`.
