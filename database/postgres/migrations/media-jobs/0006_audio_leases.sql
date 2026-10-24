ALTER TABLE public.audio_jobs ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'waiting';
ALTER TABLE public.audio_jobs ADD COLUMN IF NOT EXISTS lease_owner uuid;
ALTER TABLE public.audio_jobs ADD COLUMN IF NOT EXISTS lease_until timestamptz;
ALTER TABLE public.audio_jobs ADD COLUMN IF NOT EXISTS lease_generation bigint NOT NULL DEFAULT 0;
ALTER TABLE public.audio_jobs ADD COLUMN IF NOT EXISTS run_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.audio_jobs ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 6;
ALTER TABLE public.audio_jobs ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now();
UPDATE public.audio_jobs SET state=CASE WHEN payload->>'state' IN('waiting','active','completed','failed') THEN payload->>'state' ELSE 'waiting' END;
-- V8 process-local owners cannot survive this rollout. Expire those leases without removing jobs.
UPDATE public.audio_jobs SET state='waiting',payload=payload||'{"state":"waiting"}'::jsonb WHERE state='active';
CREATE INDEX IF NOT EXISTS audio_claim_due ON public.audio_jobs(state,next_attempt_at,lease_until);
CREATE TABLE IF NOT EXISTS public.audio_job_runs (
  job_id uuid NOT NULL REFERENCES public.audio_jobs(id),
  generation bigint NOT NULL,
  lease_owner uuid NOT NULL,
  state text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  PRIMARY KEY(job_id,generation)
);
CREATE TABLE IF NOT EXISTS public.audio_job_effects (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.audio_jobs(id),
  generation bigint NOT NULL,
  resource text NOT NULL,
  resource_id uuid NOT NULL,
  applied_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id,generation,resource,resource_id)
);
