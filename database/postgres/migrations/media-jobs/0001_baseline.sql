-- Frozen V8 baseline, idempotently adopted for existing installations.
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
