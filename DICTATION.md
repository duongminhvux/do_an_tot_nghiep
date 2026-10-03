# Dictation module

## What is implemented

- Learner sidebar:
  - `Dictation` -> `/[locale]/dictation`
  - `Tiến độ Dictation` -> `/[locale]/dictation/progress`
- Admin sidebar:
  - `Dictation` -> `/[locale]/dictation`
- Admin can create/edit a lesson from a paragraph or dialogue, choose level/topic/accent, choose one or two Kokoro voices, configure speed/pause, generate audio, preview every segment, and publish/unpublish.
- Learners can browse published lessons, listen to full audio or each sentence, type an answer, check it, reveal the answer, navigate sentences, use keyboard shortcuts, open the full transcript, and save progress.

## Segmentation behavior

The backend owns segmentation.

1. If the admin text contains multiple non-empty lines, each line becomes one dictation segment. This is useful for dialogue turns where one turn may contain multiple grammatical sentences.
2. If the admin enters one continuous paragraph, Node `Intl.Segmenter('en', { granularity: 'sentence' })` splits it into English sentences automatically.

The create page has a **Xem cách tách câu** action that calls the backend preview endpoint, so the admin sees the exact segment boundaries before generation.

## Voice assignment

`voiceIds` is an ordered list. The backend rotates through it by segment index:

```text
segment 1 -> voiceIds[0]
segment 2 -> voiceIds[1]
segment 3 -> voiceIds[0]
segment 4 -> voiceIds[1]
...
```

If the admin chooses only one voice, every segment uses that voice.

## Audio generation flow

```text
Admin source text
    -> NestJS splitIntoSentences()
    -> Kokoro /v1/synthesize for each segment
    -> upload each WAV to Cloudinary
    -> Kokoro /v1/synthesize-sequence for full audio
    -> upload full WAV to Cloudinary
    -> save DictationLesson + DictationSegment metadata in MongoDB
```

The old published audio stays untouched until the new set has finished generating and uploading. A content/voice change marks the lesson as `DRAFT`; it cannot be published again until generation finishes and the status becomes `READY`.

## Main Mongo collections

- `dictationlessons`
- `dictationsegments`
- `dictationprogresses`

## Admin API

```text
GET    /api/admin/dictation
POST   /api/admin/dictation
GET    /api/admin/dictation/voices
POST   /api/admin/dictation/preview-split
GET    /api/admin/dictation/:id
PATCH  /api/admin/dictation/:id
POST   /api/admin/dictation/:id/generate-audio
POST   /api/admin/dictation/:id/publish
POST   /api/admin/dictation/:id/unpublish
DELETE /api/admin/dictation/:id
```

## Learner API

```text
GET  /api/dictation
GET  /api/dictation/progress
GET  /api/dictation/slug/:slug
GET  /api/dictation/:id/progress
POST /api/dictation/:id/progress/attempt
POST /api/dictation/:id/progress/reset
```

## Run

```bash
docker compose up --build
```

Then open:

```text
Learner: http://localhost:3000
Admin:   http://localhost:3001
API:     http://localhost:5000/api
```

Kokoro runs inside Docker. Generated audio is persisted on Cloudinary, so valid Cloudinary credentials are required in `apps/api/.env` for Dictation generation.
