# RabbitMQ transitional Audio Job broker

With `AUDIO_QUEUE_BACKEND=rabbitmq` the existing admin bulk endpoints publish to
RabbitMQ through this private broker; NestJS `audio-worker` runs the original
`AudioProcessingService` in a separate container. Existing `GET /api/admin/audio/jobs/:id`
continues to read Redis job progress, so Admin does not require changes.

- `job-broker` publishes persistent messages with publisher confirms.
- `job-runner` ACKs after Nest worker returns; timed retries and DLQ.
- `audio-worker` is an independent Nest bootstrap (5001 internal only).
- RabbitMQ queue durable/quorum. Separate 30-second retry queue + dead queue.
- Redis still holds job status (7 days) and Arena data; RabbitMQ holds pending messages.
- By default only primary consumer is enabled. Elastic is opt-in and fail-closed
  unless GPU admission is proven; queue backlog alone does not justify VRAM use.

Enable with `docker compose -f docker-compose.yml -f infra/compose/rabbitmq.yml up -d --build`.
Set `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, and >=24 char `JOB_INTERNAL_TOKEN`.

**Limits:** This is an incremental extraction, not a finished GPU autoscaler. The HTTP
worker can run for up to 1 hour; RabbitMQ consumer timeouts must exceed this. The worker
currently still imports business Mongoose models, so database-per-service ownership is a
future migration. Publish/store is not atomic; use a MongoDB outbox for production-grade
cross-service exactly-once effects. Audio results and current status remain in legacy Redis
for compatibility, not yet durable MongoDB job history. GPU elastic secondary containers
need an operator/supervisor to start; this release does not mount Docker socket into Admin.
