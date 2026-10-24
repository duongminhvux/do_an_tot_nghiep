-- Frozen V8 baseline, idempotently adopted for existing installations.
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
