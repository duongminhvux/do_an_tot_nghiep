-- Content Quality phase 4: single-content recheck and cheaper media verification.
-- Additive only: no existing row is rewritten or removed.

-- URLs outside the configured media namespace are never fetched (SSRF policy).
-- They are now recorded as EXTERNAL instead of UNVERIFIED, so they no longer
-- create findings or count as content "to check".
ALTER TABLE public.content_quality_media_links DROP CONSTRAINT content_quality_media_links_outcome_check;
ALTER TABLE public.content_quality_media_links ADD CONSTRAINT content_quality_media_links_outcome_check
  CHECK (outcome = ANY (ARRAY['OK','MISSING','UNVERIFIED','EXTERNAL']));

-- Append-only history of "check this content again". The newest recheck that is
-- newer than the latest completed full scan replaces that content's findings in
-- the report; full-scan snapshots are never modified.
CREATE TABLE public.content_quality_rechecks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL CHECK (kind = ANY (ARRAY['exams','words','lessons','dictation'])),
  resource_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  title text NOT NULL,
  edit_path text NOT NULL,
  content_updated_at timestamptz,
  deleted boolean NOT NULL DEFAULT false,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(findings) = 'array'),
  resolved_count integer NOT NULL DEFAULT 0 CHECK (resolved_count >= 0),
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_quality_rechecks_resource ON public.content_quality_rechecks(kind, resource_id, checked_at DESC);
CREATE INDEX content_quality_rechecks_time ON public.content_quality_rechecks(checked_at DESC);

-- Report grouped by content (job + resource) and severity counters.
CREATE INDEX content_quality_findings_resource ON public.content_quality_findings(job_id, kind, resource_id);
CREATE INDEX content_quality_findings_severity ON public.content_quality_findings(job_id, severity, code);
