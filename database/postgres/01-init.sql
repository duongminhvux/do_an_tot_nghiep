-- VocaLearn PostgreSQL / FULL FRESH INSTALL ONLY
-- Generated from database/postgres/schema-spec.json.
-- Run with psql; \connect and \gexec are psql meta-commands.
-- No migrations. Editing this file will NOT change an existing data volume.
-- REVIEW: This is schema foundation; legacy backend persistence code must be rewritten.
\set ON_ERROR_STOP on

-- One account/role per service; password values come from init shell environment.
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'vl_identity', :'identity_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vl_identity') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', 'identity_db', 'vl_identity')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'identity_db') \gexec

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'vl_content', :'content_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vl_content') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', 'content_db', 'vl_content')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'content_db') \gexec

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'vl_assessment', :'assessment_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vl_assessment') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', 'assessment_db', 'vl_assessment')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'assessment_db') \gexec

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'vl_arena', :'arena_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vl_arena') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', 'arena_db', 'vl_arena')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'arena_db') \gexec

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'vl_learning', :'learning_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vl_learning') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', 'learning_db', 'vl_learning')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'learning_db') \gexec

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'vl_media', :'media_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vl_media') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', 'media_db', 'vl_media')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'media_db') \gexec

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'vl_ai_import', :'ai_import_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vl_ai_import') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', 'ai_import_db', 'vl_ai_import')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'ai_import_db') \gexec

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'vl_notification', :'notification_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vl_notification') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', 'notification_db', 'vl_notification')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'notification_db') \gexec


-- ===== identity_db: owned by vl_identity =====
\connect identity_db
REVOKE ALL ON DATABASE "identity_db" FROM PUBLIC;
GRANT CONNECT ON DATABASE "identity_db" TO "vl_identity";
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO "vl_identity";
SET ROLE "vl_identity";
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- admins: identity owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."admins" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "avatar_url" TEXT,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "deleted_at" TIMESTAMPTZ,
  "password_hash" TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_admins_updated_at ON public."admins";
CREATE TRIGGER trg_admins_updated_at BEFORE UPDATE ON public."admins"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE UNIQUE INDEX IF NOT EXISTS "idx_admins_1" ON public."admins" ("email");

-- users: identity owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."users" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "username" TEXT,
  "avatar_url" TEXT,
  "auth_provider" TEXT,
  "gg_id" TEXT,
  "is_verified" BOOLEAN,
  "code" TEXT,
  "code_expires_at" TIMESTAMPTZ,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "deleted_at" TIMESTAMPTZ,
  "is_banned" BOOLEAN,
  "phone" TEXT,
  "last_active" TIMESTAMPTZ,
  "notes" TEXT,
  "profile_updated_at" TIMESTAMPTZ,
  "password_hash" TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_users_updated_at ON public."users";
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public."users"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_1" ON public."users" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_2" ON public."users" ("gg_id") WHERE "gg_id" IS NOT NULL;

-- Transactional outbox: insert in the SAME transaction as business writes.
CREATE TABLE IF NOT EXISTS public.outbox_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID,
  payload JSONB NOT NULL,
  published_at TIMESTAMPTZ,
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON public.outbox_events (created_at) WHERE published_at IS NULL;

-- Idempotent consumer records to tolerate RabbitMQ at-least-once delivery.
CREATE TABLE IF NOT EXISTS public.inbox_events (
  consumer_name TEXT NOT NULL,
  event_id UUID NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_name, event_id)
);
RESET ROLE;

-- ===== content_db: owned by vl_content =====
\connect content_db
REVOKE ALL ON DATABASE "content_db" FROM PUBLIC;
GRANT CONNECT ON DATABASE "content_db" TO "vl_content";
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO "vl_content";
SET ROLE "vl_content";
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- collections: content owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."collections" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" UUID,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "cover_url" TEXT,
  "order" DOUBLE PRECISION,
  "is_active" BOOLEAN,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_collections_updated_at ON public."collections";
CREATE TRIGGER trg_collections_updated_at BEFORE UPDATE ON public."collections"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_collections_1" ON public."collections" ("group_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_collections_2" ON public."collections" ("name") WHERE "is_deleted" IS FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_collections_3" ON public."collections" ("slug") WHERE "is_deleted" IS FALSE;

-- dictationlessons: content owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."dictationlessons" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "level" JSONB,
  "topic" TEXT,
  "topic_id" UUID,
  "section_id" UUID,
  "order" DOUBLE PRECISION,
  "thumbnail_url" TEXT,
  "audio_source" JSONB,
  "source_text" TEXT,
  "language" TEXT,
  "voice_ids" TEXT,
  "speed" DOUBLE PRECISION,
  "pause_after_ms" DOUBLE PRECISION,
  "status" TEXT,
  "sentence_count" DOUBLE PRECISION,
  "total_duration_ms" DOUBLE PRECISION,
  "full_audio_url" TEXT,
  "full_audio_storage_key" TEXT,
  "full_audio_public_id" TEXT,
  "processing_error" TEXT,
  "audio_processor" TEXT,
  "audio_processor_device" TEXT,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "published_at" TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_dictationlessons_updated_at ON public."dictationlessons";
CREATE TRIGGER trg_dictationlessons_updated_at BEFORE UPDATE ON public."dictationlessons"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_dictationlessons_1" ON public."dictationlessons" USING GIN ("level");
CREATE INDEX IF NOT EXISTS "idx_dictationlessons_2" ON public."dictationlessons" ("topic");
CREATE INDEX IF NOT EXISTS "idx_dictationlessons_3" ON public."dictationlessons" ("topic_id");
CREATE INDEX IF NOT EXISTS "idx_dictationlessons_4" ON public."dictationlessons" ("section_id");
CREATE INDEX IF NOT EXISTS "idx_dictationlessons_5" ON public."dictationlessons" ("order");
CREATE INDEX IF NOT EXISTS "idx_dictationlessons_6" ON public."dictationlessons" USING GIN ("audio_source");
CREATE INDEX IF NOT EXISTS "idx_dictationlessons_7" ON public."dictationlessons" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_dictationlessons_8" ON public."dictationlessons" ("slug") WHERE "is_deleted" IS FALSE;

-- dictationprogresses: content owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."dictationprogresses" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "segment_index" DOUBLE PRECISION,
  "attempts" DOUBLE PRECISION,
  "wrong_attempts" DOUBLE PRECISION,
  "replay_count" DOUBLE PRECISION,
  "correct" BOOLEAN,
  "first_try_correct" BOOLEAN,
  "revealed" BOOLEAN,
  "completed_at" TIMESTAMPTZ,
  "user_id" UUID NOT NULL,
  "lesson_id" UUID NOT NULL,
  "current_segment" DOUBLE PRECISION,
  "completed_segments" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "revealed_segments" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "segment_progress" JSONB,
  "correct_count" DOUBLE PRECISION,
  "wrong_count" DOUBLE PRECISION,
  "transcript_revealed" BOOLEAN,
  "transcript_revealed_at" TIMESTAMPTZ,
  "completed" BOOLEAN,
  "last_practiced_at" TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_dictationprogresses_updated_at ON public."dictationprogresses";
CREATE TRIGGER trg_dictationprogresses_updated_at BEFORE UPDATE ON public."dictationprogresses"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_dictationprogresses_1" ON public."dictationprogresses" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_dictationprogresses_2" ON public."dictationprogresses" ("lesson_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_dictationprogresses_3" ON public."dictationprogresses" ("user_id", "lesson_id");

-- dictationsections: content owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."dictationsections" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "topic_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "order" DOUBLE PRECISION,
  "is_active" BOOLEAN,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_dictationsections_updated_at ON public."dictationsections";
CREATE TRIGGER trg_dictationsections_updated_at BEFORE UPDATE ON public."dictationsections"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_dictationsections_1" ON public."dictationsections" ("topic_id");
CREATE INDEX IF NOT EXISTS "idx_dictationsections_2" ON public."dictationsections" ("order");
CREATE INDEX IF NOT EXISTS "idx_dictationsections_3" ON public."dictationsections" ("is_active");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_dictationsections_4" ON public."dictationsections" ("topic_id", "slug") WHERE "is_deleted" IS FALSE;
CREATE INDEX IF NOT EXISTS "idx_dictationsections_5" ON public."dictationsections" ("topic_id", "order");

-- dictationsegments: content owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."dictationsegments" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "word" TEXT, -- Legacy embedded timing field; canonical data is in words JSONB.
  "start_ms" DOUBLE PRECISION NOT NULL,
  "end_ms" DOUBLE PRECISION NOT NULL,
  "probability" DOUBLE PRECISION,
  "lesson_id" UUID NOT NULL,
  "order" DOUBLE PRECISION NOT NULL,
  "text" TEXT NOT NULL,
  "normalized_text" TEXT,
  "source" TEXT NOT NULL,
  "speaker" TEXT,
  "voice_id" TEXT,
  "language" TEXT NOT NULL,
  "speed" DOUBLE PRECISION,
  "duration_ms" DOUBLE PRECISION NOT NULL,
  "confidence" DOUBLE PRECISION,
  "words" JSONB,
  "audio_url" TEXT,
  "audio_public_id" TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_dictationsegments_updated_at ON public."dictationsegments";
CREATE TRIGGER trg_dictationsegments_updated_at BEFORE UPDATE ON public."dictationsegments"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_dictationsegments_1" ON public."dictationsegments" ("lesson_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_dictationsegments_2" ON public."dictationsegments" ("lesson_id", "order");

-- dictationtopics: content owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."dictationtopics" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "thumbnail_url" TEXT,
  "thumbnail_public_id" TEXT,
  "order" DOUBLE PRECISION,
  "is_active" BOOLEAN,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_dictationtopics_updated_at ON public."dictationtopics";
CREATE TRIGGER trg_dictationtopics_updated_at BEFORE UPDATE ON public."dictationtopics"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_dictationtopics_1" ON public."dictationtopics" ("order");
CREATE INDEX IF NOT EXISTS "idx_dictationtopics_2" ON public."dictationtopics" ("is_active");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_dictationtopics_3" ON public."dictationtopics" ("slug") WHERE "is_deleted" IS FALSE;

-- lessons: content owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."lessons" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "collection_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "cover_url" TEXT,
  "order" DOUBLE PRECISION,
  "is_active" BOOLEAN,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_lessons_updated_at ON public."lessons";
CREATE TRIGGER trg_lessons_updated_at BEFORE UPDATE ON public."lessons"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_lessons_1" ON public."lessons" ("collection_id");
CREATE INDEX IF NOT EXISTS "idx_lessons_2" ON public."lessons" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_lessons_3" ON public."lessons" ("collection_id", "slug");

-- lessonwords: content owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."lessonwords" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "lesson_id" UUID NOT NULL,
  "word_id" UUID NOT NULL,
  "section_id" UUID,
  "order" DOUBLE PRECISION,
  "custom_note" TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_lessonwords_updated_at ON public."lessonwords";
CREATE TRIGGER trg_lessonwords_updated_at BEFORE UPDATE ON public."lessonwords"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_lessonwords_1" ON public."lessonwords" ("lesson_id");
CREATE INDEX IF NOT EXISTS "idx_lessonwords_2" ON public."lessonwords" ("word_id");
CREATE INDEX IF NOT EXISTS "idx_lessonwords_3" ON public."lessonwords" ("section_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_lessonwords_4" ON public."lessonwords" ("lesson_id", "word_id");
CREATE INDEX IF NOT EXISTS "idx_lessonwords_5" ON public."lessonwords" ("lesson_id", "section_id", "order");

-- sections: content owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."sections" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "lesson_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "order" DOUBLE PRECISION,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_sections_updated_at ON public."sections";
CREATE TRIGGER trg_sections_updated_at BEFORE UPDATE ON public."sections"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_sections_1" ON public."sections" ("lesson_id");
CREATE INDEX IF NOT EXISTS "idx_sections_2" ON public."sections" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_sections_3" ON public."sections" ("lesson_id", "slug");
CREATE INDEX IF NOT EXISTS "idx_sections_4" ON public."sections" ("lesson_id", "order");

-- vocabularygroups: content owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."vocabularygroups" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "order" DOUBLE PRECISION,
  "is_active" BOOLEAN,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_vocabularygroups_updated_at ON public."vocabularygroups";
CREATE TRIGGER trg_vocabularygroups_updated_at BEFORE UPDATE ON public."vocabularygroups"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE UNIQUE INDEX IF NOT EXISTS "idx_vocabularygroups_1" ON public."vocabularygroups" ("name") WHERE "is_deleted" IS FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_vocabularygroups_2" ON public."vocabularygroups" ("slug") WHERE "is_deleted" IS FALSE;

-- words: content owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."words" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "us" JSONB,
  "uk" JSONB,
  "en" TEXT,
  "vi" TEXT,
  "definition" TEXT,
  "translation" TEXT,
  "synonyms" TEXT,
  "antonyms" TEXT,
  "examples" JSONB,
  "part_of_speech" TEXT, -- Legacy embedded part field; canonical data is in parts JSONB.
  "meanings" JSONB,
  "word" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "ipa" JSONB,
  "audio" JSONB,
  "audio_meta" JSONB,
  "image" TEXT,
  "variations" TEXT,
  "related_words" TEXT,
  "parts" JSONB,
  "is_active" BOOLEAN,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_words_updated_at ON public."words";
CREATE TRIGGER trg_words_updated_at BEFORE UPDATE ON public."words"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE UNIQUE INDEX IF NOT EXISTS "idx_words_1" ON public."words" ("word");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_words_2" ON public."words" ("slug");
CREATE INDEX IF NOT EXISTS "idx_words_3" ON public."words" ("level");
CREATE INDEX IF NOT EXISTS "idx_words_4" ON public."words" ("is_deleted");

-- youtubelessons: content owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."youtubelessons" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_youtubelessons_updated_at ON public."youtubelessons";
CREATE TRIGGER trg_youtubelessons_updated_at BEFORE UPDATE ON public."youtubelessons"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Transactional outbox: insert in the SAME transaction as business writes.
CREATE TABLE IF NOT EXISTS public.outbox_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID,
  payload JSONB NOT NULL,
  published_at TIMESTAMPTZ,
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON public.outbox_events (created_at) WHERE published_at IS NULL;

-- Idempotent consumer records to tolerate RabbitMQ at-least-once delivery.
CREATE TABLE IF NOT EXISTS public.inbox_events (
  consumer_name TEXT NOT NULL,
  event_id UUID NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_name, event_id)
);
RESET ROLE;

-- ===== assessment_db: owned by vl_assessment =====
\connect assessment_db
REVOKE ALL ON DATABASE "assessment_db" FROM PUBLIC;
GRANT CONNECT ON DATABASE "assessment_db" TO "vl_assessment";
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO "vl_assessment";
SET ROLE "vl_assessment";
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- attemptanswers: assessment owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."attemptanswers" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "attempt_id" UUID NOT NULL,
  "question_id" UUID NOT NULL,
  "selected_answer" TEXT,
  "is_correct" BOOLEAN,
  "answered_at" TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_attemptanswers_updated_at ON public."attemptanswers";
CREATE TRIGGER trg_attemptanswers_updated_at BEFORE UPDATE ON public."attemptanswers"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_attemptanswers_1" ON public."attemptanswers" ("attempt_id");
CREATE INDEX IF NOT EXISTS "idx_attemptanswers_2" ON public."attemptanswers" ("question_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_attemptanswers_3" ON public."attemptanswers" ("attempt_id", "question_id");

-- attempts: assessment owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."attempts" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "exam_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "started_at" TIMESTAMPTZ NOT NULL,
  "completed_at" TIMESTAMPTZ,
  "total_questions" DOUBLE PRECISION,
  "answered_questions" DOUBLE PRECISION,
  "correct_answers" DOUBLE PRECISION,
  "score" DOUBLE PRECISION,
  "question_snapshot" JSONB,
  "answers" JSONB DEFAULT '{}'::jsonb,
  "selected_parts" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "submitted_at" TIMESTAMPTZ,
  "total_correct" INTEGER,
  "accuracy" DOUBLE PRECISION,
  "duration_spent" INTEGER,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_attempts_updated_at ON public."attempts";
CREATE TRIGGER trg_attempts_updated_at BEFORE UPDATE ON public."attempts"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_attempts_1" ON public."attempts" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_attempts_2" ON public."attempts" ("exam_id");

-- examgroups: assessment owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."examgroups" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "order" DOUBLE PRECISION,
  "is_active" BOOLEAN,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_examgroups_updated_at ON public."examgroups";
CREATE TRIGGER trg_examgroups_updated_at BEFORE UPDATE ON public."examgroups"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE UNIQUE INDEX IF NOT EXISTS "idx_examgroups_1" ON public."examgroups" ("name") WHERE "is_deleted" IS FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_examgroups_2" ON public."examgroups" ("slug") WHERE "is_deleted" IS FALSE;
CREATE INDEX IF NOT EXISTS "idx_examgroups_3" ON public."examgroups" ("order");
CREATE INDEX IF NOT EXISTS "idx_examgroups_4" ON public."examgroups" ("is_active", "order");

-- exams: assessment owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."exams" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "total_questions" DOUBLE PRECISION,
  "description" TEXT,
  "duration_minutes" DOUBLE PRECISION,
  "is_active" BOOLEAN,
  "order" DOUBLE PRECISION,
  "group_id" UUID,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_exams_updated_at ON public."exams";
CREATE TRIGGER trg_exams_updated_at BEFORE UPDATE ON public."exams"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE UNIQUE INDEX IF NOT EXISTS "idx_exams_1" ON public."exams" ("name") WHERE "is_deleted" IS FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_exams_2" ON public."exams" ("slug") WHERE "is_deleted" IS FALSE;
CREATE INDEX IF NOT EXISTS "idx_exams_3" ON public."exams" ("group_id");

-- passagegroups: assessment owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."passagegroups" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "exam_id" UUID NOT NULL,
  "section" TEXT NOT NULL,
  "part" DOUBLE PRECISION NOT NULL,
  "title" TEXT,
  "order" DOUBLE PRECISION,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_passagegroups_updated_at ON public."passagegroups";
CREATE TRIGGER trg_passagegroups_updated_at BEFORE UPDATE ON public."passagegroups"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_passagegroups_1" ON public."passagegroups" ("exam_id");

-- passages: assessment owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."passages" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "passage_group_id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "content" TEXT,
  "audio_url" TEXT,
  "audio_meta" JSONB,
  "image_url" TEXT,
  "order" DOUBLE PRECISION,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_passages_updated_at ON public."passages";
CREATE TRIGGER trg_passages_updated_at BEFORE UPDATE ON public."passages"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_passages_1" ON public."passages" ("passage_group_id");

-- questions: assessment owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."questions" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "exam_id" UUID NOT NULL,
  "passage_group_id" UUID,
  "section" TEXT NOT NULL,
  "part" DOUBLE PRECISION NOT NULL,
  "content" TEXT,
  "options" JSONB NOT NULL,
  "correct_answer" TEXT NOT NULL,
  "explanation" TEXT,
  "image_url" TEXT,
  "audio_url" TEXT,
  "audio_meta" JSONB,
  "import_batch_id" TEXT,
  "import_index" DOUBLE PRECISION,
  "import_fingerprint" TEXT,
  "source_order" DOUBLE PRECISION,
  "order" DOUBLE PRECISION,
  "is_active" BOOLEAN,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_questions_updated_at ON public."questions";
CREATE TRIGGER trg_questions_updated_at BEFORE UPDATE ON public."questions"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_questions_1" ON public."questions" ("exam_id");
CREATE INDEX IF NOT EXISTS "idx_questions_2" ON public."questions" ("passage_group_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_questions_3" ON public."questions" ("exam_id", "import_batch_id", "import_index") WHERE "import_batch_id" IS NOT NULL;

-- V8.4: Assessment owns delivery of PDF-AI correction events.
-- Safe to run again; existing rows in assessment_db are retained.
CREATE TABLE IF NOT EXISTS public.pdf_ai_correction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE,
  state TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactional outbox: insert in the SAME transaction as business writes.
CREATE TABLE IF NOT EXISTS public.outbox_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID,
  payload JSONB NOT NULL,
  published_at TIMESTAMPTZ,
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON public.outbox_events (created_at) WHERE published_at IS NULL;

-- Idempotent consumer records to tolerate RabbitMQ at-least-once delivery.
CREATE TABLE IF NOT EXISTS public.inbox_events (
  consumer_name TEXT NOT NULL,
  event_id UUID NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_name, event_id)
);
RESET ROLE;

-- ===== arena_db: owned by vl_arena =====
\connect arena_db
REVOKE ALL ON DATABASE "arena_db" FROM PUBLIC;
GRANT CONNECT ON DATABASE "arena_db" TO "vl_arena";
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO "vl_arena";
SET ROLE "vl_arena";
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- arenainvitations: arena owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."arenainvitations" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "mode" TEXT,
  "rematch_of" UUID,
  "sender_id" UUID NOT NULL,
  "receiver_id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "room_id" UUID,
  "status" TEXT,
  "expires_at" TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_arenainvitations_updated_at ON public."arenainvitations";
CREATE TRIGGER trg_arenainvitations_updated_at BEFORE UPDATE ON public."arenainvitations"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_arenainvitations_1" ON public."arenainvitations" ("sender_id");
CREATE INDEX IF NOT EXISTS "idx_arenainvitations_2" ON public."arenainvitations" ("receiver_id");
CREATE INDEX IF NOT EXISTS "idx_arenainvitations_3" ON public."arenainvitations" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_arenainvitations_4" ON public."arenainvitations" ("sender_id", "type") WHERE "status" = 'PENDING' AND "type" = 'DUEL';
CREATE INDEX IF NOT EXISTS "idx_arenainvitations_5" ON public."arenainvitations" ("expires_at") WHERE "status" = 'EXPIRED';

-- arenamatches: arena owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."arenamatches" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "runtime_policy" JSONB,
  "friend_mode" TEXT,
  "next_match_id" UUID,
  "lobby_starting" BOOLEAN,
  "host_id" UUID,
  "current_turn_user_id" UUID,
  "current_word" TEXT,
  "required_letter" TEXT,
  "turn_started_at" TIMESTAMPTZ,
  "turn_deadline" TIMESTAMPTZ,
  "chain_paused_at" TIMESTAMPTZ,
  "used_words" TEXT,
  "word_guess_answer" TEXT,
  "word_guess_attempts" JSONB,
  "word_guess_revision" DOUBLE PRECISION,
  "word_guess_solved_by" TEXT,
  "turn_count" DOUBLE PRECISION,
  "type" TEXT NOT NULL,
  "room_id" UUID,
  "status" TEXT,
  "question_mode" JSONB,
  "question_count" DOUBLE PRECISION,
  "eliminated_user_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "room_revision" DOUBLE PRECISION,
  "current_question_index" DOUBLE PRECISION,
  "seconds_per_question" DOUBLE PRECISION,
  "started_at" TIMESTAMPTZ,
  "finished_at" TIMESTAMPTZ,
  "winner_id" UUID,
  "is_draw" BOOLEAN,
  "cancel_reason" TEXT,
  "finish_reason" JSONB,
  "room_code_snapshot" TEXT,
  "settings_snapshot" JSONB,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_arenamatches_updated_at ON public."arenamatches";
CREATE TRIGGER trg_arenamatches_updated_at BEFORE UPDATE ON public."arenamatches"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_arenamatches_1" ON public."arenamatches" ("type");
CREATE INDEX IF NOT EXISTS "idx_arenamatches_2" ON public."arenamatches" ("room_id");
CREATE INDEX IF NOT EXISTS "idx_arenamatches_3" ON public."arenamatches" ("status");
CREATE INDEX IF NOT EXISTS "idx_arenamatches_4" ON public."arenamatches" ("winner_id");
CREATE INDEX IF NOT EXISTS "idx_arenamatches_5" ON public."arenamatches" ("status", "type", "finished_at");

-- arenamatchplayers: arena owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."arenamatchplayers" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ready_mode" JSONB,
  "match_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "returned_to_lobby" BOOLEAN,
  "left_lobby" BOOLEAN,
  "score" DOUBLE PRECISION,
  "correct_answers" DOUBLE PRECISION,
  "wrong_answers" DOUBLE PRECISION,
  "unanswered" DOUBLE PRECISION,
  "longest_streak" DOUBLE PRECISION,
  "current_streak" DOUBLE PRECISION,
  "total_response_time_ms" DOUBLE PRECISION,
  "scored_question_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "rating_before" DOUBLE PRECISION,
  "rating_after" DOUBLE PRECISION,
  "rating_change" DOUBLE PRECISION,
  "is_ready" BOOLEAN,
  "ready_at" TIMESTAMPTZ,
  "disconnected_at" TIMESTAMPTZ,
  "status" TEXT,
  "finished_at" TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_arenamatchplayers_updated_at ON public."arenamatchplayers";
CREATE TRIGGER trg_arenamatchplayers_updated_at BEFORE UPDATE ON public."arenamatchplayers"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_arenamatchplayers_1" ON public."arenamatchplayers" ("match_id");
CREATE INDEX IF NOT EXISTS "idx_arenamatchplayers_2" ON public."arenamatchplayers" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_arenamatchplayers_3" ON public."arenamatchplayers" ("match_id", "user_id");

-- arenamatchquestions: arena owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."arenamatchquestions" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" TEXT,
  "text" TEXT,
  "match_id" UUID NOT NULL,
  "vocabulary_id" UUID,
  "order" DOUBLE PRECISION NOT NULL,
  "type" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "audio_url" TEXT,
  "image_url" TEXT,
  "options" JSONB,
  "correct_answer" TEXT NOT NULL,
  "explanation" TEXT,
  "example" TEXT,
  "translation" TEXT,
  "word_type" TEXT,
  "started_at" TIMESTAMPTZ,
  "resolved_at" TIMESTAMPTZ,
  "winner_id" UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_arenamatchquestions_updated_at ON public."arenamatchquestions";
CREATE TRIGGER trg_arenamatchquestions_updated_at BEFORE UPDATE ON public."arenamatchquestions"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_arenamatchquestions_1" ON public."arenamatchquestions" ("match_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_arenamatchquestions_2" ON public."arenamatchquestions" ("match_id", "order");

-- arenaplayeranswers: arena owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."arenaplayeranswers" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "match_id" UUID NOT NULL,
  "match_question_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "selected_answer" TEXT,
  "attempts" DOUBLE PRECISION,
  "is_correct" BOOLEAN,
  "timed_out" BOOLEAN,
  "response_time_ms" DOUBLE PRECISION,
  "earned_score" DOUBLE PRECISION,
  "streak_at_answer" DOUBLE PRECISION,
  "answered_at" TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_arenaplayeranswers_updated_at ON public."arenaplayeranswers";
CREATE TRIGGER trg_arenaplayeranswers_updated_at BEFORE UPDATE ON public."arenaplayeranswers"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_arenaplayeranswers_1" ON public."arenaplayeranswers" ("match_id");
CREATE INDEX IF NOT EXISTS "idx_arenaplayeranswers_2" ON public."arenaplayeranswers" ("match_question_id");
CREATE INDEX IF NOT EXISTS "idx_arenaplayeranswers_3" ON public."arenaplayeranswers" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_arenaplayeranswers_4" ON public."arenaplayeranswers" ("match_id", "match_question_id", "user_id");

-- arenaprofiles: arena owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."arenaprofiles" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "rating" DOUBLE PRECISION,
  "ranked_matches" DOUBLE PRECISION,
  "ranked_wins" DOUBLE PRECISION,
  "ranked_losses" DOUBLE PRECISION,
  "ranked_draws" DOUBLE PRECISION,
  "current_win_streak" DOUBLE PRECISION,
  "best_win_streak" DOUBLE PRECISION,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_arenaprofiles_updated_at ON public."arenaprofiles";
CREATE TRIGGER trg_arenaprofiles_updated_at BEFORE UPDATE ON public."arenaprofiles"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE UNIQUE INDEX IF NOT EXISTS "idx_arenaprofiles_1" ON public."arenaprofiles" ("user_id");

-- arenaratinghistories: arena owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."arenaratinghistories" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "match_id" UUID NOT NULL,
  "before" DOUBLE PRECISION NOT NULL,
  "after" DOUBLE PRECISION NOT NULL,
  "change" DOUBLE PRECISION NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_arenaratinghistories_updated_at ON public."arenaratinghistories";
CREATE TRIGGER trg_arenaratinghistories_updated_at BEFORE UPDATE ON public."arenaratinghistories"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_arenaratinghistories_1" ON public."arenaratinghistories" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_arenaratinghistories_2" ON public."arenaratinghistories" ("match_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_arenaratinghistories_3" ON public."arenaratinghistories" ("match_id", "user_id");

-- arenarooms: arena owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."arenarooms" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "role" TEXT,
  "is_ready" BOOLEAN,
  "joined_at" TIMESTAMPTZ,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "owner_id" UUID NOT NULL,
  "status" TEXT,
  "visibility" TEXT,
  "question_mode" TEXT,
  "question_count" DOUBLE PRECISION,
  "seconds_per_question" DOUBLE PRECISION,
  "max_players" DOUBLE PRECISION,
  "vocabulary_source" TEXT,
  "collection_id" UUID,
  "members" JSONB,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_arenarooms_updated_at ON public."arenarooms";
CREATE TRIGGER trg_arenarooms_updated_at BEFORE UPDATE ON public."arenarooms"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE UNIQUE INDEX IF NOT EXISTS "idx_arenarooms_1" ON public."arenarooms" ("code");
CREATE INDEX IF NOT EXISTS "idx_arenarooms_2" ON public."arenarooms" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_arenarooms_3" ON public."arenarooms" ("status");

-- arenasettings: arena owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."arenasettings" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL,
  "revision" DOUBLE PRECISION,
  "config" JSONB,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_arenasettings_updated_at ON public."arenasettings";
CREATE TRIGGER trg_arenasettings_updated_at BEFORE UPDATE ON public."arenasettings"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE UNIQUE INDEX IF NOT EXISTS "idx_arenasettings_1" ON public."arenasettings" ("key");

-- friendrooms: arena owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."friendrooms" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "is_ready" BOOLEAN,
  "disconnected_at" TIMESTAMPTZ,
  "runtime_policy" DOUBLE PRECISION,
  "code" TEXT NOT NULL,
  "host_id" UUID NOT NULL,
  "guest_id" UUID,
  "mode" TEXT NOT NULL,
  "status" TEXT,
  "max_players" DOUBLE PRECISION,
  "members" JSONB,
  "guest_ready" BOOLEAN,
  "settings" JSONB NOT NULL,
  "current_match_id" UUID,
  "match_count" DOUBLE PRECISION,
  "revision" DOUBLE PRECISION,
  "host_disconnected_at" TIMESTAMPTZ,
  "guest_disconnected_at" TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_friendrooms_updated_at ON public."friendrooms";
CREATE TRIGGER trg_friendrooms_updated_at BEFORE UPDATE ON public."friendrooms"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE UNIQUE INDEX IF NOT EXISTS "idx_friendrooms_1" ON public."friendrooms" ("code");
CREATE INDEX IF NOT EXISTS "idx_friendrooms_2" ON public."friendrooms" ("host_id");
CREATE INDEX IF NOT EXISTS "idx_friendrooms_3" ON public."friendrooms" ("guest_id");

-- Transactional outbox: insert in the SAME transaction as business writes.
CREATE TABLE IF NOT EXISTS public.outbox_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID,
  payload JSONB NOT NULL,
  published_at TIMESTAMPTZ,
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON public.outbox_events (created_at) WHERE published_at IS NULL;

-- Idempotent consumer records to tolerate RabbitMQ at-least-once delivery.
CREATE TABLE IF NOT EXISTS public.inbox_events (
  consumer_name TEXT NOT NULL,
  event_id UUID NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_name, event_id)
);
RESET ROLE;

-- ===== learning_db: owned by vl_learning =====
\connect learning_db
REVOKE ALL ON DATABASE "learning_db" FROM PUBLIC;
GRANT CONNECT ON DATABASE "learning_db" TO "vl_learning";
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO "vl_learning";
SET ROLE "vl_learning";
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- gamedefinitions: learning owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."gamedefinitions" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "settings" JSONB,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "name_en" TEXT,
  "description" TEXT,
  "description_en" TEXT,
  "image_url" TEXT,
  "badge" JSONB,
  "destination" TEXT NOT NULL,
  "category" JSONB,
  "order" DOUBLE PRECISION,
  "is_active" BOOLEAN,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_gamedefinitions_updated_at ON public."gamedefinitions";
CREATE TRIGGER trg_gamedefinitions_updated_at BEFORE UPDATE ON public."gamedefinitions"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE UNIQUE INDEX IF NOT EXISTS "idx_gamedefinitions_1" ON public."gamedefinitions" ("code");
CREATE INDEX IF NOT EXISTS "idx_gamedefinitions_2" ON public."gamedefinitions" ("is_active", "order", "id");

-- learningsessions: learning owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."learningsessions" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "lesson_id" UUID,
  "started_at" TIMESTAMPTZ NOT NULL,
  "ended_at" TIMESTAMPTZ,
  "duration_seconds" DOUBLE PRECISION,
  "total_words" DOUBLE PRECISION,
  "completed_words" DOUBLE PRECISION,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_learningsessions_updated_at ON public."learningsessions";
CREATE TRIGGER trg_learningsessions_updated_at BEFORE UPDATE ON public."learningsessions"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_learningsessions_1" ON public."learningsessions" ("user_id");

-- learningsessionwords: learning owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."learningsessionwords" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL,
  "word_id" UUID NOT NULL,
  "lesson_word_id" UUID,
  "mode" TEXT NOT NULL,
  "rating" TEXT,
  "is_correct" BOOLEAN,
  "answered_at" TIMESTAMPTZ NOT NULL,
  "scheduled_at" TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_learningsessionwords_updated_at ON public."learningsessionwords";
CREATE TRIGGER trg_learningsessionwords_updated_at BEFORE UPDATE ON public."learningsessionwords"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_learningsessionwords_1" ON public."learningsessionwords" ("session_id");
CREATE INDEX IF NOT EXISTS "idx_learningsessionwords_2" ON public."learningsessionwords" ("word_id");

-- minigameresults: learning owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."minigameresults" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "game_type" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_minigameresults_updated_at ON public."minigameresults";
CREATE TRIGGER trg_minigameresults_updated_at BEFORE UPDATE ON public."minigameresults"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_minigameresults_1" ON public."minigameresults" ("user_id", "game_type", "score");
CREATE INDEX IF NOT EXISTS "idx_minigameresults_2" ON public."minigameresults" ("user_id", "game_type", "created_at");

-- userdailyactivities: learning owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."userdailyactivities" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "date" TIMESTAMPTZ NOT NULL,
  "study_minutes" DOUBLE PRECISION,
  "words_learned" DOUBLE PRECISION,
  "words_reviewed" DOUBLE PRECISION,
  "session_count" DOUBLE PRECISION,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_userdailyactivities_updated_at ON public."userdailyactivities";
CREATE TRIGGER trg_userdailyactivities_updated_at BEFORE UPDATE ON public."userdailyactivities"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_userdailyactivities_1" ON public."userdailyactivities" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_userdailyactivities_2" ON public."userdailyactivities" ("user_id", "date");

-- userlessonprogresses: learning owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."userlessonprogresses" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "lesson_id" UUID NOT NULL,
  "status" TEXT,
  "progress" DOUBLE PRECISION,
  "started_at" TIMESTAMPTZ,
  "last_studied_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_userlessonprogresses_updated_at ON public."userlessonprogresses";
CREATE TRIGGER trg_userlessonprogresses_updated_at BEFORE UPDATE ON public."userlessonprogresses"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_userlessonprogresses_1" ON public."userlessonprogresses" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_userlessonprogresses_2" ON public."userlessonprogresses" ("lesson_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_userlessonprogresses_3" ON public."userlessonprogresses" ("user_id", "lesson_id");

-- userlessonwords: learning owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."userlessonwords" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "lesson_word_id" UUID NOT NULL,
  "learned_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_userlessonwords_updated_at ON public."userlessonwords";
CREATE TRIGGER trg_userlessonwords_updated_at BEFORE UPDATE ON public."userlessonwords"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_userlessonwords_1" ON public."userlessonwords" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_userlessonwords_2" ON public."userlessonwords" ("lesson_word_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_userlessonwords_3" ON public."userlessonwords" ("user_id", "lesson_word_id");

-- usersavedwords: learning owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."usersavedwords" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "word_id" UUID NOT NULL,
  "folder_id" UUID,
  "saved_at" TIMESTAMPTZ,
  "note" TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_usersavedwords_updated_at ON public."usersavedwords";
CREATE TRIGGER trg_usersavedwords_updated_at BEFORE UPDATE ON public."usersavedwords"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_usersavedwords_1" ON public."usersavedwords" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_usersavedwords_2" ON public."usersavedwords" ("word_id");
CREATE INDEX IF NOT EXISTS "idx_usersavedwords_3" ON public."usersavedwords" ("folder_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_usersavedwords_4" ON public."usersavedwords" ("user_id", "word_id");
CREATE INDEX IF NOT EXISTS "idx_usersavedwords_5" ON public."usersavedwords" ("user_id", "saved_at");

-- userwordreviews: learning owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."userwordreviews" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "word_id" UUID NOT NULL,
  "status" TEXT,
  "review_count" DOUBLE PRECISION,
  "correct_count" DOUBLE PRECISION,
  "incorrect_count" DOUBLE PRECISION,
  "interval_days" DOUBLE PRECISION,
  "last_reviewed_at" TIMESTAMPTZ,
  "next_review_at" TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_userwordreviews_updated_at ON public."userwordreviews";
CREATE TRIGGER trg_userwordreviews_updated_at BEFORE UPDATE ON public."userwordreviews"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_userwordreviews_1" ON public."userwordreviews" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_userwordreviews_2" ON public."userwordreviews" ("word_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_userwordreviews_3" ON public."userwordreviews" ("user_id", "word_id");
CREATE INDEX IF NOT EXISTS "idx_userwordreviews_4" ON public."userwordreviews" ("user_id", "next_review_at");

-- vocabularyfolders: learning owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."vocabularyfolders" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT,
  "description" TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_vocabularyfolders_updated_at ON public."vocabularyfolders";
CREATE TRIGGER trg_vocabularyfolders_updated_at BEFORE UPDATE ON public."vocabularyfolders"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_vocabularyfolders_1" ON public."vocabularyfolders" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_vocabularyfolders_2" ON public."vocabularyfolders" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_vocabularyfolders_3" ON public."vocabularyfolders" ("user_id", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_vocabularyfolders_4" ON public."vocabularyfolders" ("user_id", "slug") WHERE "user_id" IS NOT NULL AND "slug" IS NOT NULL;

-- learning_activities: learning owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."learning_activities" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "module" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "source_key" TEXT NOT NULL,
  "xp" INTEGER NOT NULL,
  "occurred_at" TIMESTAMPTZ NOT NULL,
  "title" TEXT,
  "ref_id" TEXT,
  "link" TEXT,
  "correct" INTEGER,
  "total" INTEGER,
  "score" DOUBLE PRECISION,
  "duration_sec" INTEGER,
  "metadata" JSONB DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_learning_activities_updated_at ON public."learning_activities";
CREATE TRIGGER trg_learning_activities_updated_at BEFORE UPDATE ON public."learning_activities"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE UNIQUE INDEX IF NOT EXISTS "idx_learning_activities_1" ON public."learning_activities" ("user_id", "source_key");
CREATE INDEX IF NOT EXISTS "idx_learning_activities_2" ON public."learning_activities" ("user_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "idx_learning_activities_3" ON public."learning_activities" ("user_id", "module", "occurred_at");

-- Transactional outbox: insert in the SAME transaction as business writes.
CREATE TABLE IF NOT EXISTS public.outbox_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID,
  payload JSONB NOT NULL,
  published_at TIMESTAMPTZ,
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON public.outbox_events (created_at) WHERE published_at IS NULL;

-- Idempotent consumer records to tolerate RabbitMQ at-least-once delivery.
CREATE TABLE IF NOT EXISTS public.inbox_events (
  consumer_name TEXT NOT NULL,
  event_id UUID NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_name, event_id)
);
RESET ROLE;

-- ===== media_db: owned by vl_media =====
\connect media_db
REVOKE ALL ON DATABASE "media_db" FROM PUBLIC;
GRANT CONNECT ON DATABASE "media_db" TO "vl_media";
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO "vl_media";
SET ROLE "vl_media";
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- asr_jobs: media owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."asr_jobs" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "owner_id" UUID,
  "job_type" TEXT,
  "attempts" INTEGER DEFAULT 0,
  "error" TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_asr_jobs_updated_at ON public."asr_jobs";
CREATE TRIGGER trg_asr_jobs_updated_at BEFORE UPDATE ON public."asr_jobs"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_asr_jobs_1" ON public."asr_jobs" ("status", "created_at");

-- audio_jobs: media owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."audio_jobs" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "owner_id" UUID,
  "job_type" TEXT,
  "attempts" INTEGER DEFAULT 0,
  "error" TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_audio_jobs_updated_at ON public."audio_jobs";
CREATE TRIGGER trg_audio_jobs_updated_at BEFORE UPDATE ON public."audio_jobs"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_audio_jobs_1" ON public."audio_jobs" ("status", "created_at");

-- media_assets: media owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."media_assets" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_media_assets_updated_at ON public."media_assets";
CREATE TRIGGER trg_media_assets_updated_at BEFORE UPDATE ON public."media_assets"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- system_settings: media owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."system_settings" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_system_settings_updated_at ON public."system_settings";
CREATE TRIGGER trg_system_settings_updated_at BEFORE UPDATE ON public."system_settings"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Transactional outbox: insert in the SAME transaction as business writes.
CREATE TABLE IF NOT EXISTS public.outbox_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID,
  payload JSONB NOT NULL,
  published_at TIMESTAMPTZ,
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON public.outbox_events (created_at) WHERE published_at IS NULL;

-- Idempotent consumer records to tolerate RabbitMQ at-least-once delivery.
CREATE TABLE IF NOT EXISTS public.inbox_events (
  consumer_name TEXT NOT NULL,
  event_id UUID NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_name, event_id)
);
RESET ROLE;

-- ===== ai_import_db: owned by vl_ai_import =====
\connect ai_import_db
REVOKE ALL ON DATABASE "ai_import_db" FROM PUBLIC;
GRANT CONNECT ON DATABASE "ai_import_db" TO "vl_ai_import";
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO "vl_ai_import";
SET ROLE "vl_ai_import";
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- pdf_ai_correction_events: ai_import owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."pdf_ai_correction_events" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "exam_id" UUID,
  "actor_id" UUID,
  "result" JSONB,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_pdf_ai_correction_events_updated_at ON public."pdf_ai_correction_events";
CREATE TRIGGER trg_pdf_ai_correction_events_updated_at BEFORE UPDATE ON public."pdf_ai_correction_events"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Transactional outbox: insert in the SAME transaction as business writes.
CREATE TABLE IF NOT EXISTS public.outbox_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID,
  payload JSONB NOT NULL,
  published_at TIMESTAMPTZ,
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON public.outbox_events (created_at) WHERE published_at IS NULL;

-- Idempotent consumer records to tolerate RabbitMQ at-least-once delivery.
CREATE TABLE IF NOT EXISTS public.inbox_events (
  consumer_name TEXT NOT NULL,
  event_id UUID NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_name, event_id)
);
RESET ROLE;

-- ===== notification_db: owned by vl_notification =====
\connect notification_db
REVOKE ALL ON DATABASE "notification_db" FROM PUBLIC;
GRANT CONNECT ON DATABASE "notification_db" TO "vl_notification";
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO "vl_notification";
SET ROLE "vl_notification";
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- activitylogs: notification owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."activitylogs" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "user_email" TEXT,
  "user_name" TEXT,
  "role" TEXT,
  "action" TEXT NOT NULL,
  "category" JSONB NOT NULL,
  "description" TEXT NOT NULL,
  "metadata" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "status" TEXT,
  "duration_ms" DOUBLE PRECISION,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_activitylogs_updated_at ON public."activitylogs";
CREATE TRIGGER trg_activitylogs_updated_at BEFORE UPDATE ON public."activitylogs"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_activitylogs_1" ON public."activitylogs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_activitylogs_2" ON public."activitylogs" ("user_email");
CREATE INDEX IF NOT EXISTS "idx_activitylogs_3" ON public."activitylogs" ("action");
CREATE INDEX IF NOT EXISTS "idx_activitylogs_4" ON public."activitylogs" USING GIN ("category");
CREATE INDEX IF NOT EXISTS "idx_activitylogs_5" ON public."activitylogs" ("status");
CREATE INDEX IF NOT EXISTS "idx_activitylogs_6" ON public."activitylogs" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_activitylogs_7" ON public."activitylogs" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_activitylogs_8" ON public."activitylogs" (("category"::text), "created_at");
CREATE INDEX IF NOT EXISTS "idx_activitylogs_9" ON public."activitylogs" ("action", "created_at");
CREATE INDEX IF NOT EXISTS "idx_activitylogs_10" ON public."activitylogs" ("user_email", "created_at");
CREATE INDEX IF NOT EXISTS "idx_activitylogs_11" ON public."activitylogs" ("status", "created_at");

-- notifications: Notification-owned messages and read status.
CREATE TABLE IF NOT EXISTS public."notifications" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipient_id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "read_at" TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public."notifications";
CREATE TRIGGER trg_notifications_updated_at BEFORE UPDATE ON public."notifications"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_notifications_1" ON public."notifications" ("recipient_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_notifications_2" ON public."notifications" ("recipient_id", "is_read");

-- Transactional outbox: insert in the SAME transaction as business writes.
CREATE TABLE IF NOT EXISTS public.outbox_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID,
  payload JSONB NOT NULL,
  published_at TIMESTAMPTZ,
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON public.outbox_events (created_at) WHERE published_at IS NULL;

-- Idempotent consumer records to tolerate RabbitMQ at-least-once delivery.
CREATE TABLE IF NOT EXISTS public.inbox_events (
  consumer_name TEXT NOT NULL,
  event_id UUID NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_name, event_id)
);
RESET ROLE;
\connect postgres
-- PostgreSQL roles cannot connect to other services' DBs because CONNECT was revoked.
-- Bootstrap finished. Check with: SELECT datname FROM pg_database WHERE datname LIKE '%_db';
