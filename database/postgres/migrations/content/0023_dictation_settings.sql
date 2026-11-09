-- Global Dictation practice settings edited from the admin "Cấu hình Dictation" page.
-- One row ('global'); config is normalized by @repo/shared-types/dictation-settings.
-- revision gives optimistic concurrency between two admins editing at once.
CREATE TABLE public.dictation_settings (
  key text PRIMARY KEY CHECK (key = 'global'),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(config) = 'object'),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
