DO $$
DECLARE p uuid; a uuid; b uuid; c uuid; j public.shelby_build_jobs; promoted boolean; s text;
BEGIN
 INSERT INTO shelby_projects(name,slug,owner_id,content_hash,latest_version_url) VALUES('Test','pipeline-test','test-owner','','') RETURNING id INTO p;
 a:=shelby_enqueue(p,'test-owner','{"kind":"upload"}','{}','{}','delivery-1');
 IF a<>shelby_enqueue(p,'test-owner','{"kind":"upload"}','{}','{}','delivery-1') THEN RAISE EXCEPTION 'event not deduplicated'; END IF;
 SELECT * INTO j FROM shelby_claim('test-worker');
 IF j.deployment_id<>a THEN RAISE EXCEPTION 'wrong claim'; END IF;
 BEGIN PERFORM shelby_update_job(a,j.lease_token,'publishing');RAISE EXCEPTION 'invalid transition accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='invalid transition accepted' THEN RAISE; END IF; END;
 FOREACH s IN ARRAY ARRAY['cloning','installing','building','validating','uploading','publishing'] LOOP PERFORM shelby_update_job(a,j.lease_token,s); END LOOP;
 PERFORM shelby_update_job(a,j.lease_token,NULL,'{"registry_tx_hash":"fixture-confirmed"}');
 promoted:=shelby_publish(a,j.lease_token,jsonb_build_object('hash',repeat('a',64),'owner','0x123','manifest',jsonb_build_array(jsonb_build_object('path','/index.html','size',17,'type','text/html')),'manifestUrl','https://fixture/manifest','versionUrl','https://fixture/version','size',17,'files','[]'::jsonb));
 IF NOT promoted OR (SELECT active_deployment_id FROM shelby_projects WHERE id=p)<>a THEN RAISE EXCEPTION 'publish failed'; END IF;
 b:=shelby_enqueue(p,'test-owner','{}','{}','{}'); SELECT * INTO j FROM shelby_claim('test-worker');
 PERFORM shelby_update_job(b,j.lease_token,'cloning');PERFORM shelby_fail(b,j.lease_token,'fixture clone failed',128);
 IF (SELECT active_deployment_id FROM shelby_projects WHERE id=p)<>a THEN RAISE EXCEPTION 'failure replaced production'; END IF;
 IF (SELECT failed_stage FROM shelby_deployments WHERE id=b)<>'cloning' THEN RAISE EXCEPTION 'failure stage lost'; END IF;
 BEGIN PERFORM shelby_rollback(p,'intruder',a);RAISE EXCEPTION 'ownership bypass'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='ownership bypass' THEN RAISE; END IF; END;
 c:=shelby_enqueue(p,'test-owner','{}','{}','{}'); SELECT * INTO j FROM shelby_claim('test-worker');
 PERFORM shelby_rollback(p,'test-owner',a);
 FOREACH s IN ARRAY ARRAY['cloning','installing','building','validating','uploading','publishing'] LOOP PERFORM shelby_update_job(c,j.lease_token,s); END LOOP;
 PERFORM shelby_update_job(c,j.lease_token,NULL,'{"registry_tx_hash":"fixture-confirmed"}');
 promoted:=shelby_publish(c,j.lease_token,jsonb_build_object('hash',repeat('c',64),'owner','0x123','manifest',jsonb_build_array(jsonb_build_object('path','/index.html','size',29,'type','text/html')),'manifestUrl','https://fixture/manifest','versionUrl','https://fixture/version','size',29,'files','[]'::jsonb));
 IF promoted THEN RAISE EXCEPTION 'stale build overwrote rollback'; END IF;
 PERFORM shelby_rollback(p,'test-owner',c);
 IF (SELECT size_bytes FROM shelby_projects WHERE id=p)<>29 THEN RAISE EXCEPTION 'rollback metadata wrong'; END IF;
 BEGIN UPDATE shelby_deployments SET content_hash='changed' WHERE id=c;RAISE EXCEPTION 'immutable version changed';EXCEPTION WHEN raise_exception THEN IF SQLERRM='immutable version changed' THEN RAISE; END IF;END;
 b:=shelby_enqueue(p,'test-owner','{}','{}','{}'); SELECT * INTO j FROM shelby_claim('test-worker');
 IF EXISTS(SELECT 1 FROM shelby_claim('second-worker')) THEN RAISE EXCEPTION 'same project claimed concurrently'; END IF;
 UPDATE shelby_build_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE deployment_id=b;
 PERFORM shelby_claim('recovery-worker');
 IF (SELECT status FROM shelby_deployments WHERE id=b)<>'failed' THEN RAISE EXCEPTION 'expired lease not failed'; END IF;
 BEGIN PERFORM shelby_update_job(b,j.lease_token,'cloning');RAISE EXCEPTION 'stale lease accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM='stale lease accepted' THEN RAISE; END IF;END;
 IF (SELECT active_deployment_id FROM shelby_projects WHERE id=p)<>c THEN RAISE EXCEPTION 'expired worker changed production'; END IF;
 IF has_function_privilege('authenticated','public.shelby_claim(text)','EXECUTE') THEN RAISE EXCEPTION 'browser can claim'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE tablename LIKE 'shelby_%' AND 'authenticated'=ANY(roles)) THEN RAISE EXCEPTION 'browser RLS policy remains'; END IF;
 RAISE NOTICE 'PASS: event deduplication, stage ordering, atomic publication, failure preservation, ownership, rollback, stale promotion, immutable versions, browser isolation';
END $$;

DO $$
DECLARE p uuid; p2 uuid; d uuid; j public.shelby_build_jobs; promoted boolean; s text;
BEGIN
 INSERT INTO shelby_projects(name,slug,owner_id,content_hash,latest_version_url,signer_mode,wallet_address)
 VALUES('Connected','connected-test','dynamic:user-a','','','connected','0x1') RETURNING id INTO p;
 d:=shelby_enqueue(p,'dynamic:user-a','{"kind":"upload"}','{}','{}');
 SELECT * INTO j FROM shelby_claim('connected-worker');
 FOREACH s IN ARRAY ARRAY['cloning','installing','building','validating','uploading','publishing'] LOOP
   PERFORM shelby_update_job(d,j.lease_token,s);
 END LOOP;
 PERFORM shelby_wait_signature(d,j.lease_token,jsonb_build_object(
   'hash',repeat('d',64),'owner','0x456',
   'manifest',jsonb_build_array(jsonb_build_object('path','/index.html','size',31,'type','text/html')),
   'manifestUrl','https://fixture/connected-manifest','versionUrl','https://fixture/connected-version',
   'size',31,'files','[]'::jsonb));
 IF (SELECT status FROM shelby_deployments WHERE id=d)<>'awaiting_signature' THEN RAISE EXCEPTION 'connected build did not wait for signature'; END IF;
 IF (SELECT active_deployment_id FROM shelby_projects WHERE id=p) IS NOT NULL THEN RAISE EXCEPTION 'unsigned build reached production'; END IF;
 PERFORM shelby_record_fee(p,'dynamic:user-a','0xfee');
 promoted:=shelby_wallet_publish(d,'dynamic:user-a','0xfee','0xregistry');
 IF NOT promoted OR (SELECT active_deployment_id FROM shelby_projects WHERE id=p)<>d THEN RAISE EXCEPTION 'wallet publication failed'; END IF;
 INSERT INTO shelby_projects(name,slug,owner_id,content_hash,latest_version_url,signer_mode,wallet_address)
 VALUES('Other','connected-other','dynamic:user-b','','','connected','0x2') RETURNING id INTO p2;
 BEGIN
   PERFORM shelby_record_fee(p2,'dynamic:user-b','0xfee');
   RAISE EXCEPTION 'payment receipt reused across projects';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='payment receipt reused across projects' THEN RAISE; END IF;
 END;
 RAISE NOTICE 'PASS: connected-wallet pause, atomic promotion, and fee replay protection';
END $$;
