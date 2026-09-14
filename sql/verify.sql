-- Fail-fast schema verification for the current API contract.
-- This runs after compat.sql on every Compose startup so schema drift is caught
-- before NestJS starts serving requests.

DO $$
DECLARE
  missing text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    missing := array_append(missing, 'table users');
  END IF;
  IF to_regclass('public.listening_exercises') IS NULL THEN
    missing := array_append(missing, 'table listening_exercises');
  END IF;
  IF to_regclass('public.exercise_groups') IS NULL THEN
    missing := array_append(missing, 'table exercise_groups');
  END IF;
  IF to_regclass('public.attempt_listen_events') IS NULL THEN
    missing := array_append(missing, 'table attempt_listen_events');
  END IF;
  IF to_regclass('public.tts_jobs') IS NULL THEN
    missing := array_append(missing, 'table tts_jobs');
  END IF;

  IF to_regclass('public.attempt_listen_events') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'attempt_listen_events'
         AND column_name = 'group_id'
         AND udt_name = 'uuid'
     ) THEN
    missing := array_append(missing, 'attempt_listen_events.group_id uuid');
  END IF;

  IF to_regclass('public.tts_jobs') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'tts_jobs'
         AND column_name = 'group_id'
         AND udt_name = 'uuid'
     ) THEN
    missing := array_append(missing, 'tts_jobs.group_id uuid');
  END IF;

  IF to_regclass('public.tts_settings') IS NULL THEN
    missing := array_append(missing, 'table tts_settings');
  END IF;

  IF to_regclass('public.attempt_listen_events') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'attempt_listen_events_group_id_fkey'
         AND conrelid = to_regclass('public.attempt_listen_events')
     ) THEN
    missing := array_append(missing, 'foreign key attempt_listen_events_group_id_fkey');
  END IF;

  IF to_regclass('public.tts_jobs') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'tts_jobs_group_id_fkey'
         AND conrelid = to_regclass('public.tts_jobs')
     ) THEN
    missing := array_append(missing, 'foreign key tts_jobs_group_id_fkey');
  END IF;

  IF cardinality(missing) > 0 THEN
    RAISE EXCEPTION 'ListenUp database schema is not compatible with this build. Missing: %', array_to_string(missing, ', ');
  END IF;
END $$;
