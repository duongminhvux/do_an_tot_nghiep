-- Active website time is independent of elapsed lesson/test durations.
CREATE TABLE public.user_active_time_state (
  user_id uuid PRIMARY KEY,
  last_seen_at timestamptz NOT NULL
);
CREATE TABLE public.user_active_time_slices (
  user_id uuid NOT NULL,
  request_id uuid NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, request_id),
  CHECK (ended_at >= started_at AND ended_at - started_at <= interval '30 seconds')
);
CREATE INDEX user_active_time_slices_user_end ON public.user_active_time_slices(user_id, ended_at);
