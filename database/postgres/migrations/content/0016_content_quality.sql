-- F11: Content owns the unified, cached quality snapshot and resumable batch job.
CREATE TABLE public.content_quality_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','RUNNING','COMPLETED','FAILED')),
  phase integer NOT NULL DEFAULT 0 CHECK(phase BETWEEN 0 AND 4),
  cursor_id uuid,
  scanned_count integer NOT NULL DEFAULT 0,
  failures integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE UNIQUE INDEX content_quality_one_active ON public.content_quality_jobs ((true)) WHERE state IN ('PENDING','RUNNING');
CREATE TABLE public.content_quality_findings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.content_quality_jobs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('exams','words','lessons','dictation')),
  resource_id uuid NOT NULL,
  title text NOT NULL,
  category text NOT NULL CHECK(category IN ('DATA','MEDIA','DUPLICATE','FEEDBACK')),
  code text NOT NULL,
  path text NOT NULL,
  severity text NOT NULL CHECK(severity IN ('error','warning')),
  message_vi text NOT NULL,
  message_en text NOT NULL,
  edit_path text NOT NULL,
  content_updated_at timestamptz,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_quality_findings_page ON public.content_quality_findings(job_id,category,id);
CREATE TABLE public.content_quality_media_cache (
  url text PRIMARY KEY,
  outcome text NOT NULL CHECK(outcome IN ('OK','MISSING','UNVERIFIED')),
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.content_quality_media_links (
  job_id uuid NOT NULL REFERENCES public.content_quality_jobs(id) ON DELETE CASCADE,
  kind text NOT NULL,
  resource_id uuid NOT NULL,
  title text NOT NULL,
  path text NOT NULL,
  url text NOT NULL,
  edit_path text NOT NULL,
  content_updated_at timestamptz,
  outcome text CHECK(outcome IN ('OK','MISSING','UNVERIFIED')),
  PRIMARY KEY(job_id,kind,resource_id,path)
);
CREATE INDEX content_quality_media_pending ON public.content_quality_media_links(job_id,url) WHERE outcome IS NULL;
CREATE INDEX words_quality_exact ON public.words(lower(btrim(word))) WHERE is_deleted IS NOT TRUE;
