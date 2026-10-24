-- Frozen V8 baseline, idempotently adopted for existing installations.
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
