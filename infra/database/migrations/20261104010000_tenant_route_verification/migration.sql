BEGIN;
ALTER TABLE public.pbx_live_runtime ADD COLUMN routing_generation integer NOT NULL DEFAULT 0 CHECK(routing_generation>=0);
CREATE FUNCTION public.advance_tenant_runtime_generation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.routing_generation<>0 THEN RAISE EXCEPTION 'Invalid initial routing generation' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.routing_generation<>OLD.routing_generation THEN RAISE EXCEPTION 'Routing generation is derived' USING ERRCODE='23514'; END IF;
  IF (NEW.installed_id,NEW.verified_id,NEW.known_good_id,NEW.runtime_state,NEW.active_operation_id,NEW.boundary_epoch)
   IS DISTINCT FROM (OLD.installed_id,OLD.verified_id,OLD.known_good_id,OLD.runtime_state,OLD.active_operation_id,OLD.boundary_epoch)
  THEN NEW.routing_generation:=OLD.routing_generation+1; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tenant_runtime_generation BEFORE INSERT OR UPDATE ON public.pbx_live_runtime FOR EACH ROW EXECUTE FUNCTION public.advance_tenant_runtime_generation();
-- Deployment-owned cases enumerate exact controlled sources and destinations.
CREATE TABLE public.tenant_route_test_cases (
 id uuid PRIMARY KEY, node_id uuid NOT NULL, installation_id uuid NOT NULL,
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 direction text NOT NULL CHECK(direction IN ('inbound','outbound')),
 route_id uuid NOT NULL, source_id uuid NOT NULL,
 dialled text NOT NULL CHECK(dialled ~ '^[0-9]{1,15}$'),
 expected_destination_id uuid,
 expected_outcome text NOT NULL CHECK(expected_outcome IN ('permitted','denied')),
 enabled boolean NOT NULL DEFAULT false,readiness_required boolean NOT NULL DEFAULT true,
 test_kind text NOT NULL DEFAULT 'routing' CHECK(test_kind IN ('routing','ambiguous-source','ordinary-draft','expiry','stale-source','unpermitted')),
 FOREIGN KEY(node_id,installation_id) REFERENCES public.pbx_nodes(id,installation_id),
 CHECK((expected_outcome='permitted')=(expected_destination_id IS NOT NULL))
);
CREATE TABLE public.tenant_verification_grants (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 node_id uuid NOT NULL, artifact_id uuid NOT NULL,
 revision_id uuid NOT NULL, runtime_generation integer NOT NULL CHECK(runtime_generation>=0), source_digest text NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 operator_id uuid NOT NULL REFERENCES public.platform_operators(id), authentication_version integer NOT NULL CHECK(authentication_version>0),
 request_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 expires_at timestamptz NOT NULL DEFAULT statement_timestamp()+interval '30 minutes',
 UNIQUE(operator_id,request_id),
 FOREIGN KEY(artifact_id,node_id) REFERENCES public.pbx_live_artifacts(id,node_id),
 FOREIGN KEY(revision_id,node_id) REFERENCES public.pbx_revisions(id,node_id),
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '30 minutes')
);
CREATE TABLE public.tenant_verification_grant_cases (
 grant_id uuid NOT NULL REFERENCES public.tenant_verification_grants(id),
 case_id uuid NOT NULL REFERENCES public.tenant_route_test_cases(id),
 PRIMARY KEY(grant_id,case_id)
);
CREATE TABLE public.tenant_verification_revocations (
 grant_id uuid PRIMARY KEY REFERENCES public.tenant_verification_grants(id),
 operator_id uuid NOT NULL REFERENCES public.platform_operators(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.tenant_route_test_intents (
 id uuid PRIMARY KEY, case_id uuid NOT NULL REFERENCES public.tenant_route_test_cases(id),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id), node_id uuid NOT NULL,
 artifact_id uuid NOT NULL, revision_id uuid NOT NULL,runtime_generation integer NOT NULL CHECK(runtime_generation>=0),
 grant_id uuid REFERENCES public.tenant_verification_grants(id),
 source_digest text NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 operator_id uuid NOT NULL REFERENCES public.platform_operators(id), authentication_version integer NOT NULL CHECK(authentication_version>0),
 request_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(operator_id,request_id), UNIQUE(id,node_id),
 FOREIGN KEY(artifact_id,node_id) REFERENCES public.pbx_live_artifacts(id,node_id),
 FOREIGN KEY(revision_id,node_id) REFERENCES public.pbx_revisions(id,node_id)
);
CREATE TABLE public.tenant_route_test_progress (
 intent_id uuid PRIMARY KEY, node_id uuid NOT NULL,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','dispatching','admitted','passed','denied','failed','unknown')),
 nonce_hash text CHECK(nonce_hash ~ '^[a-f0-9]{64}$'),
 unique_id text CHECK(unique_id ~ '^[a-zA-Z0-9_.-]{1,80}$'),
 deadline timestamptz, owner_epoch bigint,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(intent_id,node_id) REFERENCES public.tenant_route_test_intents(id,node_id)
);
CREATE UNIQUE INDEX tenant_route_single_test ON public.tenant_route_test_progress(node_id) WHERE state IN ('queued','dispatching','admitted','unknown');
CREATE TABLE public.tenant_route_test_results (
 intent_id uuid PRIMARY KEY REFERENCES public.tenant_route_test_intents(id),
 outcome text NOT NULL CHECK(outcome IN ('permitted','denied','failed','unknown')),
 destination_id uuid,
 owner_epoch bigint NOT NULL CHECK(owner_epoch>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(outcome='permitted' OR destination_id IS NULL)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['tenant_verification_grant_cases','tenant_route_test_cases','tenant_verification_grants','tenant_verification_revocations','tenant_route_test_intents','tenant_route_test_results'] LOOP
 EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.reject_pbx_live_history_change()',t||'_immutable',t);
 END LOOP;
END $$;
REVOKE ALL ON public.tenant_verification_grant_cases,public.tenant_route_test_cases,public.tenant_verification_grants,public.tenant_verification_revocations,public.tenant_route_test_intents,public.tenant_route_test_progress,public.tenant_route_test_results FROM PUBLIC,myims_runtime;
GRANT SELECT ON public.tenant_verification_grant_cases,public.tenant_route_test_cases,public.tenant_verification_grants,public.tenant_verification_revocations,public.tenant_route_test_intents,public.tenant_route_test_progress,public.tenant_route_test_results TO myims_runtime,myims_pbx_executor;
GRANT INSERT ON public.tenant_verification_grant_cases,public.tenant_verification_grants,public.tenant_verification_revocations,public.tenant_route_test_intents TO myims_runtime;
GRANT INSERT(intent_id,node_id) ON public.tenant_route_test_progress TO myims_runtime;
GRANT UPDATE ON public.tenant_route_test_progress TO myims_pbx_executor;
GRANT INSERT ON public.tenant_route_test_results TO myims_pbx_executor;
COMMIT;

BEGIN;
CREATE TABLE public.tenant_runtime_proofs (
 node_id uuid PRIMARY KEY REFERENCES public.pbx_nodes(id),
 artifact_id uuid NOT NULL,runtime_generation integer NOT NULL CHECK(runtime_generation>=0), owner_epoch bigint NOT NULL CHECK(owner_epoch>0),
 source_digest text NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 valid boolean NOT NULL, checked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(artifact_id,node_id) REFERENCES public.pbx_live_artifacts(id,node_id)
);
REVOKE ALL ON public.tenant_runtime_proofs FROM PUBLIC,myims_runtime;
GRANT SELECT ON public.tenant_runtime_proofs TO myims_runtime,myims_pbx_executor;
GRANT INSERT,UPDATE ON public.tenant_runtime_proofs TO myims_pbx_executor;
COMMIT;

BEGIN;
CREATE TABLE public.tenant_verification_receipts (
 operator_id uuid NOT NULL REFERENCES public.platform_operators(id), request_id uuid NOT NULL,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 result jsonb NOT NULL CHECK(octet_length(result::text)<=8192),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(operator_id,request_id)
);
CREATE TRIGGER tenant_verification_receipt_immutable BEFORE UPDATE OR DELETE ON public.tenant_verification_receipts FOR EACH ROW EXECUTE FUNCTION public.reject_pbx_live_history_change();
REVOKE ALL ON public.tenant_verification_receipts FROM PUBLIC,myims_runtime;
GRANT SELECT,INSERT ON public.tenant_verification_receipts TO myims_runtime;
COMMIT;

BEGIN;
CREATE TABLE public.tenant_route_test_reconciliation_intents (
 id uuid PRIMARY KEY,test_id uuid NOT NULL REFERENCES public.tenant_route_test_intents(id),
 operator_id uuid NOT NULL REFERENCES public.platform_operators(id),authentication_version integer NOT NULL CHECK(authentication_version>0),
 request_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(operator_id,request_id)
);
CREATE TABLE public.tenant_route_test_reconciliation_results (
 intent_id uuid PRIMARY KEY REFERENCES public.tenant_route_test_reconciliation_intents(id),
 owner_epoch bigint NOT NULL CHECK(owner_epoch>0),created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER tenant_test_reconcile_intent_immutable BEFORE UPDATE OR DELETE ON public.tenant_route_test_reconciliation_intents FOR EACH ROW EXECUTE FUNCTION public.reject_pbx_live_history_change();
CREATE TRIGGER tenant_test_reconcile_result_immutable BEFORE UPDATE OR DELETE ON public.tenant_route_test_reconciliation_results FOR EACH ROW EXECUTE FUNCTION public.reject_pbx_live_history_change();
REVOKE ALL ON public.tenant_route_test_reconciliation_intents,public.tenant_route_test_reconciliation_results FROM PUBLIC,myims_runtime;
GRANT SELECT ON public.tenant_route_test_reconciliation_intents,public.tenant_route_test_reconciliation_results TO myims_runtime,myims_pbx_executor;
GRANT INSERT ON public.tenant_route_test_reconciliation_intents TO myims_runtime;
GRANT INSERT ON public.tenant_route_test_reconciliation_results TO myims_pbx_executor;
COMMIT;
