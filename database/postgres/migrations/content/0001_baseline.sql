-- Frozen V8 baseline, idempotently adopted for existing installations.
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
