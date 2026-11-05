-- Identity-owned additive IAM foundation. Never assigns an administrator role.
-- Reject ambiguous legacy data rather than rewriting identities or credentials.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.admins WHERE email <> lower(btrim(email)) OR btrim(email) = ''
    OR username <> btrim(username) OR username = '' OR username ~ '[[:space:]@]'
    OR password_hash IS NULL OR btrim(password_hash) = '') THEN
    RAISE EXCEPTION 'Admin IAM preflight failed: review identity/password data without automatic repair';
  END IF;
  IF EXISTS (SELECT lower(btrim(email)) FROM public.admins GROUP BY 1 HAVING count(*) > 1)
    OR EXISTS (SELECT lower(btrim(username)) FROM public.admins GROUP BY 1 HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Admin IAM preflight failed: canonical identity duplicates';
  END IF;
END $$;

ALTER TABLE public.admins
  ADD COLUMN status text NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN auth_version integer NOT NULL DEFAULT 1,
  ADD COLUMN created_by uuid REFERENCES public.admins(id) ON DELETE RESTRICT,
  ADD COLUMN activated_at timestamptz,
  ADD COLUMN last_login_at timestamptz;
-- Preserve historical timestamps while backfilling only the new lifecycle field.
ALTER TABLE public.admins DISABLE TRIGGER trg_admins_updated_at;
UPDATE public.admins SET status = 'DISABLED' WHERE is_deleted;
ALTER TABLE public.admins ENABLE TRIGGER trg_admins_updated_at;
ALTER TABLE public.admins ALTER COLUMN status SET DEFAULT 'PENDING_ACTIVATION';
ALTER TABLE public.admins ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE public.admins
  ADD CONSTRAINT admins_status_ck CHECK (status IN ('PENDING_ACTIVATION','ACTIVE','SUSPENDED','DISABLED')),
  ADD CONSTRAINT admins_auth_version_ck CHECK (auth_version > 0),
  ADD CONSTRAINT admins_active_password_ck CHECK (status <> 'ACTIVE' OR (password_hash IS NOT NULL AND btrim(password_hash) <> '')),
  ADD CONSTRAINT admins_pending_password_ck CHECK (status <> 'PENDING_ACTIVATION' OR password_hash IS NULL),
  ADD CONSTRAINT admins_deleted_status_ck CHECK (NOT is_deleted OR status = 'DISABLED'),
  ADD CONSTRAINT admins_email_canonical_ck CHECK (email = lower(btrim(email)) AND email <> ''),
  ADD CONSTRAINT admins_username_canonical_ck CHECK (username = btrim(username) AND username <> '' AND username !~ '[[:space:]@]');
CREATE UNIQUE INDEX admins_email_canonical_uq ON public.admins (lower(btrim(email)));
CREATE UNIQUE INDEX admins_username_canonical_uq ON public.admins (lower(btrim(username)));
CREATE INDEX admins_created_by_idx ON public.admins(created_by);

CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),
  name text NOT NULL CHECK (btrim(name) <> ''),
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roles_super_admin_system_ck CHECK (code <> 'SUPER_ADMIN' OR is_system)
);
CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON public.roles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  resource text NOT NULL,
  action text NOT NULL,
  description text NOT NULL,
  CONSTRAINT permissions_code_ck CHECK (code ~ '^[a-z_]+(\.[a-z_]+)+$' AND code = resource || '.' || action)
);
CREATE TABLE public.admin_roles (
  admin_id uuid NOT NULL REFERENCES public.admins(id) ON DELETE RESTRICT,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  assigned_by uuid REFERENCES public.admins(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_id,role_id)
);
CREATE INDEX admin_roles_role_admin_idx ON public.admin_roles(role_id,admin_id);
CREATE INDEX admin_roles_assigned_by_idx ON public.admin_roles(assigned_by);
CREATE TABLE public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE RESTRICT,
  PRIMARY KEY (role_id,permission_id)
);
CREATE INDEX role_permissions_permission_role_idx ON public.role_permissions(permission_id,role_id);

INSERT INTO public.roles(code,name,description,is_system)
VALUES ('SUPER_ADMIN','Super Admin','Protected system role; explicit operator bootstrap only',true);
INSERT INTO public.permissions(code,resource,action,description) VALUES
  ('dashboard.read','dashboard','read','View administrative overview'),
  ('users.read','users','read','Read learner records, overview and progress'),
  ('users.create','users','create','Create learner accounts'),
  ('users.update','users','update','Edit learner profile and notes; status needs users.lock'),
  ('users.lock','users','lock','Ban or unban learner accounts'),
  ('users.delete','users','delete','Soft-delete learner accounts'),
  ('vocabulary.read','vocabulary','read','Read words, groups, collections, lessons and relationships'),
  ('vocabulary.create','vocabulary','create','Create vocabulary resources and sections'),
  ('vocabulary.update','vocabulary','update','Edit, reorder, activate and manage relationships'),
  ('vocabulary.delete','vocabulary','delete','Delete vocabulary resources or sections'),
  ('vocabulary.restore','vocabulary','restore','Restore deleted vocabulary resources'),
  ('toeic.read','toeic','read','Read exams, groups, questions and passages'),
  ('toeic.create','toeic','create','Create exams, groups, questions and passages'),
  ('toeic.update','toeic','update','Edit, activate, reorder and manage exam relationships'),
  ('toeic.delete','toeic','delete','Delete TOEIC resources including child questions'),
  ('toeic.restore','toeic','restore','Restore deleted exams'),
  ('toeic.import','toeic','import','Parse and import question drafts; persisted creation also needs toeic.create'),
  ('toeic.attempts.read','toeic.attempts','read','Read administrative attempts and learner results'),
  ('toeic.comments.moderate','toeic.comments','moderate','Delete comments by other authors through shared community route'),
  ('dictation.read','dictation','read','Read dictation lessons, hierarchy and draft split preview'),
  ('dictation.create','dictation','create','Create dictation lessons, topics and sections'),
  ('dictation.update','dictation','update','Edit lessons, segments, topics and sections'),
  ('dictation.delete','dictation','delete','Delete dictation resources'),
  ('arena.read','arena','read','Read arena dashboard, matches, players and rooms'),
  ('arena.rooms.close','arena.rooms','close','Close an arena room'),
  ('arena.settings.read','arena.settings','read','Read arena operational settings'),
  ('arena.settings.update','arena.settings','update','Change arena operational settings'),
  ('games.read','games','read','Read game catalogue'),
  ('games.update','games','update','Edit or reorder game catalogue'),
  ('games.settings.read','games.settings','read','Read game-specific settings'),
  ('games.settings.update','games.settings','update','Edit game-specific settings'),
  ('games.results.read','games.results','read','Read game results, statistics and top scores'),
  ('media_library.read','media_library','read','Use admin media library together with domain.read'),
  ('media.upload','media','upload','Upload a standalone managed media object'),
  ('media.delete','media','delete','Delete a standalone managed media object'),
  ('audio.read','audio','read','Read audio voices and processor metadata'),
  ('audio.generate','audio','generate','Generate or enqueue audio; domain write needs domain.update'),
  ('audio.upload','audio','upload','Upload and attach audio; also requires domain.update'),
  ('audio.jobs.read','audio.jobs','read','Read audio jobs and SSE events across audio module'),
  ('audio.workers.read','audio.workers','read','Read global audio worker config and metrics'),
  ('audio.workers.update','audio.workers','update','Change global audio worker configuration'),
  ('asr.read','asr','read','Read transcription job status and health'),
  ('asr.create','asr','create','Create transcription or analyze-audio work'),
  ('infrastructure.read','infrastructure','read','Read infrastructure service status'),
  ('ai_import.read','ai_import','read','Read prepared AI import jobs and results'),
  ('ai_import.create','ai_import','create','Start AI PDF parsing/bundle jobs, not final database import'),
  ('ai_import.learning.read','ai_import.learning','read','Read AI correction-learning status'),
  ('ai_import.learning.review','ai_import.learning','review','Review correction samples'),
  ('ai_import.learning.retry','ai_import.learning','retry','Retry delivery of correction-learning work'),
  ('publication.read','publication','read','Read publication state and preview with domain.read'),
  ('publication.validate','publication','validate','Run and retain publication validation with domain.update'),
  ('publication.publish','publication','publish','Publish content with domain.update'),
  ('publication.unpublish','publication','unpublish','Unpublish content with domain.update'),
  ('settings.read','settings','read','Read site settings and timezone options'),
  ('settings.update','settings','update','Edit site settings'),
  ('settings.landing.read','settings.landing','read','Read landing page settings'),
  ('settings.landing.update','settings.landing','update','Edit landing page settings'),
  ('settings.recommendations.read','settings.recommendations','read','Read or preview recommendation rules'),
  ('settings.recommendations.update','settings.recommendations','update','Save recommendation rules'),
  ('audit.read','audit','read','Read administrative activity logs, filters and statistics'),
  ('content_quality.read','content_quality','read','Read cross-domain content quality results'),
  ('content_quality.scan','content_quality','scan','Run cross-domain content quality scan'),
  ('learning_mistakes.read','learning_mistakes','read','Read global learning mistake statistics'),
  ('admins.read','admins','read','Read administrator accounts (future IAM)'),
  ('admins.create','admins','create','Invite an administrator (future IAM)'),
  ('admins.update','admins','update','Edit administrator metadata or role assignments (future IAM)'),
  ('admins.lock','admins','lock','Suspend/disable/unlock administrators (future IAM)'),
  ('admins.reinvite','admins','reinvite','Reissue an activation invitation (future IAM)'),
  ('roles.read','roles','read','Read roles and permission matrix (future IAM)'),
  ('roles.manage','roles','manage','Edit ordinary roles and their permissions (future IAM)');
INSERT INTO public.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM public.roles r CROSS JOIN public.permissions p WHERE r.code='SUPER_ADMIN';
-- admin_roles intentionally remains empty. No account is selected or elevated.
