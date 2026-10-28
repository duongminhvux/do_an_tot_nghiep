ALTER TABLE public.arenamatches ADD COLUMN ranked_state jsonb;
ALTER TABLE public.arenamatches ADD COLUMN audio_settings jsonb;
UPDATE public.arenamatches SET ranked_state=NULLIF(payload->'rankedState','null'::jsonb),
  audio_settings=NULLIF(payload->'audioSettings','null'::jsonb),
  payload=payload-ARRAY['rankedState','audioSettings']::text[]
WHERE payload ?| ARRAY['rankedState','audioSettings'];
