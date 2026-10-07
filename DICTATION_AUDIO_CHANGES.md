# Dictation audio changes in this build

## Added

- `services/asr-service`: FastAPI + Faster Whisper, word timestamps enabled.
- Admin Dictation source selector: Kokoro TTS or uploaded audio.
- `POST /api/admin/dictation/:id/analyze-audio`.
- Admin transcript/timestamp review editor.
- Unified `DictationSegment` metadata: `source`, `text`, `startMs`, `endMs`, `durationMs`, optional ASR `words` and `confidence`.
- CPU/GPU Docker configuration for both Kokoro and Faster Whisper.

## Changed

- Kokoro no longer uploads one Cloudinary file per sentence.
- Kokoro synthesizes each segment independently in memory, concatenates them once, and returns exact segment timing metadata.
- Only one final TTS WAV is persisted per lesson.
- Uploaded audio is kept as one file; Faster Whisper timestamps are used for sentence playback.
- Learner Dictation player now seeks the full lesson audio from `startMs` to `endMs`.

## Compatibility

Legacy segment `audioUrl/audioPublicId` fields remain temporarily in the Mongo schema only for cleanup/backward compatibility. Regenerating an old TTS lesson migrates it to the new one-audio architecture and removes its old per-sentence Cloudinary assets.
