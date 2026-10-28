-- Promote queryable application fields from the extension payload into typed columns.
ALTER TABLE public.exams ADD COLUMN group_order double precision;
UPDATE public.exams SET group_order=COALESCE((payload->>'groupOrder')::double precision,0),payload=payload-'groupOrder';
ALTER TABLE public.exams ALTER COLUMN group_order SET DEFAULT 0;
CREATE INDEX exams_group_order ON public.exams(group_id,group_order,"order",id) WHERE is_deleted IS NOT TRUE;

ALTER TABLE public.attempts
  ADD COLUMN mode text,
  ADD COLUMN revealed_answers jsonb,
  ADD COLUMN audio_play_counts jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN flagged_questions jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN current_question_index integer NOT NULL DEFAULT 0,
  ADD COLUMN part_results jsonb,
  ADD COLUMN listening_result jsonb,
  ADD COLUMN reading_result jsonb,
  ADD COLUMN result_version integer,
  ADD COLUMN incorrect_answers integer,
  ADD COLUMN unanswered_questions integer,
  ADD COLUMN listening_correct integer,
  ADD COLUMN reading_correct integer,
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN time_limit_seconds integer;
UPDATE public.attempts SET
  mode=payload->>'mode', revealed_answers=NULLIF(payload->'revealedAnswers','null'::jsonb),
  audio_play_counts=COALESCE(NULLIF(payload->'audioPlayCounts','null'::jsonb),'{}'),
  flagged_questions=COALESCE(NULLIF(payload->'flaggedQuestions','null'::jsonb),'[]'),
  current_question_index=COALESCE((payload->>'currentQuestionIndex')::integer,0),
  part_results=payload->'partResults',listening_result=payload->'listeningResult',reading_result=payload->'readingResult',
  result_version=(payload->>'resultVersion')::integer,
  incorrect_answers=(payload->>'incorrectAnswers')::integer,unanswered_questions=(payload->>'unansweredQuestions')::integer,
  listening_correct=(payload->>'listeningCorrect')::integer,reading_correct=(payload->>'readingCorrect')::integer,
  expires_at=(payload->>'expiresAt')::timestamptz,time_limit_seconds=(payload->>'timeLimitSeconds')::integer,
  payload=payload-ARRAY['mode','revealedAnswers','audioPlayCounts','flaggedQuestions','currentQuestionIndex','partResults','listeningResult','readingResult','resultVersion','incorrectAnswers','unansweredQuestions','listeningCorrect','readingCorrect','expiresAt','timeLimitSeconds'];
CREATE INDEX attempts_user_status_created ON public.attempts(user_id,status,created_at DESC);
