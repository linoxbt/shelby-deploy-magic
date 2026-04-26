CREATE TABLE public.shelby_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  framework TEXT NOT NULL DEFAULT 'vite',
  build_output TEXT NOT NULL DEFAULT 'dist',
  content_hash TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'drag-drop' CHECK (source IN ('drag-drop', 'github')),
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'processing', 'failed')),
  latest_version_url TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'aptos' CHECK (chain IN ('aptos', 'shelby')),
  wallet_address TEXT,
  files JSONB NOT NULL DEFAULT '[]'::jsonb,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  deployed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.shelby_deployments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.shelby_projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'succeeded', 'failed')),
  trigger TEXT NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual', 'settings', 'github-push', 'domain', 'hash')),
  version_url TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.shelby_domain_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.shelby_projects(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT 'shelbyhost.pages.dev',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('verified', 'pending', 'failed')),
  kv_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.shelby_github_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.shelby_projects(id) ON DELETE CASCADE,
  account TEXT NOT NULL,
  repository TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  workflow_file TEXT NOT NULL DEFAULT '.github/workflows/shelbyhost-deploy.yml',
  webhook_status TEXT NOT NULL DEFAULT 'active' CHECK (webhook_status IN ('active', 'paused', 'failed')),
  last_push_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, repository, branch)
);

CREATE TABLE public.shelby_wallet_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chain TEXT NOT NULL CHECK (chain IN ('aptos', 'shelby')),
  wallet_provider TEXT NOT NULL,
  address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(chain, address)
);

CREATE INDEX idx_shelby_projects_slug ON public.shelby_projects(slug);
CREATE INDEX idx_shelby_projects_status ON public.shelby_projects(status);
CREATE INDEX idx_shelby_deployments_project_created ON public.shelby_deployments(project_id, created_at DESC);
CREATE INDEX idx_shelby_domain_mappings_domain ON public.shelby_domain_mappings(domain);
CREATE INDEX idx_shelby_domain_mappings_kv_key ON public.shelby_domain_mappings(kv_key);

CREATE OR REPLACE FUNCTION public.update_shelby_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_shelby_projects_updated_at
BEFORE UPDATE ON public.shelby_projects
FOR EACH ROW
EXECUTE FUNCTION public.update_shelby_updated_at();

CREATE TRIGGER update_shelby_domain_mappings_updated_at
BEFORE UPDATE ON public.shelby_domain_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_shelby_updated_at();

CREATE TRIGGER update_shelby_github_connections_updated_at
BEFORE UPDATE ON public.shelby_github_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_shelby_updated_at();

CREATE TRIGGER update_shelby_wallet_connections_updated_at
BEFORE UPDATE ON public.shelby_wallet_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_shelby_updated_at();

ALTER TABLE public.shelby_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shelby_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shelby_domain_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shelby_github_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shelby_wallet_connections ENABLE ROW LEVEL SECURITY;