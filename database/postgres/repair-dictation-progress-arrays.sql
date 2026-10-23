-- Convert index lists mistakenly generated as numeric scalars. Safe to run repeatedly.
DO $$ BEGIN
  IF current_database() <> 'content_db' THEN
    RAISE EXCEPTION 'Run this repair against content_db only';
  END IF;
END $$;
SET ROLE vl_content;
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
RESET ROLE;
