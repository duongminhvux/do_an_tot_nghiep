# Intended ownership after migration

- Identity: auth, users, admins
- Content: vocabulary, dictation, YouTube dictation
- Assessment: TOEIC exams, questions, attempts
- Progress: course/lesson/review progress (split only after Content)
- Arena: matches, rating, presence; Redis is not a source-of-truth DB
- Media: media_assets / audio_jobs / object storage
- AI import: draft output and model metadata; no direct authoritative exam writes

The initial release retains the existing business NestJS monolith while background workers,
media, migrations, model caches and infrastructure are extracted. Database-per-service and
RabbitMQ domain-event consumers require a separate staged migration with API contract tests.
Do not share Mongoose models across process boundaries as the final architecture.
