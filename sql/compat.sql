-- Backward-compatibility shim for existing development volumes.
--
-- `database.sql` remains the canonical schema for fresh databases. PostgreSQL
-- only executes files in /docker-entrypoint-initdb.d when the data directory is
-- empty, so an already-created development volume can otherwise miss columns
-- added later. This script is intentionally idempotent and only upgrades the
-- small set of historical columns required by the current application.
-- It is safe to run on every startup.

BEGIN;

-- Group-scoped listen accounting (used by TOEIC Part 1-4 playback limits).
ALTER TABLE IF EXISTS "attempt_listen_events"
  ADD COLUMN IF NOT EXISTS "group_id" UUID;

DO $$
BEGIN
  IF to_regclass('public.attempt_listen_events') IS NOT NULL
     AND to_regclass('public.exercise_groups') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'attempt_listen_events_group_id_fkey'
         AND conrelid = to_regclass('public.attempt_listen_events')
     ) THEN
    ALTER TABLE "attempt_listen_events"
      ADD CONSTRAINT "attempt_listen_events_group_id_fkey"
      FOREIGN KEY ("group_id") REFERENCES "exercise_groups"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.attempt_listen_events') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "attempt_listen_events_attempt_id_group_id_idx" ON "attempt_listen_events"("attempt_id", "group_id")';
  END IF;
END $$;

-- Group-targeted TTS jobs (used when generating one TOEIC stimulus at a time).
ALTER TABLE IF EXISTS "tts_jobs"
  ADD COLUMN IF NOT EXISTS "group_id" UUID;

DO $$
BEGIN
  IF to_regclass('public.tts_jobs') IS NOT NULL
     AND to_regclass('public.exercise_groups') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'tts_jobs_group_id_fkey'
         AND conrelid = to_regclass('public.tts_jobs')
     ) THEN
    ALTER TABLE "tts_jobs"
      ADD CONSTRAINT "tts_jobs_group_id_fkey"
      FOREIGN KEY ("group_id") REFERENCES "exercise_groups"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.tts_jobs') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "tts_jobs_group_id_status_idx" ON "tts_jobs"("group_id", "status")';
  END IF;
END $$;

COMMIT;
