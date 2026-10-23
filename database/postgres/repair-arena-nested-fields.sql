-- Embedded option/member fields are not required at the root of their parent record.
DO $$ BEGIN
  IF current_database() <> 'arena_db' THEN
    RAISE EXCEPTION 'Run this repair against arena_db only';
  END IF;
END $$;
SET ROLE vl_arena;
ALTER TABLE public.arenamatchquestions ALTER COLUMN key DROP NOT NULL;
ALTER TABLE public.arenamatchquestions ALTER COLUMN text DROP NOT NULL;
ALTER TABLE public.arenarooms ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.friendrooms ALTER COLUMN user_id DROP NOT NULL;
DO $$
DECLARE item RECORD; stored_type TEXT;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('arenamatches', 'eliminated_user_ids', 'eliminatedUserIds'),
    ('arenamatchplayers', 'scored_question_ids', 'scoredQuestionIds')
  ) AS columns(table_key, column_key, payload_key) LOOP
    SELECT data_type INTO STRICT stored_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name=item.table_key AND column_name=item.column_key;
    IF stored_type <> 'jsonb' THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP DEFAULT',item.table_key,item.column_key);
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE JSONB USING
        CASE WHEN jsonb_typeof(payload -> %L) = ''array'' THEN payload -> %L
             WHEN %I IS NULL THEN ''[]''::jsonb
             WHEN jsonb_typeof(to_jsonb(%I)) = ''array'' THEN to_jsonb(%I)
             ELSE jsonb_build_array(%I) END',
        item.table_key,item.column_key,item.payload_key,item.payload_key,item.column_key,item.column_key,item.column_key,item.column_key);
    END IF;
    EXECUTE format('UPDATE public.%I SET %I=''[]''::jsonb WHERE %I IS NULL',item.table_key,item.column_key,item.column_key);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT ''[]''::jsonb',item.table_key,item.column_key);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I SET NOT NULL',item.table_key,item.column_key);
  END LOOP;
END $$;
RESET ROLE;
