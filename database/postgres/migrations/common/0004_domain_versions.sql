CREATE TABLE IF NOT EXISTS public.aggregate_versions (
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY(aggregate_type,aggregate_id)
);
CREATE TABLE IF NOT EXISTS public.learning_credit_requests (
  user_id uuid NOT NULL,
  source_key text NOT NULL,
  event_id uuid NOT NULL REFERENCES public.outbox_events(event_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,source_key)
);
CREATE INDEX IF NOT EXISTS credit_request_replay ON public.learning_credit_requests(created_at,event_id);
CREATE TABLE IF NOT EXISTS public.exam_summaries (
  id uuid PRIMARY KEY,
  name text,
  type text,
  is_active boolean,
  is_deleted boolean NOT NULL DEFAULT false,
  source_version bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.learning_credit_totals (
  user_id uuid PRIMARY KEY,
  xp bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
