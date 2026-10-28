ALTER TABLE public.attempts ADD COLUMN exam_publication_revision integer;
ALTER TABLE public.attempts ADD COLUMN exam_snapshot jsonb;
UPDATE public.attempts SET
  exam_publication_revision=(payload->>'examPublicationRevision')::integer,
  exam_snapshot=NULLIF(payload->'examSnapshot','null'::jsonb),
  payload=payload-ARRAY['examPublicationRevision','examSnapshot']::text[]
WHERE payload ?| ARRAY['examPublicationRevision','examSnapshot'];
CREATE INDEX attempts_exam_revision_completed_idx ON public.attempts(exam_id,exam_publication_revision,user_id)
  WHERE mode='TEST' AND status IN ('FINISHED','COMPLETED');

-- Retain the insertion/publication race guard after moving revision out of payload.
CREATE OR REPLACE FUNCTION public.publication_guard_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_revision integer;
BEGIN
  IF NEW.status<>'IN_PROGRESS' OR NEW.exam_publication_revision IS NULL
     OR EXISTS(SELECT 1 FROM public.attempts WHERE id=NEW.id) THEN RETURN NEW; END IF;
  SELECT publication_revision INTO current_revision FROM public.exams
    WHERE id=NEW.exam_id AND publication_status='PUBLISHED' AND is_active IS NOT FALSE AND is_deleted IS NOT TRUE FOR SHARE;
  IF current_revision IS NULL OR current_revision<>NEW.exam_publication_revision THEN
    RAISE EXCEPTION 'Exam publication changed while constructing the snapshot';
  END IF;
  RETURN NEW;
END $$;
