-- Room runtime policy is a configuration object, never a numeric duration.
ALTER TABLE public.friendrooms
  ALTER COLUMN runtime_policy TYPE jsonb
  USING CASE
    WHEN jsonb_typeof(payload->'runtimePolicy') = 'object' THEN payload->'runtimePolicy'
    ELSE to_jsonb(runtime_policy)
  END;
