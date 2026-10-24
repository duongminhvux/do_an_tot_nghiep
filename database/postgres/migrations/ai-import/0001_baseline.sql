-- Frozen V8 baseline, idempotently adopted for existing installations.
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
