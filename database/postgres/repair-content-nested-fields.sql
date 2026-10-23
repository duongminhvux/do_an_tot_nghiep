-- Existing V8 volumes accidentally flattened required fields from embedded schemas.
-- Keep legacy columns/values, but require only fields actually supplied by the parent DTO.
DO $$ BEGIN
  IF current_database() <> 'content_db' THEN
    RAISE EXCEPTION 'Run this repair against content_db only';
  END IF;
END $$;
SET ROLE vl_content;
ALTER TABLE public.dictationsegments ALTER COLUMN word DROP NOT NULL;
ALTER TABLE public.dictationprogresses ALTER COLUMN segment_index DROP NOT NULL;
ALTER TABLE public.words ALTER COLUMN part_of_speech DROP NOT NULL;
RESET ROLE;
