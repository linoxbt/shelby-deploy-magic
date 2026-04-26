CREATE POLICY "Authenticated users can view Shelby projects"
ON public.shelby_projects
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create Shelby projects"
ON public.shelby_projects
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update Shelby projects"
ON public.shelby_projects
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete Shelby projects"
ON public.shelby_projects
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can view Shelby deployments"
ON public.shelby_deployments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create Shelby deployments"
ON public.shelby_deployments
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update Shelby deployments"
ON public.shelby_deployments
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can view Shelby domain mappings"
ON public.shelby_domain_mappings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Public can resolve verified Shelby domains"
ON public.shelby_domain_mappings
FOR SELECT
TO anon
USING (status = 'verified');

CREATE POLICY "Authenticated users can create Shelby domain mappings"
ON public.shelby_domain_mappings
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update Shelby domain mappings"
ON public.shelby_domain_mappings
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete Shelby domain mappings"
ON public.shelby_domain_mappings
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can view Shelby GitHub connections"
ON public.shelby_github_connections
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create Shelby GitHub connections"
ON public.shelby_github_connections
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update Shelby GitHub connections"
ON public.shelby_github_connections
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete Shelby GitHub connections"
ON public.shelby_github_connections
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can view Shelby wallets"
ON public.shelby_wallet_connections
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create Shelby wallets"
ON public.shelby_wallet_connections
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update Shelby wallets"
ON public.shelby_wallet_connections
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete Shelby wallets"
ON public.shelby_wallet_connections
FOR DELETE
TO authenticated
USING (true);