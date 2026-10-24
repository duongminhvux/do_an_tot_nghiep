CREATE TABLE IF NOT EXISTS public.audio_effect_fences (
  job_id uuid NOT NULL,
  resource text NOT NULL,
  resource_id uuid NOT NULL,
  generation bigint NOT NULL,
  PRIMARY KEY(job_id,resource,resource_id)
);
