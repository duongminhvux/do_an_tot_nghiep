ALTER TABLE public.exam_comments ADD COLUMN is_pinned boolean NOT NULL DEFAULT false;
ALTER TABLE public.exam_comments ADD CONSTRAINT exam_comments_pin_root CHECK (NOT is_pinned OR (root_id IS NULL AND deleted_at IS NULL));
CREATE INDEX exam_comments_pinned_roots ON public.exam_comments(exam_id,is_pinned DESC,created_at DESC,id DESC) WHERE root_id IS NULL;
