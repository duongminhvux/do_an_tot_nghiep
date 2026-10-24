-- repair-content-nested-fields.sql
-- Existing V8 volumes accidentally flattened required fields from embedded schemas.
-- Keep legacy columns/values, but require only fields actually supplied by the parent DTO.

ALTER TABLE public.dictationsegments ALTER COLUMN word DROP NOT NULL;
ALTER TABLE public.dictationprogresses ALTER COLUMN segment_index DROP NOT NULL;
ALTER TABLE public.words ALTER COLUMN part_of_speech DROP NOT NULL;

-- repair-dictation-progress-arrays.sql
-- Convert index lists mistakenly generated as numeric scalars. Safe to run repeatedly.

DO $$
DECLARE
  column_key TEXT;
  payload_key TEXT;
  stored_type TEXT;
BEGIN
  FOREACH column_key IN ARRAY ARRAY['completed_segments', 'revealed_segments'] LOOP
    payload_key := CASE column_key WHEN 'completed_segments' THEN 'completedSegments' ELSE 'revealedSegments' END;
    SELECT data_type INTO STRICT stored_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'dictationprogresses' AND column_name = column_key;
    IF stored_type <> 'jsonb' THEN
      EXECUTE format('ALTER TABLE public.dictationprogresses ALTER COLUMN %I DROP DEFAULT', column_key);
      EXECUTE format('ALTER TABLE public.dictationprogresses ALTER COLUMN %I TYPE JSONB USING
        CASE WHEN jsonb_typeof(payload -> %L) = ''array'' THEN payload -> %L
             WHEN %I IS NULL THEN ''[]''::jsonb
             WHEN jsonb_typeof(to_jsonb(%I)) = ''array'' THEN to_jsonb(%I)
             ELSE jsonb_build_array(%I) END',
        column_key, payload_key, payload_key, column_key, column_key, column_key, column_key);
    END IF;
    EXECUTE format('UPDATE public.dictationprogresses SET %I = ''[]''::jsonb WHERE %I IS NULL', column_key, column_key);
    EXECUTE format('ALTER TABLE public.dictationprogresses ALTER COLUMN %I SET DEFAULT ''[]''::jsonb', column_key);
    EXECUTE format('ALTER TABLE public.dictationprogresses ALTER COLUMN %I SET NOT NULL', column_key);
  END LOOP;
END $$;

