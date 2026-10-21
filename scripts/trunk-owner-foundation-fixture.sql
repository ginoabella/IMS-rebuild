-- Runs only inside the fresh disposable PostgreSQL container, never shared data.
CREATE FUNCTION pg_temp.expect_code(command text, expected text) RETURNS void LANGUAGE plpgsql AS $body$
BEGIN
 BEGIN EXECUTE command;
 EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE=expected THEN RETURN; END IF;
  RAISE;
 END;
 RAISE EXCEPTION 'Expected SQL denial did not occur';
END;
$body$;
INSERT INTO public.platform_operators(id,normalized_username,status,credential_state)
VALUES('00000000-0000-4000-8000-000000000001','trunk-owner-fixture','active','unset');
INSERT INTO public.pbx_nodes(id,installation_id,display_name,target_alias,host,transport,port,tls_server_name,credential_alias,created_by,updated_by)
SELECT ('00000000-0000-4000-8000-'||n)::uuid,('00000000-0000-4000-8000-'||lpad((n::bigint+100)::text,12,'0'))::uuid,'fixture','fixture','fixture.invalid','ami-tls',5039,'fixture.invalid','fixture','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001'
FROM unnest(ARRAY['000000000101','000000000102']) AS ids(n);
INSERT INTO public.trunk_credential_peer_scopes(peer_id,node_id,installation_id,purposes,revision)
VALUES('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000201',ARRAY['outbound-request'],1);

SET SESSION AUTHORIZATION myims_runtime;
SELECT pg_temp.expect_code('SET ROLE myims_trunk_owner','42501');
SELECT pg_temp.expect_code('SELECT * FROM public.trunk_credential_generations','42501');
SELECT pg_temp.expect_code('INSERT INTO public.trunk_credential_bindings DEFAULT VALUES','42501');
SELECT pg_temp.expect_code('UPDATE public.trunk_credential_bindings SET owner_revision=2','42501');
SELECT pg_temp.expect_code('DELETE FROM public.trunk_credential_reservations','42501');
SELECT pg_temp.expect_code('TRUNCATE public.trunk_credential_generations','42501');
SELECT pg_temp.expect_code('SELECT public.check_trunk_generation_scope()','42501');
RESET SESSION AUTHORIZATION;

SET ROLE myims_trunk_owner;
SELECT pg_temp.expect_code('INSERT INTO public.trunk_credential_peer_scopes DEFAULT VALUES','42501');
SELECT pg_temp.expect_code('INSERT INTO public.endpoint_credential_operations DEFAULT VALUES','42501');
SELECT pg_temp.expect_code('UPDATE public.trunk_credential_generations SET material_version=2','42501');
SELECT pg_temp.expect_code('UPDATE public.trunk_credential_reservations SET operator_id=NULL','42501');
SELECT pg_temp.expect_code('INSERT INTO public.trunk_credential_audit_transactions DEFAULT VALUES','42501');
SELECT pg_temp.expect_code('INSERT INTO public.trunk_credential_reservation_history(operation_id,state,transaction_id) VALUES(NULL,''reserved'',pg_current_xact_id())','42501');
SELECT pg_temp.expect_code('INSERT INTO public.trunk_credential_bindings(id,node_id,installation_id,peer_id,purposes,created_by) VALUES(''00000000-0000-4000-8000-000000000499'',''00000000-0000-4000-8000-000000000101'',''00000000-0000-4000-8000-000000000202'',''00000000-0000-4000-8000-000000000301'',ARRAY[''outbound-request''],''00000000-0000-4000-8000-000000000001'')','23514');
SELECT pg_temp.expect_code('INSERT INTO public.trunk_credential_bindings(id,node_id,installation_id,peer_id,purposes,created_by) VALUES(''00000000-0000-4000-8000-000000000499'',''00000000-0000-4000-8000-000000000101'',''00000000-0000-4000-8000-000000000201'',''00000000-0000-4000-8000-000000000301'',ARRAY[''registration''],''00000000-0000-4000-8000-000000000001'')','23514');
RESET ROLE;

-- The initial generation, reservation, immutable history and audit commit together.
BEGIN;
SET LOCAL ROLE myims_trunk_owner;
SAVEPOINT reservation_and_audit;
INSERT INTO public.trunk_credential_bindings(id,node_id,installation_id,peer_id,purposes,created_by)
VALUES('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000301',ARRAY['outbound-request'],'00000000-0000-4000-8000-000000000001');
INSERT INTO public.trunk_credential_generations(id,binding_id,node_id,installation_id,peer_id,ordinal,operation_id)
VALUES('00000000-0000-4000-8000-000000000501','00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000301',1,'00000000-0000-4000-8000-000000000601');
INSERT INTO public.trunk_credential_reservations(id,binding_id,generation_id,request_id,operator_id,authentication_version,node_version,peer_revision,expected_owner_revision,correlation_id)
VALUES('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000501','00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000001',1,1,1,1,'trunk-fixture');
INSERT INTO public.trunk_credential_reservation_history(operation_id,state) VALUES('00000000-0000-4000-8000-000000000601','reserved');
INSERT INTO public.audit_events(id,event_type,schema_version,actor_kind,actor_reference,identity_plane,target_type,target_reference,correlation_id,metadata)
VALUES('00000000-0000-4000-8000-000000000801','trunk.credential.reserved',1,'platform_operator','00000000-0000-4000-8000-000000000001','platform','trunk_credential_operation','00000000-0000-4000-8000-000000000601','trunk-fixture','{"bindingId":"00000000-0000-4000-8000-000000000401","generationId":"00000000-0000-4000-8000-000000000501"}');
RELEASE SAVEPOINT reservation_and_audit;
COMMIT;

SET SESSION AUTHORIZATION myims_runtime;
DO $body$ BEGIN
 IF (SELECT count(*) FROM public.trunk_credential_owner_references)<>1 THEN RAISE EXCEPTION 'Missing safe exact owner reference'; END IF;
 IF EXISTS(SELECT 1 FROM public.trunk_credential_owner_references WHERE installation_id='00000000-0000-4000-8000-000000000202') THEN RAISE EXCEPTION 'Wrong installation matched'; END IF;
END; $body$;
RESET SESSION AUTHORIZATION;

-- Even deployment SQL cannot rewrite retained provenance/history.
SELECT pg_temp.expect_code('UPDATE public.trunk_credential_generations SET ordinal=2','23514');
SELECT pg_temp.expect_code('DELETE FROM public.trunk_credential_reservation_history','23514');
-- PostgreSQL first refuses truncating a table with retained referencing rows.
SELECT pg_temp.expect_code('TRUNCATE public.trunk_credential_generations','0A000');
SELECT pg_temp.expect_code('UPDATE public.trunk_credential_reservations SET authentication_version=2','23514');
SELECT pg_temp.expect_code('INSERT INTO public.trunk_credential_generations(id,binding_id,node_id,installation_id,peer_id,ordinal,operation_id) VALUES(''00000000-0000-4000-8000-000000000502'',''00000000-0000-4000-8000-000000000401'',''00000000-0000-4000-8000-000000000101'',''00000000-0000-4000-8000-000000000201'',''00000000-0000-4000-8000-000000000301'',3,''00000000-0000-4000-8000-000000000602'')','23514');

-- Force deferred checks inside a subtransaction so assertion observes rollback.
DO $body$
BEGIN
 BEGIN
  UPDATE public.trunk_credential_reservations SET state='cancelled',terminal_at=clock_timestamp();
  INSERT INTO public.trunk_credential_reservation_history(operation_id,state) VALUES('00000000-0000-4000-8000-000000000601','cancelled');
  SET CONSTRAINTS ALL IMMEDIATE;
  RAISE EXCEPTION 'Missing audit accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 IF (SELECT state FROM public.trunk_credential_reservations)<>'reserved' OR EXISTS(SELECT 1 FROM public.trunk_credential_reservation_history WHERE state='cancelled') THEN RAISE EXCEPTION 'Audit failure did not roll back'; END IF;
END;
$body$;

-- An old matching audit event UUID cannot be linked to a later state transition.
INSERT INTO public.audit_events(id,event_type,schema_version,actor_kind,actor_reference,identity_plane,target_type,target_reference,correlation_id,metadata)
VALUES('00000000-0000-4000-8000-000000000802','trunk.credential.cancelled',1,'platform_operator','00000000-0000-4000-8000-000000000001','platform','trunk_credential_operation','00000000-0000-4000-8000-000000000601','trunk-fixture','{"bindingId":"00000000-0000-4000-8000-000000000401","generationId":"00000000-0000-4000-8000-000000000501"}');
DO $body$
BEGIN
 BEGIN
  UPDATE public.trunk_credential_reservations SET state='cancelled',terminal_at=clock_timestamp();
  INSERT INTO public.trunk_credential_reservation_history(operation_id,state) VALUES('00000000-0000-4000-8000-000000000601','cancelled');
  SET CONSTRAINTS ALL IMMEDIATE;
  RAISE EXCEPTION 'Old audit UUID accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 IF (SELECT state FROM public.trunk_credential_reservations)<>'reserved' THEN RAISE EXCEPTION 'Old audit failure did not roll back'; END IF;
END;
$body$;

-- Platform-only owner transitions cannot reuse tenant-scoped audit attribution.
DO $body$
BEGIN
 BEGIN
  UPDATE public.trunk_credential_reservations SET state='cancelled',terminal_at=clock_timestamp();
  INSERT INTO public.trunk_credential_reservation_history(operation_id,state) VALUES('00000000-0000-4000-8000-000000000601','cancelled');
  INSERT INTO public.audit_events(id,event_type,schema_version,actor_kind,actor_reference,identity_plane,target_type,target_reference,correlation_id,tenant_id,metadata)
  VALUES('00000000-0000-4000-8000-000000000803','trunk.credential.cancelled',1,'platform_operator','00000000-0000-4000-8000-000000000001','platform','trunk_credential_operation','00000000-0000-4000-8000-000000000601','trunk-fixture','tenant-fixture','{"bindingId":"00000000-0000-4000-8000-000000000401","generationId":"00000000-0000-4000-8000-000000000501"}');
  SET CONSTRAINTS ALL IMMEDIATE;
  RAISE EXCEPTION 'Tenant-scoped audit accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 IF (SELECT state FROM public.trunk_credential_reservations)<>'reserved' OR EXISTS(SELECT 1 FROM public.audit_events WHERE id='00000000-0000-4000-8000-000000000803') OR EXISTS(SELECT 1 FROM public.trunk_credential_audit_transactions WHERE audit_event_id='00000000-0000-4000-8000-000000000803') THEN RAISE EXCEPTION 'Tenant audit failure did not roll back atomically'; END IF;
END;
$body$;

-- No generation/reservation/history survives an initial missing-audit failure.
DO $body$
BEGIN
 BEGIN
  INSERT INTO public.trunk_credential_bindings(id,node_id,installation_id,peer_id,purposes,created_by)
  VALUES('00000000-0000-4000-8000-000000000402','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000301',ARRAY['outbound-request'],'00000000-0000-4000-8000-000000000001');
  INSERT INTO public.trunk_credential_generations(id,binding_id,node_id,installation_id,peer_id,ordinal,operation_id)
  VALUES('00000000-0000-4000-8000-000000000502','00000000-0000-4000-8000-000000000402','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000301',1,'00000000-0000-4000-8000-000000000602');
  INSERT INTO public.trunk_credential_reservations(id,binding_id,generation_id,request_id,operator_id,authentication_version,node_version,peer_revision,expected_owner_revision,correlation_id)
  VALUES('00000000-0000-4000-8000-000000000602','00000000-0000-4000-8000-000000000402','00000000-0000-4000-8000-000000000502','00000000-0000-4000-8000-000000000702','00000000-0000-4000-8000-000000000001',1,1,1,1,'trunk-fixture');
  INSERT INTO public.trunk_credential_reservation_history(operation_id,state) VALUES('00000000-0000-4000-8000-000000000602','reserved');
  SET CONSTRAINTS ALL IMMEDIATE;
  RAISE EXCEPTION 'Missing initial audit accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 IF EXISTS(SELECT 1 FROM public.trunk_credential_bindings WHERE id='00000000-0000-4000-8000-000000000402') OR EXISTS(SELECT 1 FROM public.trunk_credential_generations WHERE id='00000000-0000-4000-8000-000000000502') OR EXISTS(SELECT 1 FROM public.trunk_credential_reservations WHERE id='00000000-0000-4000-8000-000000000602') OR EXISTS(SELECT 1 FROM public.trunk_credential_reservation_history WHERE operation_id='00000000-0000-4000-8000-000000000602') THEN RAISE EXCEPTION 'Initial audit failure did not roll back atomically'; END IF;
END;
$body$;

SELECT pg_temp.expect_code('UPDATE public.trunk_credential_audit_transactions SET transaction_id=pg_current_xact_id()','23514');

DO $body$
BEGIN
 BEGIN
  INSERT INTO public.trunk_credential_generations(id,binding_id,node_id,installation_id,peer_id,ordinal,operation_id)
  SELECT '00000000-0000-4000-8000-000000000502',binding_id,node_id,installation_id,peer_id,2,'00000000-0000-4000-8000-000000000602' FROM public.trunk_credential_generations WHERE id='00000000-0000-4000-8000-000000000501';
  INSERT INTO public.trunk_credential_reservations(id,binding_id,generation_id,request_id,operator_id,authentication_version,node_version,peer_revision,expected_owner_revision,correlation_id)
  SELECT '00000000-0000-4000-8000-000000000602',binding_id,'00000000-0000-4000-8000-000000000502','00000000-0000-4000-8000-000000000702',operator_id,authentication_version,node_version,peer_revision,expected_owner_revision,correlation_id FROM public.trunk_credential_reservations WHERE id='00000000-0000-4000-8000-000000000601';
  RAISE EXCEPTION 'Second active preparation accepted';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 IF EXISTS(SELECT 1 FROM public.trunk_credential_generations WHERE id='00000000-0000-4000-8000-000000000502') THEN RAISE EXCEPTION 'Conflicting preparation did not roll back generation'; END IF;
END;
$body$;

-- A fully evidenced terminal transition preserves its exact generation forever.
BEGIN;
SET LOCAL ROLE myims_trunk_owner;
UPDATE public.trunk_credential_reservations SET state='cancelled',terminal_at=clock_timestamp()
WHERE id='00000000-0000-4000-8000-000000000601';
INSERT INTO public.trunk_credential_reservation_history(operation_id,state)
VALUES('00000000-0000-4000-8000-000000000601','cancelled');
INSERT INTO public.audit_events(id,event_type,schema_version,actor_kind,actor_reference,identity_plane,target_type,target_reference,correlation_id,metadata)
VALUES('00000000-0000-4000-8000-000000000804','trunk.credential.cancelled',1,'platform_operator','00000000-0000-4000-8000-000000000001','platform','trunk_credential_operation','00000000-0000-4000-8000-000000000601','trunk-fixture','{"bindingId":"00000000-0000-4000-8000-000000000401","generationId":"00000000-0000-4000-8000-000000000501"}');
COMMIT;
SET ROLE myims_trunk_owner;
SELECT pg_temp.expect_code('UPDATE public.trunk_credential_reservations SET state=''reserved'',terminal_at=NULL','23514');
SELECT pg_temp.expect_code('UPDATE public.trunk_credential_reservations SET state=''failed'',terminal_at=clock_timestamp()','23514');
RESET ROLE;
SET SESSION AUTHORIZATION myims_runtime;
DO $body$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.trunk_credential_owner_references WHERE generation_id='00000000-0000-4000-8000-000000000501' AND generation_ordinal=1 AND reservation_state='cancelled') THEN
  RAISE EXCEPTION 'Terminal provenance disappeared';
 END IF;
END; $body$;
RESET SESSION AUTHORIZATION;
