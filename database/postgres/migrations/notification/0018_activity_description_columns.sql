ALTER TABLE public.activitylogs ADD COLUMN description_key text;
ALTER TABLE public.activitylogs ADD COLUMN description_args jsonb;
UPDATE public.activitylogs SET description_key=payload->>'descriptionKey',
  description_args=NULLIF(payload->'descriptionArgs','null'::jsonb),
  payload=payload-ARRAY['descriptionKey','descriptionArgs']::text[]
WHERE payload ?| ARRAY['descriptionKey','descriptionArgs'];
