-- F02 personal notebook and denominator for privacy-thresholded statistics.
CREATE TABLE public.learning_item_outcomes (
  user_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('TOEIC','DICTATION','VOCABULARY')),
  source_item_id uuid NOT NULL,
  source_key text NOT NULL CHECK (length(source_key) BETWEEN 1 AND 250),
  source_ref_id uuid NOT NULL,
  title text NOT NULL CHECK (length(title) <= 300),
  samples integer NOT NULL CHECK (samples > 0),
  wrong_count integer NOT NULL CHECK (wrong_count BETWEEN 0 AND samples),
  occurred_at timestamptz NOT NULL,
  PRIMARY KEY(user_id, source_type, source_item_id, source_key)
);
CREATE INDEX learning_item_outcomes_content ON public.learning_item_outcomes(source_type, source_item_id, occurred_at);
CREATE INDEX learning_item_outcomes_recent ON public.learning_item_outcomes(occurred_at);
CREATE TABLE public.learning_mistakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('TOEIC','DICTATION','VOCABULARY')),
  source_item_id uuid NOT NULL,
  source_ref_id uuid NOT NULL,
  title text NOT NULL,
  wrong_count integer NOT NULL CHECK (wrong_count > 0),
  last_wrong_at timestamptz NOT NULL,
  reviewed_count integer NOT NULL DEFAULT 0 CHECK (reviewed_count >= 0),
  reviewed_at timestamptz,
  UNIQUE(user_id, source_type, source_item_id)
);
CREATE INDEX learning_mistakes_user_recent ON public.learning_mistakes(user_id, last_wrong_at DESC, id);
CREATE INDEX learning_mistakes_user_pending ON public.learning_mistakes(user_id, last_wrong_at DESC) WHERE wrong_count > reviewed_count;

-- Same transaction as credit/inbox receipt. Logical keys protect against replay
-- with a different transport event ID as well as normal RabbitMQ redelivery.
CREATE FUNCTION public.record_learning_outcomes(p_user uuid, p_key text, p_time timestamptz, p_items jsonb)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE item jsonb; previous_wrong integer; added_wrong integer;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) > 1000 THEN
    RAISE EXCEPTION 'Invalid learning outcomes';
  END IF;
  -- Completion snapshots can grow when a learner retries the same Dictation
  -- progress. Serialize by logical activity and apply only positive deltas.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_key,0));
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'sourceType',value->>'sourceItemId' LOOP
    SELECT wrong_count INTO previous_wrong FROM public.learning_item_outcomes
      WHERE user_id=p_user AND source_type=item->>'sourceType'
        AND source_item_id=(item->>'sourceItemId')::uuid AND source_key=p_key;
    added_wrong := GREATEST((item->>'wrongCount')::integer-COALESCE(previous_wrong,0),0);
      INSERT INTO public.learning_item_outcomes(user_id,source_type,source_item_id,source_key,source_ref_id,title,samples,wrong_count,occurred_at)
      VALUES(p_user,item->>'sourceType',(item->>'sourceItemId')::uuid,p_key,(item->>'sourceRefId')::uuid,
        left(item->>'title',300),(item->>'samples')::integer,(item->>'wrongCount')::integer,p_time)
      ON CONFLICT(user_id,source_type,source_item_id,source_key) DO UPDATE SET
        samples=GREATEST(learning_item_outcomes.samples,EXCLUDED.samples),
        wrong_count=GREATEST(learning_item_outcomes.wrong_count,EXCLUDED.wrong_count),
        occurred_at=GREATEST(learning_item_outcomes.occurred_at,EXCLUDED.occurred_at);
    IF added_wrong > 0 THEN
    INSERT INTO public.learning_mistakes(user_id,source_type,source_item_id,source_ref_id,title,wrong_count,last_wrong_at)
    VALUES(p_user,item->>'sourceType',(item->>'sourceItemId')::uuid,(item->>'sourceRefId')::uuid,left(item->>'title',300),added_wrong,p_time)
    ON CONFLICT(user_id,source_type,source_item_id) DO UPDATE SET
      wrong_count=learning_mistakes.wrong_count+EXCLUDED.wrong_count,
      last_wrong_at=GREATEST(learning_mistakes.last_wrong_at,EXCLUDED.last_wrong_at),
      source_ref_id=CASE WHEN EXCLUDED.last_wrong_at >= learning_mistakes.last_wrong_at THEN EXCLUDED.source_ref_id ELSE learning_mistakes.source_ref_id END,
      title=CASE WHEN EXCLUDED.last_wrong_at >= learning_mistakes.last_wrong_at THEN EXCLUDED.title ELSE learning_mistakes.title END;
    END IF;
  END LOOP;
END $$;
