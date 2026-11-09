-- Content owns Dictation progress and its immutable practice history.
-- Existing cumulative progress is retained; historical sessions are never invented.
CREATE TABLE public.dictation_learning_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES public.dictationlessons(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  completed boolean NOT NULL DEFAULT false,
  lesson_revision integer NOT NULL,
  sentence_count integer NOT NULL CHECK(sentence_count>=0),
  CHECK(last_activity_at>=started_at),
  CHECK(ended_at IS NULL OR ended_at>=started_at)
);
CREATE INDEX dictation_sessions_lesson_time ON public.dictation_learning_sessions(lesson_id,last_activity_at DESC,id);
CREATE INDEX dictation_sessions_user_lesson ON public.dictation_learning_sessions(user_id,lesson_id,last_activity_at DESC);
CREATE TABLE public.dictation_learning_events (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.dictation_learning_sessions(id),
  action text NOT NULL CHECK(action IN ('ATTEMPT','REPLAY','REVEAL_SEGMENT','REVEAL_TRANSCRIPT','RESET')),
  segment_index integer CHECK(segment_index>=0),
  submitted_text text CHECK(length(submitted_text)<=2000),
  reference_text text,
  is_correct boolean,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  request_hash text NOT NULL,
  result jsonb NOT NULL,
  CHECK((action='ATTEMPT')=(is_correct IS NOT NULL))
);
CREATE INDEX dictation_events_session_time ON public.dictation_learning_events(session_id,occurred_at,id);
