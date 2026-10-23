# Media Job Broker (PostgreSQL)

The media service persists audio jobs in `media_db.audio_jobs` and ASR jobs in `media_db.asr_jobs`. RabbitMQ is the background queue; SeaweedFS stores media bytes. The broker and worker use psycopg. See `README_POSTGRES_V8.md`.
