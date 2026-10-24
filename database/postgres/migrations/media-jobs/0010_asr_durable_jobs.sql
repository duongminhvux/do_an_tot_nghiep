ALTER TABLE public.asr_jobs ADD COLUMN IF NOT EXISTS lease_owner uuid;
ALTER TABLE public.asr_jobs ADD COLUMN IF NOT EXISTS lease_until timestamptz;
ALTER TABLE public.asr_jobs ADD COLUMN IF NOT EXISTS lease_generation bigint NOT NULL DEFAULT 0;
ALTER TABLE public.asr_jobs ADD COLUMN IF NOT EXISTS run_attempts int NOT NULL DEFAULT 0;
ALTER TABLE public.asr_jobs ADD COLUMN IF NOT EXISTS max_attempts int NOT NULL DEFAULT 6;
CREATE INDEX IF NOT EXISTS idx_asr_leases ON public.asr_jobs(lease_until) WHERE status='ACTIVE';
-- Adopt only unfinished work. Terminal failed jobs require an explicit operator replay.
INSERT INTO public.outbox_events(event_id,event_type,aggregate_type,aggregate_id,payload,source)
SELECT gen_random_uuid(),'media-jobs.asr.requested.v1','asr',j.id,jsonb_build_object('jobId',j.id,'aggregateVersion',0),'media-jobs'
FROM public.asr_jobs j WHERE j.payload->>'state' IN('waiting','active','retrying')
AND NOT EXISTS(SELECT 1 FROM public.outbox_events e WHERE e.aggregate_id=j.id AND e.event_type='media-jobs.asr.requested.v1');
INSERT INTO public.outbox_events(event_id,event_type,aggregate_type,aggregate_id,payload,source)
SELECT gen_random_uuid(),'media-jobs.audio.requested.v1','audio',j.id,jsonb_build_object('jobId',j.id,'aggregateVersion',0),'media-jobs'
FROM public.audio_jobs j WHERE j.state IN('waiting','active')
AND NOT EXISTS(SELECT 1 FROM public.outbox_events e WHERE e.aggregate_id=j.id AND e.event_type='media-jobs.audio.requested.v1');
