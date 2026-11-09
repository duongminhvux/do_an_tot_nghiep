-- Data foundation only: no invitation endpoint, token issuance or email sending.
CREATE TABLE public.admin_activation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.admins(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 minutes'),
  used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid REFERENCES public.admins(id) ON DELETE RESTRICT,
  CONSTRAINT admin_activation_ttl_ck CHECK (expires_at = created_at + interval '60 minutes'),
  CONSTRAINT admin_activation_used_at_ck CHECK (used_at IS NULL OR used_at >= created_at),
  CONSTRAINT admin_activation_revoked_at_ck CHECK (revoked_at IS NULL OR revoked_at >= created_at),
  CONSTRAINT admin_activation_terminal_ck CHECK (used_at IS NULL OR revoked_at IS NULL)
);
-- Expired rows retain the slot until explicitly revoked during a future reinvite transaction.
-- now() must not appear in a partial unique-index predicate.
CREATE UNIQUE INDEX admin_activation_open_admin_uq ON public.admin_activation_tokens(admin_id)
WHERE used_at IS NULL AND revoked_at IS NULL;
CREATE INDEX admin_activation_expires_idx ON public.admin_activation_tokens(expires_at);
CREATE INDEX admin_activation_created_by_idx ON public.admin_activation_tokens(created_by);
