-- Service-local public display projection; no email, credentials or full user copy.
CREATE TABLE IF NOT EXISTS public.identity_profiles (
  id uuid PRIMARY KEY,
  username text,
  avatar_url text,
  is_deleted boolean NOT NULL DEFAULT false,
  is_banned boolean NOT NULL DEFAULT false,
  source_version bigint NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS identity_profiles_name ON public.identity_profiles(lower(username));
ALTER TABLE public.outbox_events ADD COLUMN IF NOT EXISTS event_version integer NOT NULL DEFAULT 1;
ALTER TABLE public.outbox_events ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.outbox_events ADD COLUMN IF NOT EXISTS correlation_id text;
ALTER TABLE public.outbox_events ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.outbox_events ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE public.outbox_events ADD COLUMN IF NOT EXISTS parked_at timestamptz;
CREATE INDEX IF NOT EXISTS outbox_retry_due ON public.outbox_events(next_attempt_at,created_at) WHERE published_at IS NULL AND parked_at IS NULL;
ALTER TABLE public.inbox_events ADD COLUMN IF NOT EXISTS event_type text;
ALTER TABLE public.inbox_events ADD COLUMN IF NOT EXISTS source text;
CREATE TABLE IF NOT EXISTS public.event_processing_failures (
  consumer_name text NOT NULL,
  event_id text NOT NULL,
  event_type text,
  attempts integer NOT NULL DEFAULT 0,
  last_error text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(consumer_name,event_id)
);
