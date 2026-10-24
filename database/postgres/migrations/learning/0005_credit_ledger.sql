CREATE TABLE IF NOT EXISTS public.learning_credit_ledger (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  source_key text NOT NULL,
  event_id uuid NOT NULL,
  source_service text NOT NULL,
  xp integer NOT NULL CHECK(xp>=0),
  activity_id uuid NOT NULL REFERENCES public.learning_activities(id) DEFERRABLE INITIALLY DEFERRED,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,source_key),
  UNIQUE(activity_id)
);
CREATE INDEX IF NOT EXISTS learning_credit_user_time ON public.learning_credit_ledger(user_id,occurred_at DESC,id);
-- Existing credits remain credits; adopting the ledger never awards them twice.
INSERT INTO public.learning_credit_ledger(id,user_id,source_key,event_id,source_service,xp,activity_id,occurred_at)
SELECT id,user_id,source_key,id,'legacy',xp,id,occurred_at FROM public.learning_activities
ON CONFLICT(user_id,source_key) DO NOTHING;
