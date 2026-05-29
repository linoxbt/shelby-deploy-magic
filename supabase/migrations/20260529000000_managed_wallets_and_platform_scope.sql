ALTER TABLE public.shelby_wallet_connections
  ADD COLUMN IF NOT EXISTS public_key text,
  ADD COLUMN IF NOT EXISTS private_key_encrypted text,
  ADD COLUMN IF NOT EXISTS managed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disconnected_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_shelby_wallet_connections_owner_status
ON public.shelby_wallet_connections(owner_id, status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS shelby_wallet_connections_owner_managed_aptos_key
ON public.shelby_wallet_connections(owner_id, chain, wallet_provider)
WHERE managed = true AND status = 'connected';

ALTER TABLE public.shelby_deployments
  DROP CONSTRAINT IF EXISTS shelby_deployments_trigger_check;

ALTER TABLE public.shelby_deployments
  ADD CONSTRAINT shelby_deployments_trigger_check
  CHECK (trigger IN ('manual', 'settings', 'github-push', 'github-pr', 'domain', 'hash'));

CREATE TABLE IF NOT EXISTS public.shelby_project_env_vars (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.shelby_projects(id) ON DELETE CASCADE,
  key text NOT NULL,
  value_encrypted text NOT NULL DEFAULT '',
  target text NOT NULL DEFAULT 'production' CHECK (target IN ('production', 'preview', 'development')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, key, target)
);

ALTER TABLE public.shelby_project_env_vars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage Shelby env vars" ON public.shelby_project_env_vars;
CREATE POLICY "Service role can manage Shelby env vars"
ON public.shelby_project_env_vars
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.shelby_build_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.shelby_projects(id) ON DELETE CASCADE,
  deployment_id uuid REFERENCES public.shelby_deployments(id) ON DELETE CASCADE,
  stream text NOT NULL DEFAULT 'build',
  line text NOT NULL,
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shelby_build_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage Shelby build logs" ON public.shelby_build_logs;
CREATE POLICY "Service role can manage Shelby build logs"
ON public.shelby_build_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.shelby_preview_deployments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.shelby_projects(id) ON DELETE CASCADE,
  pull_request_number integer,
  branch text NOT NULL,
  commit_sha text,
  content_hash text NOT NULL DEFAULT '',
  preview_slug text,
  preview_url text NOT NULL,
  storage_backend text NOT NULL DEFAULT 'supabase',
  shelby_owner_address text,
  shelby_manifest jsonb NOT NULL DEFAULT '[]'::jsonb,
  shelby_uploaded_at timestamptz,
  shelby_upload_error text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'building', 'ready', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shelby_preview_deployments
  ADD COLUMN IF NOT EXISTS content_hash text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS preview_slug text,
  ADD COLUMN IF NOT EXISTS storage_backend text NOT NULL DEFAULT 'supabase',
  ADD COLUMN IF NOT EXISTS shelby_owner_address text,
  ADD COLUMN IF NOT EXISTS shelby_manifest jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS shelby_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS shelby_upload_error text;

CREATE UNIQUE INDEX IF NOT EXISTS shelby_preview_deployments_preview_slug_key
ON public.shelby_preview_deployments(preview_slug)
WHERE preview_slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS shelby_preview_deployments_project_pr_key
ON public.shelby_preview_deployments(project_id, pull_request_number)
WHERE pull_request_number IS NOT NULL;

ALTER TABLE public.shelby_preview_deployments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage Shelby preview deployments" ON public.shelby_preview_deployments;
CREATE POLICY "Service role can manage Shelby preview deployments"
ON public.shelby_preview_deployments
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
