-- Frozen V8 baseline, idempotently adopted for existing installations.
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
