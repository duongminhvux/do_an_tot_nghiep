-- Group membership is organization metadata, like group_order; it does not edit exam content.
CREATE OR REPLACE FUNCTION public.publication_invalidate_parent() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ignored text[] := ARRAY['payload','created_at','updated_at','publication_status','publication_revision','publication_validation','published_by','published_at','order','group_id','group_order','is_active','is_deleted'];
BEGIN
  IF current_setting('vocalearn.publication_transition',true)='1' THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    NEW.publication_status:='DRAFT'; NEW.publication_revision:=1; NEW.publication_validation:=NULL; NEW.published_by:=NULL;
    IF TG_TABLE_NAME='dictationlessons' AND to_jsonb(NEW)->>'status'='PUBLISHED' THEN NEW:=jsonb_populate_record(NEW,'{"status":"DRAFT"}'); END IF;
    RETURN NEW;
  END IF;
  NEW.publication_status:=OLD.publication_status; NEW.publication_revision:=OLD.publication_revision;
  NEW.publication_validation:=OLD.publication_validation; NEW.published_by:=OLD.published_by; NEW.published_at:=OLD.published_at;
  IF (to_jsonb(NEW)-ignored) IS DISTINCT FROM (to_jsonb(OLD)-ignored) THEN
    NEW.publication_revision:=OLD.publication_revision+1; NEW.publication_status:='DRAFT'; NEW.publication_validation:=NULL;
    IF TG_TABLE_NAME='dictationlessons' AND to_jsonb(NEW)->>'status'='PUBLISHED' THEN NEW:=jsonb_populate_record(NEW,'{"status":"DRAFT"}'); END IF;
  END IF;
  RETURN NEW;
END $$;
