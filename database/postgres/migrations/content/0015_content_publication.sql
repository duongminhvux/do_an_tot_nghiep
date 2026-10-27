-- F10 Content-owned publication workflow; audio processing status remains separate.

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
    IF TG_TABLE_NAME='dictationlessons' AND to_jsonb(NEW)->>'status'='PUBLISHED' THEN NEW:=jsonb_populate_record(NEW,'{"status":"READY"}'); END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TABLE public.content_publication_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), resource_type text NOT NULL, resource_id uuid NOT NULL,
  action text NOT NULL CHECK(action IN ('VALIDATE','PUBLISH','UNPUBLISH')), actor_id uuid NOT NULL,
  revision integer NOT NULL, issues jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_publication_audit_resource ON public.content_publication_audit(resource_type,resource_id,created_at DESC);

ALTER TABLE public.words
  ADD COLUMN publication_status text NOT NULL DEFAULT 'DRAFT' CHECK(publication_status IN ('DRAFT','IN_REVIEW','PUBLISHED')),
  ADD COLUMN publication_revision integer NOT NULL DEFAULT 1,
  ADD COLUMN publication_validation jsonb,
  ADD COLUMN published_by uuid, ADD COLUMN published_at timestamptz;
-- Preserve the currently visible legacy catalog; new records default to DRAFT.
UPDATE public.words SET publication_status='PUBLISHED' WHERE is_active IS NOT FALSE AND is_deleted IS NOT TRUE;
CREATE INDEX words_publication_status ON public.words(publication_status);
CREATE TRIGGER publication_parent BEFORE INSERT OR UPDATE ON public.words
  FOR EACH ROW EXECUTE FUNCTION public.publication_invalidate_parent();

ALTER TABLE public.lessons
  ADD COLUMN publication_status text NOT NULL DEFAULT 'DRAFT' CHECK(publication_status IN ('DRAFT','IN_REVIEW','PUBLISHED')),
  ADD COLUMN publication_revision integer NOT NULL DEFAULT 1,
  ADD COLUMN publication_validation jsonb,
  ADD COLUMN published_by uuid, ADD COLUMN published_at timestamptz;
-- Preserve the currently visible legacy catalog; new records default to DRAFT.
UPDATE public.lessons SET publication_status='PUBLISHED' WHERE is_active IS NOT FALSE AND is_deleted IS NOT TRUE;
CREATE INDEX lessons_publication_status ON public.lessons(publication_status);
CREATE TRIGGER publication_parent BEFORE INSERT OR UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.publication_invalidate_parent();

ALTER TABLE public.dictationlessons
  ADD COLUMN publication_status text NOT NULL DEFAULT 'DRAFT' CHECK(publication_status IN ('DRAFT','IN_REVIEW','PUBLISHED')),
  ADD COLUMN publication_revision integer NOT NULL DEFAULT 1,
  ADD COLUMN publication_validation jsonb,
  ADD COLUMN published_by uuid;
-- Preserve the currently visible legacy catalog; new records default to DRAFT.
UPDATE public.dictationlessons SET publication_status='PUBLISHED' WHERE status='PUBLISHED' AND is_deleted IS NOT TRUE;
CREATE INDEX dictationlessons_publication_status ON public.dictationlessons(publication_status);
CREATE TRIGGER publication_parent BEFORE INSERT OR UPDATE ON public.dictationlessons
  FOR EACH ROW EXECUTE FUNCTION public.publication_invalidate_parent();

CREATE FUNCTION public.publication_invalidate_lesson() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_lesson uuid; new_lesson uuid; previous_setting text; old_word uuid; new_word uuid;
BEGIN
  IF TG_OP<>'INSERT' THEN old_lesson:=OLD.lesson_id; END IF;
  IF TG_OP<>'DELETE' THEN new_lesson:=NEW.lesson_id; END IF;
  previous_setting:=current_setting('vocalearn.publication_transition',true);
  PERFORM set_config('vocalearn.publication_transition','1',true);
  IF TG_TABLE_NAME='dictationsegments' THEN
    UPDATE public.dictationlessons SET publication_status='DRAFT',publication_revision=publication_revision+1,publication_validation=NULL,
      status=CASE WHEN status='PUBLISHED' THEN 'READY' ELSE status END WHERE id=old_lesson OR id=new_lesson;
  ELSE
    UPDATE public.lessons SET publication_status='DRAFT',publication_revision=publication_revision+1,publication_validation=NULL WHERE id=old_lesson OR id=new_lesson;
    IF TG_TABLE_NAME='lessonwords' THEN
      IF TG_OP<>'INSERT' THEN old_word:=OLD.word_id; END IF;
      IF TG_OP<>'DELETE' THEN new_word:=NEW.word_id; END IF;
      UPDATE public.words w SET publication_status='DRAFT',publication_revision=publication_revision+1,publication_validation=NULL
        WHERE (w.id=old_word OR w.id=new_word) AND NOT EXISTS (
          SELECT 1 FROM public.lessonwords lw JOIN public.lessons l ON l.id=lw.lesson_id
          WHERE lw.word_id=w.id AND l.is_deleted IS NOT TRUE AND l.is_active IS NOT FALSE
        );
    END IF;
  END IF;
  PERFORM set_config('vocalearn.publication_transition',COALESCE(previous_setting,''),true);
  RETURN NULL;
END $$;
CREATE TRIGGER publication_child AFTER INSERT OR UPDATE OR DELETE ON public.lessonwords FOR EACH ROW EXECUTE FUNCTION public.publication_invalidate_lesson();
CREATE TRIGGER publication_child AFTER INSERT OR UPDATE OR DELETE ON public.sections FOR EACH ROW EXECUTE FUNCTION public.publication_invalidate_lesson();
CREATE TRIGGER publication_child AFTER INSERT OR UPDATE OR DELETE ON public.dictationsegments FOR EACH ROW EXECUTE FUNCTION public.publication_invalidate_lesson();
CREATE FUNCTION public.publication_word_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous_setting text;
BEGIN
  IF (to_jsonb(NEW)-ARRAY['payload','updated_at','publication_validation','published_by','published_at']) IS DISTINCT FROM
     (to_jsonb(OLD)-ARRAY['payload','updated_at','publication_validation','published_by','published_at']) THEN
    previous_setting:=current_setting('vocalearn.publication_transition',true);
    PERFORM set_config('vocalearn.publication_transition','1',true);
    UPDATE public.lessons SET publication_status='DRAFT',publication_revision=publication_revision+1,publication_validation=NULL
      WHERE id IN (SELECT lesson_id FROM public.lessonwords WHERE word_id=NEW.id);
    PERFORM set_config('vocalearn.publication_transition',COALESCE(previous_setting,''),true);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER publication_word_parent AFTER UPDATE ON public.words FOR EACH ROW EXECUTE FUNCTION public.publication_word_changed();
