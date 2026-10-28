-- Exam-local discussion and full TEST leaderboard. Identity display uses the
-- existing service-local public profile projection, never Identity credentials.
CREATE TABLE public.exam_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  root_id uuid,
  reply_to_id uuid,
  body text NOT NULL CHECK(char_length(btrim(body)) BETWEEN 1 AND 2000),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,exam_id),
  FOREIGN KEY(root_id,exam_id) REFERENCES public.exam_comments(id,exam_id),
  FOREIGN KEY(reply_to_id,exam_id) REFERENCES public.exam_comments(id,exam_id),
  CHECK((root_id IS NULL)=(reply_to_id IS NULL)),
  CHECK(root_id IS DISTINCT FROM id AND reply_to_id IS DISTINCT FROM id)
);
CREATE INDEX exam_comments_roots ON public.exam_comments(exam_id,created_at DESC,id DESC) WHERE root_id IS NULL;
CREATE INDEX exam_comments_replies ON public.exam_comments(root_id,created_at,id) WHERE root_id IS NOT NULL;
CREATE INDEX exam_comments_author_rate ON public.exam_comments(author_id,created_at DESC);
CREATE TABLE public.exam_comment_reactions (
  comment_id uuid NOT NULL REFERENCES public.exam_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL CHECK(emoji IN ('👍','❤️','😂','🎉','🤔','😢')),
  PRIMARY KEY(comment_id,user_id)
);
CREATE INDEX attempts_exam_full_test_leaderboard ON public.attempts(exam_id,user_id,correct_answers DESC,duration_spent,completed_at)
  WHERE mode='TEST' AND status IN ('FINISHED','COMPLETED') AND result_version IS NOT NULL;
