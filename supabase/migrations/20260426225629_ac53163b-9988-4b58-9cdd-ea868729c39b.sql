ALTER TABLE public.shelby_projects
ADD COLUMN owner_id UUID NOT NULL DEFAULT auth.uid();

ALTER TABLE public.shelby_wallet_connections
ADD COLUMN owner_id UUID NOT NULL DEFAULT auth.uid();

DROP POLICY IF EXISTS "Authenticated users can view Shelby projects" ON public.shelby_projects;
DROP POLICY IF EXISTS "Authenticated users can create Shelby projects" ON public.shelby_projects;
DROP POLICY IF EXISTS "Authenticated users can update Shelby projects" ON public.shelby_projects;
DROP POLICY IF EXISTS "Authenticated users can delete Shelby projects" ON public.shelby_projects;
DROP POLICY IF EXISTS "Authenticated users can view Shelby deployments" ON public.shelby_deployments;
DROP POLICY IF EXISTS "Authenticated users can create Shelby deployments" ON public.shelby_deployments;
DROP POLICY IF EXISTS "Authenticated users can update Shelby deployments" ON public.shelby_deployments;
DROP POLICY IF EXISTS "Authenticated users can view Shelby domain mappings" ON public.shelby_domain_mappings;
DROP POLICY IF EXISTS "Authenticated users can create Shelby domain mappings" ON public.shelby_domain_mappings;
DROP POLICY IF EXISTS "Authenticated users can update Shelby domain mappings" ON public.shelby_domain_mappings;
DROP POLICY IF EXISTS "Authenticated users can delete Shelby domain mappings" ON public.shelby_domain_mappings;
DROP POLICY IF EXISTS "Authenticated users can view Shelby GitHub connections" ON public.shelby_github_connections;
DROP POLICY IF EXISTS "Authenticated users can create Shelby GitHub connections" ON public.shelby_github_connections;
DROP POLICY IF EXISTS "Authenticated users can update Shelby GitHub connections" ON public.shelby_github_connections;
DROP POLICY IF EXISTS "Authenticated users can delete Shelby GitHub connections" ON public.shelby_github_connections;
DROP POLICY IF EXISTS "Authenticated users can view Shelby wallets" ON public.shelby_wallet_connections;
DROP POLICY IF EXISTS "Authenticated users can create Shelby wallets" ON public.shelby_wallet_connections;
DROP POLICY IF EXISTS "Authenticated users can update Shelby wallets" ON public.shelby_wallet_connections;
DROP POLICY IF EXISTS "Authenticated users can delete Shelby wallets" ON public.shelby_wallet_connections;

CREATE POLICY "Users can view their Shelby projects"
ON public.shelby_projects
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Users can create their Shelby projects"
ON public.shelby_projects
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their Shelby projects"
ON public.shelby_projects
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete their Shelby projects"
ON public.shelby_projects
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Users can view their Shelby deployments"
ON public.shelby_deployments
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.shelby_projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Users can create deployments for their Shelby projects"
ON public.shelby_deployments
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.shelby_projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Users can update deployments for their Shelby projects"
ON public.shelby_deployments
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.shelby_projects p WHERE p.id = project_id AND p.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.shelby_projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Users can view their Shelby domain mappings"
ON public.shelby_domain_mappings
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.shelby_projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Users can create domains for their Shelby projects"
ON public.shelby_domain_mappings
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.shelby_projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Users can update domains for their Shelby projects"
ON public.shelby_domain_mappings
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.shelby_projects p WHERE p.id = project_id AND p.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.shelby_projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Users can delete domains for their Shelby projects"
ON public.shelby_domain_mappings
FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.shelby_projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Users can view their Shelby GitHub connections"
ON public.shelby_github_connections
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.shelby_projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Users can create GitHub connections for their Shelby projects"
ON public.shelby_github_connections
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.shelby_projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Users can update GitHub connections for their Shelby projects"
ON public.shelby_github_connections
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.shelby_projects p WHERE p.id = project_id AND p.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.shelby_projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Users can delete GitHub connections for their Shelby projects"
ON public.shelby_github_connections
FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.shelby_projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Users can view their Shelby wallets"
ON public.shelby_wallet_connections
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Users can create their Shelby wallets"
ON public.shelby_wallet_connections
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their Shelby wallets"
ON public.shelby_wallet_connections
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete their Shelby wallets"
ON public.shelby_wallet_connections
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());