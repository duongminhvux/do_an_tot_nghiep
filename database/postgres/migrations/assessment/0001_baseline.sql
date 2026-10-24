-- Frozen V8 baseline, idempotently adopted for existing installations.
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
