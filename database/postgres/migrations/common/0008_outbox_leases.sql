ALTER TABLE public.outbox_events ADD COLUMN IF NOT EXISTS lease_owner uuid;
ALTER TABLE public.outbox_events ADD COLUMN IF NOT EXISTS lease_until timestamptz;
CREATE INDEX IF NOT EXISTS outbox_lease_due ON public.outbox_events(next_attempt_at,lease_until,created_at)
WHERE published_at IS NULL AND parked_at IS NULL;
