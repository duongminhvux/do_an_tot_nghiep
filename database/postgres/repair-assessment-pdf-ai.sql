DO $$ BEGIN
  IF current_database() <> 'assessment_db' THEN
    RAISE EXCEPTION 'Run this repair against assessment_db only';
  END IF;
END $$;
SET ROLE vl_assessment;
-- V8.4: Assessment owns delivery of PDF-AI correction events.
-- Safe to run again; existing rows in assessment_db are retained.
CREATE TABLE IF NOT EXISTS public.pdf_ai_correction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE,
  state TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
RESET ROLE;
