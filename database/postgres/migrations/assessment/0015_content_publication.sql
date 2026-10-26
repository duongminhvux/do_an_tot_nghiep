-- F10 Assessment-owned publication workflow.

CREATE FUNCTION public.publication_invalidate_parent() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ignored text[] := ARRAY['payload','created_at','updated_at','publication_status','publication_revision','publication_validation','published_by','published_at','order','group_order','is_active','is_deleted'];
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
CREATE TABLE public.content_publication_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), resource_type text NOT NULL, resource_id uuid NOT NULL,
  action text NOT NULL CHECK(action IN ('VALIDATE','PUBLISH','UNPUBLISH')), actor_id uuid NOT NULL,
  revision integer NOT NULL, issues jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_publication_audit_resource ON public.content_publication_audit(resource_type,resource_id,created_at DESC);

ALTER TABLE public.exams
  ADD COLUMN publication_status text NOT NULL DEFAULT 'DRAFT' CHECK(publication_status IN ('DRAFT','IN_REVIEW','PUBLISHED')),
  ADD COLUMN publication_revision integer NOT NULL DEFAULT 1,
  ADD COLUMN publication_validation jsonb,
  ADD COLUMN published_by uuid, ADD COLUMN published_at timestamptz;
-- Preserve the currently visible legacy catalog; new records default to DRAFT.
UPDATE public.exams SET publication_status='PUBLISHED' WHERE is_active IS NOT FALSE AND is_deleted IS NOT TRUE;
CREATE INDEX exams_publication_status ON public.exams(publication_status);
CREATE TRIGGER publication_parent BEFORE INSERT OR UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.publication_invalidate_parent();

CREATE FUNCTION public.publication_invalidate_exam() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_exam uuid; new_exam uuid; previous_setting text;
BEGIN
  IF TG_TABLE_NAME='passages' THEN
    IF TG_OP<>'INSERT' THEN SELECT exam_id INTO old_exam FROM public.passagegroups WHERE id=OLD.passage_group_id; END IF;
    IF TG_OP<>'DELETE' THEN SELECT exam_id INTO new_exam FROM public.passagegroups WHERE id=NEW.passage_group_id; END IF;
  ELSE
    IF TG_OP<>'INSERT' THEN old_exam:=OLD.exam_id; END IF;
    IF TG_OP<>'DELETE' THEN new_exam:=NEW.exam_id; END IF;
  END IF;
  previous_setting:=current_setting('vocalearn.publication_transition',true);
  PERFORM set_config('vocalearn.publication_transition','1',true);
  UPDATE public.exams SET publication_status='DRAFT',publication_revision=publication_revision+1,publication_validation=NULL
    WHERE id=old_exam OR id=new_exam;
  PERFORM set_config('vocalearn.publication_transition',COALESCE(previous_setting,''),true);
  RETURN NULL;
END $$;
CREATE TRIGGER publication_child AFTER INSERT OR UPDATE OR DELETE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.publication_invalidate_exam();
CREATE TRIGGER publication_child AFTER INSERT OR UPDATE OR DELETE ON public.passagegroups FOR EACH ROW EXECUTE FUNCTION public.publication_invalidate_exam();
CREATE TRIGGER publication_child AFTER INSERT OR UPDATE OR DELETE ON public.passages FOR EACH ROW EXECUTE FUNCTION public.publication_invalidate_exam();

-- New API attempts carry the revision used to build their immutable snapshot.
-- Hold a shared parent lock through insertion and reject edits that raced with
-- snapshot construction. Existing attempts and privileged legacy imports remain
-- readable/saveable under their original snapshot policy.
CREATE FUNCTION public.publication_guard_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_revision integer;
BEGIN
  IF NEW.status<>'IN_PROGRESS' OR NOT (NEW.payload ? 'examPublicationRevision')
     OR EXISTS(SELECT 1 FROM public.attempts WHERE id=NEW.id) THEN RETURN NEW; END IF;
  SELECT publication_revision INTO current_revision FROM public.exams
    WHERE id=NEW.exam_id AND publication_status='PUBLISHED' AND is_active IS NOT FALSE AND is_deleted IS NOT TRUE FOR SHARE;
  IF current_revision IS NULL OR current_revision<>(NEW.payload->>'examPublicationRevision')::integer THEN
    RAISE EXCEPTION 'Exam publication changed while constructing the snapshot';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER publication_attempt BEFORE INSERT ON public.attempts FOR EACH ROW EXECUTE FUNCTION public.publication_guard_attempt();
