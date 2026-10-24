CREATE TABLE IF NOT EXISTS public.notification_email_jobs (
  id uuid PRIMARY KEY,
  recipient text NOT NULL,
  subject text NOT NULL,
  html text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','active','completed','dead')),
  attempts integer NOT NULL DEFAULT 0,
  lease_owner uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS notification_email_due ON public.notification_email_jobs(next_attempt_at) WHERE state IN('pending','active');
