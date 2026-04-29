CREATE TABLE IF NOT EXISTS public.shelby_github_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  github_user_id bigint NOT NULL,
  login text NOT NULL,
  name text,
  avatar_url text,
  html_url text,
  account_type text NOT NULL DEFAULT 'User',
  scopes text[] NOT NULL DEFAULT '{}',
  access_token_encrypted text NOT NULL,
  token_last_four text,
  connected_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (owner_id, github_user_id)
);

ALTER TABLE public.shelby_github_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their Shelby GitHub account"
ON public.shelby_github_accounts
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Users can create their Shelby GitHub account"
ON public.shelby_github_accounts
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their Shelby GitHub account"
ON public.shelby_github_accounts
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete their Shelby GitHub account"
ON public.shelby_github_accounts
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

CREATE TRIGGER update_shelby_github_accounts_updated_at
BEFORE UPDATE ON public.shelby_github_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_shelby_updated_at();

CREATE TABLE IF NOT EXISTS public.shelby_github_oauth_states (
  state text NOT NULL PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  redirect_to text NOT NULL DEFAULT '/dashboard',
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.shelby_github_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their Shelby GitHub OAuth states"
ON public.shelby_github_oauth_states
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Users can create their Shelby GitHub OAuth states"
ON public.shelby_github_oauth_states
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete their Shelby GitHub OAuth states"
ON public.shelby_github_oauth_states
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_shelby_github_accounts_owner_id
ON public.shelby_github_accounts(owner_id);

CREATE INDEX IF NOT EXISTS idx_shelby_github_oauth_states_owner_id
ON public.shelby_github_oauth_states(owner_id);

CREATE INDEX IF NOT EXISTS idx_shelby_github_oauth_states_expires_at
ON public.shelby_github_oauth_states(expires_at);