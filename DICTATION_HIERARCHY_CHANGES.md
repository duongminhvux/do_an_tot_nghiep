# Dictation hierarchy/practice changes

This revision focuses only on the Dictation module and preserves the newer TOEIC work.

## Added

- 3-level content structure: Topic -> Section -> Lesson.
- Topic thumbnails with admin upload/replace support.
- Admin Topic & Section management screen and sidebar submenu.
- Topic card learner screen inspired by the supplied reference layout.
- Collapsible Section page with Lesson cards and progress.
- Sentence-by-sentence practice loop.
- Correct answer -> auto-next; optional auto-play next sentence.
- Wrong answer -> replay; reveal after configurable N wrong attempts.
- Reveal -> final replay and manual Next.
- Per-sentence replay count, attempts, wrong attempts, first-try correctness and reveal state.
- Soft Full Transcript confirmation + progress flag.
- Existing flat Dictation lessons lazily mapped into Topic / Section 1.
- Added `requests` explicitly to Faster Whisper service dependencies.

## Audio architecture retained

Both TTS and uploaded audio continue to use one persisted full audio file plus `startMs/endMs` segment metadata. No new per-sentence persisted audio files were introduced.
