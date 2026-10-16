BEGIN;
ALTER TABLE public.endpoint_capabilities ADD COLUMN credential_auth_max integer CHECK(credential_auth_max BETWEEN 1 AND 1024);
ALTER TABLE public.endpoint_capabilities ADD COLUMN credential_hex_max integer CHECK(credential_hex_max BETWEEN 1 AND 1024);
ALTER TABLE public.extensions ADD CONSTRAINT extension_credential_identity UNIQUE(id,node_id,installation_id);
-- Exact generation evidence is retained even for failed/expired operations.
CREATE TABLE public.endpoint_credential_operations (
 id uuid PRIMARY KEY,
 request_id uuid NOT NULL,
 operator_id uuid NOT NULL REFERENCES public.platform_operators(id),
 authentication_version integer NOT NULL CHECK(authentication_version>0),
 action text NOT NULL CHECK(action IN ('setup','reset')),
 node_id uuid NOT NULL,
 extension_id uuid NOT NULL,
 installation_id uuid NOT NULL,
 expected_version integer NOT NULL CHECK(expected_version>0),
 expected_generation_id uuid,
 node_version integer NOT NULL CHECK(node_version>0),
 capability_revision integer NOT NULL CHECK(capability_revision>0),
 generation_id uuid NOT NULL UNIQUE,
 ordinal integer NOT NULL CHECK(ordinal>0),
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 correlation_id text NOT NULL CHECK(correlation_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$'),
 work_id uuid UNIQUE REFERENCES public.outbox_work(id),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','retrying','needs_reconciliation','associated','cancelled','conflict','failed')),
 failure_code text CHECK(failure_code IN ('provider_unavailable','provider_access_denied','material_invalid','material_unavailable','originator_revoked','stale_version','dependency_changed','needs_reconciliation','cleanup_required')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 budget integer NOT NULL DEFAULT 1 CHECK(budget>0),
 material_health text NOT NULL DEFAULT 'unknown' CHECK(material_health IN ('unknown','verified','unavailable')),
 verified_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 terminal_at timestamptz,
 associated_at timestamptz,
 resulting_version integer,
 result jsonb CHECK(result IS NULL OR (jsonb_typeof(result)='object' AND octet_length(result::text)<=16384)),
 cleanup_state text NOT NULL DEFAULT 'retained' CHECK(cleanup_state IN ('retained','cleanup_required','destroyed','absent')),
 cleanup_attempts integer NOT NULL DEFAULT 0 CHECK(cleanup_attempts>=0),
 cleanup_checked_at timestamptz,
 UNIQUE(operator_id,action,request_id),
 UNIQUE(extension_id,ordinal),
 UNIQUE(extension_id,generation_id),
 FOREIGN KEY(node_id,installation_id) REFERENCES public.pbx_nodes(id,installation_id),
 FOREIGN KEY(extension_id,node_id,installation_id) REFERENCES public.extensions(id,node_id,installation_id),
 CHECK((action='setup')=(expected_generation_id IS NULL)),
 CHECK((state='associated')=(associated_at IS NOT NULL)),
 CHECK((state IN ('associated','cancelled','conflict','failed'))=(terminal_at IS NOT NULL)),
 CHECK((state='associated')=(resulting_version IS NOT NULL))
);
CREATE UNIQUE INDEX endpoint_credential_active ON public.endpoint_credential_operations(extension_id) WHERE state IN ('queued','retrying','needs_reconciliation');
ALTER TABLE public.extensions ADD COLUMN credential_generation_id uuid;
ALTER TABLE public.extensions ADD CONSTRAINT extension_credential_generation FOREIGN KEY(id,credential_generation_id) REFERENCES public.endpoint_credential_operations(extension_id,generation_id);
CREATE FUNCTION public.protect_endpoint_credential_operation() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retained credential operation' USING ERRCODE='23514'; END IF;
 IF (to_jsonb(NEW)-ARRAY['work_id','state','failure_code','attempts','budget','material_health','verified_at','terminal_at','associated_at','resulting_version','result','cleanup_state','cleanup_attempts','cleanup_checked_at']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['work_id','state','failure_code','attempts','budget','material_health','verified_at','terminal_at','associated_at','resulting_version','result','cleanup_state','cleanup_attempts','cleanup_checked_at']) THEN
  RAISE EXCEPTION 'Immutable credential binding' USING ERRCODE='23514';
 END IF;
 IF OLD.terminal_at IS NOT NULL AND (NEW.state<>OLD.state OR NEW.terminal_at<>OLD.terminal_at OR NEW.associated_at IS DISTINCT FROM OLD.associated_at OR NEW.resulting_version IS DISTINCT FROM OLD.resulting_version OR (OLD.result IS NOT NULL AND NEW.result IS DISTINCT FROM OLD.result)) THEN
  RAISE EXCEPTION 'Immutable credential outcome' USING ERRCODE='23514';
 END IF;
 IF NEW.attempts<OLD.attempts OR NEW.budget<OLD.budget THEN RAISE EXCEPTION 'Invalid execution evidence' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$body$;
CREATE TRIGGER endpoint_credential_protection BEFORE UPDATE OR DELETE ON public.endpoint_credential_operations FOR EACH ROW EXECUTE FUNCTION public.protect_endpoint_credential_operation();
REVOKE ALL ON public.endpoint_credential_operations FROM PUBLIC,myims_runtime;
REVOKE ALL ON FUNCTION public.protect_endpoint_credential_operation() FROM PUBLIC;
GRANT SELECT ON public.endpoint_credential_operations TO myims_runtime;
GRANT INSERT(id,request_id,operator_id,authentication_version,action,node_id,extension_id,installation_id,expected_version,expected_generation_id,node_version,capability_revision,generation_id,ordinal,fingerprint,correlation_id) ON public.endpoint_credential_operations TO myims_runtime;
GRANT UPDATE(work_id,state,failure_code,attempts,budget,material_health,verified_at,terminal_at,associated_at,resulting_version,result,cleanup_state,cleanup_attempts,cleanup_checked_at) ON public.endpoint_credential_operations TO myims_runtime;
GRANT UPDATE(credential_generation_id) ON public.extensions TO myims_runtime;
COMMIT;
