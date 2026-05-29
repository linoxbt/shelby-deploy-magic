-- Product hardening for the Vercel-hosted ShelbyHost control plane.
-- The production app authorizes users with Privy in Vercel functions, then
-- uses the Supabase service role server-side. Direct browser table writes are
-- intentionally removed; public deployed assets remain readable from Storage.

DROP POLICY IF EXISTS "Users can view their Shelby projects" ON public.shelby_projects;
DROP POLICY IF EXISTS "Users can create their Shelby projects" ON public.shelby_projects;
DROP POLICY IF EXISTS "Users can update their Shelby projects" ON public.shelby_projects;
DROP POLICY IF EXISTS "Users can delete their Shelby projects" ON public.shelby_projects;

DROP POLICY IF EXISTS "Users can view their Shelby deployments" ON public.shelby_deployments;
DROP POLICY IF EXISTS "Users can create deployments for their Shelby projects" ON public.shelby_deployments;
DROP POLICY IF EXISTS "Users can update deployments for their Shelby projects" ON public.shelby_deployments;

DROP POLICY IF EXISTS "Users can view their Shelby domain mappings" ON public.shelby_domain_mappings;
DROP POLICY IF EXISTS "Users can create domains for their Shelby projects" ON public.shelby_domain_mappings;
DROP POLICY IF EXISTS "Users can update domains for their Shelby projects" ON public.shelby_domain_mappings;
DROP POLICY IF EXISTS "Users can delete domains for their Shelby projects" ON public.shelby_domain_mappings;
DROP POLICY IF EXISTS "Public can resolve verified Shelby domains" ON public.shelby_domain_mappings;

DROP POLICY IF EXISTS "Users can view their Shelby GitHub connections" ON public.shelby_github_connections;
DROP POLICY IF EXISTS "Users can create GitHub connections for their Shelby projects" ON public.shelby_github_connections;
DROP POLICY IF EXISTS "Users can update GitHub connections for their Shelby projects" ON public.shelby_github_connections;
DROP POLICY IF EXISTS "Users can delete GitHub connections for their Shelby projects" ON public.shelby_github_connections;

DROP POLICY IF EXISTS "Users can view their Shelby wallets" ON public.shelby_wallet_connections;
DROP POLICY IF EXISTS "Users can create their Shelby wallets" ON public.shelby_wallet_connections;
DROP POLICY IF EXISTS "Users can update their Shelby wallets" ON public.shelby_wallet_connections;
DROP POLICY IF EXISTS "Users can delete their Shelby wallets" ON public.shelby_wallet_connections;

DROP POLICY IF EXISTS "Users can view their Shelby GitHub account" ON public.shelby_github_accounts;
DROP POLICY IF EXISTS "Users can create their Shelby GitHub account" ON public.shelby_github_accounts;
DROP POLICY IF EXISTS "Users can update their Shelby GitHub account" ON public.shelby_github_accounts;
DROP POLICY IF EXISTS "Users can delete their Shelby GitHub account" ON public.shelby_github_accounts;

DROP POLICY IF EXISTS "Users can view their Shelby GitHub OAuth states" ON public.shelby_github_oauth_states;
DROP POLICY IF EXISTS "Users can create their Shelby GitHub OAuth states" ON public.shelby_github_oauth_states;
DROP POLICY IF EXISTS "Users can delete their Shelby GitHub OAuth states" ON public.shelby_github_oauth_states;

ALTER TABLE public.shelby_projects
  ALTER COLUMN owner_id TYPE text USING owner_id::text,
  ALTER COLUMN owner_id DROP DEFAULT;

ALTER TABLE public.shelby_wallet_connections
  ALTER COLUMN owner_id TYPE text USING owner_id::text,
  ALTER COLUMN owner_id DROP DEFAULT;

ALTER TABLE public.shelby_github_accounts
  ALTER COLUMN owner_id TYPE text USING owner_id::text,
  ALTER COLUMN owner_id DROP DEFAULT;

ALTER TABLE public.shelby_github_oauth_states
  ALTER COLUMN owner_id TYPE text USING owner_id::text,
  ALTER COLUMN owner_id DROP DEFAULT;

ALTER TABLE public.shelby_projects
  ADD COLUMN IF NOT EXISTS payment_tx_hash text,
  ADD COLUMN IF NOT EXISTS registry_tx_hash text,
  ADD COLUMN IF NOT EXISTS storage_backend text DEFAULT 'supabase',
  ADD COLUMN IF NOT EXISTS shelby_owner_address text,
  ADD COLUMN IF NOT EXISTS shelby_manifest jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS shelby_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS shelby_upload_error text;

ALTER TABLE public.shelby_deployments
  ADD COLUMN IF NOT EXISTS storage_backend text DEFAULT 'supabase',
  ADD COLUMN IF NOT EXISTS shelby_owner_address text,
  ADD COLUMN IF NOT EXISTS shelby_manifest jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS shelby_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS shelby_upload_error text;

ALTER TABLE public.shelby_github_connections
  ADD COLUMN IF NOT EXISTS deploy_token_hash text,
  ADD COLUMN IF NOT EXISTS deploy_token_last_four text,
  ADD COLUMN IF NOT EXISTS github_installation_id text,
  ADD COLUMN IF NOT EXISTS automation_status text;

ALTER TABLE public.shelby_domain_mappings
  DROP CONSTRAINT IF EXISTS shelby_domain_mappings_status_check;

ALTER TABLE public.shelby_domain_mappings
  ADD CONSTRAINT shelby_domain_mappings_status_check
  CHECK (status IN ('active', 'pending', 'failed'));

UPDATE public.shelby_domain_mappings SET status = 'active' WHERE status = 'verified';

DROP INDEX IF EXISTS shelby_wallet_connections_chain_address_key;
ALTER TABLE public.shelby_wallet_connections
  DROP CONSTRAINT IF EXISTS shelby_wallet_connections_chain_address_key;

CREATE UNIQUE INDEX IF NOT EXISTS shelby_wallet_connections_owner_chain_address_key
ON public.shelby_wallet_connections(owner_id, chain, address);

CREATE INDEX IF NOT EXISTS idx_shelby_projects_owner_id
ON public.shelby_projects(owner_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('shelby_nodes', 'shelby_nodes', true, 52428800)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 52428800;

DROP POLICY IF EXISTS "Public can read Shelby deployed assets" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage Shelby deployed assets" ON storage.objects;

CREATE POLICY "Public can read Shelby deployed assets"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'shelby_nodes');

CREATE POLICY "Service role can manage Shelby deployed assets"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'shelby_nodes')
WITH CHECK (bucket_id = 'shelby_nodes');
