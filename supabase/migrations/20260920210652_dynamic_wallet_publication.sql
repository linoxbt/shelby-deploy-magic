-- User wallets remain in Dynamic/the wallet provider. No connected private keys
-- enter ShelbyHost. A stored build waits for a user-authorized Aptos receipt.
ALTER TABLE public.shelby_projects ADD COLUMN signer_mode text NOT NULL DEFAULT 'managed' CHECK(signer_mode IN ('managed','connected'));
ALTER TABLE public.shelby_build_jobs ADD COLUMN release jsonb;
ALTER TABLE public.shelby_deployments DROP CONSTRAINT shelby_deployments_status_check;
ALTER TABLE public.shelby_deployments ADD CONSTRAINT shelby_deployments_status_check CHECK(status IN ('queued','running','awaiting_signature','ready','succeeded','failed'));
CREATE TABLE public.shelby_payment_receipts(hash text PRIMARY KEY,project_id uuid REFERENCES public.shelby_projects(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.shelby_payment_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shelby_payment_receipts FROM anon,authenticated;
GRANT ALL ON public.shelby_payment_receipts TO service_role;
INSERT INTO public.shelby_payment_receipts(hash,project_id) SELECT payment_tx_hash,id FROM public.shelby_projects WHERE payment_tx_hash IS NOT NULL ON CONFLICT DO NOTHING;
CREATE FUNCTION public.shelby_wait_signature(p_id uuid,p_lease uuid,p_release jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM public.shelby_update_job(p_id,p_lease);
 IF NOT EXISTS(SELECT 1 FROM public.shelby_deployments d JOIN public.shelby_projects p ON p.id=d.project_id WHERE d.id=p_id AND d.stage='publishing' AND p.signer_mode='connected') THEN RAISE EXCEPTION 'Release is not ready for wallet approval'; END IF;
 IF coalesce(p_release->>'hash','')!~'^[a-f0-9]{64}$' OR coalesce(jsonb_array_length(p_release->'manifest'),0)<1 THEN RAISE EXCEPTION 'Invalid stored release'; END IF;
 UPDATE public.shelby_build_jobs SET release=p_release,lease_token=NULL,lease_until=NULL WHERE deployment_id=p_id;
 UPDATE public.shelby_deployments SET status='awaiting_signature',content_hash=p_release->>'hash',storage_backend='shelby',shelby_owner_address=p_release->>'owner',shelby_manifest=p_release->'manifest',shelby_manifest_url=p_release->>'manifestUrl',shelby_uploaded_at=clock_timestamp() WHERE id=p_id;
END $$;
CREATE FUNCTION public.shelby_wallet_publish(p_id uuid,p_owner text,p_payment text,p_registry text) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.shelby_projects; j public.shelby_build_jobs; token uuid; receipt_project uuid;
BEGIN
 SELECT * INTO p FROM public.shelby_projects WHERE id=(SELECT project_id FROM public.shelby_deployments WHERE id=p_id) AND owner_id=p_owner AND signer_mode='connected' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
 SELECT * INTO j FROM public.shelby_build_jobs WHERE deployment_id=p_id FOR UPDATE;
 PERFORM 1 FROM public.shelby_deployments WHERE id=p_id AND status='awaiting_signature' FOR UPDATE;
 IF NOT FOUND OR j.release IS NULL THEN RAISE EXCEPTION 'Deployment is not awaiting wallet approval'; END IF;
 IF p.desired_deployment_id<>p_id THEN RAISE EXCEPTION 'A newer deployment or rollback superseded this build'; END IF;
 INSERT INTO public.shelby_payment_receipts(hash,project_id) VALUES(p_payment,p.id) ON CONFLICT DO NOTHING;
 SELECT project_id INTO receipt_project FROM public.shelby_payment_receipts WHERE hash=p_payment;
 IF receipt_project IS DISTINCT FROM p.id THEN RAISE EXCEPTION 'Payment receipt was already used by another project'; END IF;
 IF p.payment_tx_hash IS NOT NULL AND p.payment_tx_hash<>p_payment THEN RAISE EXCEPTION 'Use the existing project fee receipt'; END IF;
 UPDATE public.shelby_projects SET payment_tx_hash=p_payment WHERE id=p.id;
 token:=gen_random_uuid();
 UPDATE public.shelby_build_jobs SET lease_token=token,lease_until=clock_timestamp()+interval '180 seconds' WHERE deployment_id=p_id;
 UPDATE public.shelby_deployments SET status='running',payment_tx_hash=p_payment,registry_tx_hash=p_registry WHERE id=p_id;
 RETURN public.shelby_publish(p_id,token,j.release);
END $$;
REVOKE ALL ON FUNCTION public.shelby_wait_signature(uuid,uuid,jsonb),public.shelby_wallet_publish(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shelby_wait_signature(uuid,uuid,jsonb),public.shelby_wallet_publish(uuid,text,text,text) TO service_role;

CREATE FUNCTION public.shelby_record_fee(p_project uuid,p_owner text,p_payment text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.shelby_projects; receipt_project uuid;
BEGIN
 SELECT * INTO p FROM public.shelby_projects WHERE id=p_project AND owner_id=p_owner AND signer_mode='connected' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
 IF p.payment_tx_hash IS NOT NULL AND p.payment_tx_hash<>p_payment THEN RAISE EXCEPTION 'Project already has a fee receipt'; END IF;
 INSERT INTO public.shelby_payment_receipts(hash,project_id) VALUES(p_payment,p.id) ON CONFLICT DO NOTHING;
 SELECT project_id INTO receipt_project FROM public.shelby_payment_receipts WHERE hash=p_payment;
 IF receipt_project IS DISTINCT FROM p.id THEN RAISE EXCEPTION 'Payment already used by another project'; END IF;
 UPDATE public.shelby_projects SET payment_tx_hash=p_payment WHERE id=p.id;
END $$;
REVOKE ALL ON FUNCTION public.shelby_record_fee(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shelby_record_fee(uuid,text,text) TO service_role;
