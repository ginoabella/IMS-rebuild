BEGIN;
-- Deployment owns schema. This capability role has no login or runtime membership.
DO $body$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='myims_trunk_owner') THEN
  CREATE ROLE myims_trunk_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
 ELSIF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='myims_trunk_owner' AND
  (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit OR rolbypassrls)) THEN
  RAISE EXCEPTION 'Unexpected trunk owner role' USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.rolname='myims_trunk_owner'
  WHERE m.roleid=r.oid OR m.member=r.oid) THEN
  RAISE EXCEPTION 'Unexpected trunk owner role membership' USING ERRCODE='42501';
 END IF;
END;
$body$;
GRANT USAGE ON SCHEMA public TO myims_trunk_owner;

-- Non-secret deployment peer declarations only; no provider paths/accounts/realm.
CREATE TABLE public.trunk_credential_peer_scopes (
 peer_id uuid NOT NULL,
 node_id uuid NOT NULL,
 installation_id uuid NOT NULL,
 purposes text[] NOT NULL CHECK(purposes IN
  (ARRAY['outbound-request']::text[], ARRAY['registration']::text[], ARRAY['outbound-request','registration']::text[])),
 revision integer NOT NULL CHECK(revision>0),
 PRIMARY KEY(peer_id,node_id,installation_id),
 FOREIGN KEY(node_id,installation_id) REFERENCES public.pbx_nodes(id,installation_id)
);
CREATE TABLE public.trunk_credential_bindings (
 id uuid PRIMARY KEY,
 node_id uuid NOT NULL,
 installation_id uuid NOT NULL,
 peer_id uuid NOT NULL,
 purposes text[] NOT NULL CHECK(purposes IN
  (ARRAY['outbound-request']::text[], ARRAY['registration']::text[], ARRAY['outbound-request','registration']::text[])),
 owner_revision integer NOT NULL DEFAULT 1 CHECK(owner_revision>0),
 created_by uuid NOT NULL REFERENCES public.platform_operators(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,node_id,installation_id,peer_id),
 FOREIGN KEY(peer_id,node_id,installation_id) REFERENCES public.trunk_credential_peer_scopes(peer_id,node_id,installation_id)
);
CREATE TABLE public.trunk_credential_generations (
 id uuid PRIMARY KEY,
 binding_id uuid NOT NULL,
 node_id uuid NOT NULL,
 installation_id uuid NOT NULL,
 peer_id uuid NOT NULL,
 ordinal integer NOT NULL CHECK(ordinal>0),
 material_version integer NOT NULL DEFAULT 1 CHECK(material_version=1),
 operation_id uuid NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(binding_id,ordinal),
 UNIQUE(id,binding_id),
 UNIQUE(operation_id,id,binding_id),
 FOREIGN KEY(binding_id,node_id,installation_id,peer_id) REFERENCES public.trunk_credential_bindings(id,node_id,installation_id,peer_id)
);
CREATE TABLE public.trunk_credential_reservations (
 id uuid PRIMARY KEY,
 binding_id uuid NOT NULL,
 generation_id uuid NOT NULL UNIQUE,
 request_id uuid NOT NULL,
 operator_id uuid NOT NULL REFERENCES public.platform_operators(id),
 authentication_version integer NOT NULL CHECK(authentication_version>0),
 node_version integer NOT NULL CHECK(node_version>0),
 peer_revision integer NOT NULL CHECK(peer_revision>0),
 expected_owner_revision integer NOT NULL CHECK(expected_owner_revision>0),
 correlation_id text NOT NULL CHECK(correlation_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$'),
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','cancelled','failed')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 terminal_at timestamptz,
 CHECK((state='reserved')=(terminal_at IS NULL)),
 UNIQUE(operator_id,request_id),
 UNIQUE(id,generation_id,binding_id),
 FOREIGN KEY(id,generation_id,binding_id) REFERENCES public.trunk_credential_generations(operation_id,id,binding_id) DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE public.trunk_credential_generations ADD CONSTRAINT trunk_generation_reservation
 FOREIGN KEY(operation_id,id,binding_id) REFERENCES public.trunk_credential_reservations(id,generation_id,binding_id) DEFERRABLE INITIALLY DEFERRED;
CREATE UNIQUE INDEX trunk_credential_active_reservation ON public.trunk_credential_reservations(binding_id) WHERE state='reserved';
CREATE TABLE public.trunk_credential_reservation_history (
 operation_id uuid NOT NULL REFERENCES public.trunk_credential_reservations(id),
 state text NOT NULL CHECK(state IN ('reserved','cancelled','failed')),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(operation_id,state)
);
-- A protected trigger records the TOP-LEVEL transaction identity even when audit
-- append occurs in a savepoint. Raw xmin compares subtransaction IDs incorrectly.
CREATE TABLE public.trunk_credential_audit_transactions (
 audit_event_id uuid PRIMARY KEY REFERENCES public.audit_events(id),
 transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id()
);
CREATE FUNCTION public.record_trunk_audit_transaction() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $body$
BEGIN
 INSERT INTO public.trunk_credential_audit_transactions(audit_event_id) VALUES(NEW.id);
 RETURN NEW;
END;
$body$;
CREATE TRIGGER trunk_audit_transaction AFTER INSERT ON public.audit_events FOR EACH ROW WHEN(NEW.event_type LIKE 'trunk.credential.%') EXECUTE FUNCTION public.record_trunk_audit_transaction();

CREATE FUNCTION public.reject_trunk_owner_mutation() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN RAISE EXCEPTION 'Immutable trunk owner provenance' USING ERRCODE='23514'; END;
$body$;
CREATE TRIGGER trunk_peer_scope_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.trunk_credential_peer_scopes FOR EACH STATEMENT EXECUTE FUNCTION public.reject_trunk_owner_mutation();
CREATE TRIGGER trunk_binding_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.trunk_credential_bindings FOR EACH STATEMENT EXECUTE FUNCTION public.reject_trunk_owner_mutation();
CREATE TRIGGER trunk_generation_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.trunk_credential_generations FOR EACH STATEMENT EXECUTE FUNCTION public.reject_trunk_owner_mutation();
CREATE TRIGGER trunk_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.trunk_credential_reservation_history FOR EACH STATEMENT EXECUTE FUNCTION public.reject_trunk_owner_mutation();
CREATE TRIGGER trunk_audit_transaction_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.trunk_credential_audit_transactions FOR EACH STATEMENT EXECUTE FUNCTION public.reject_trunk_owner_mutation();
CREATE FUNCTION public.protect_trunk_reservation() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
 IF TG_OP='DELETE' OR OLD.state<>'reserved' THEN
  RAISE EXCEPTION 'Retained trunk reservation' USING ERRCODE='23514';
 END IF;
 IF (to_jsonb(NEW)-ARRAY['state','terminal_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','terminal_at']) OR NEW.state='reserved' THEN
  RAISE EXCEPTION 'Immutable trunk reservation' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$body$;
CREATE TRIGGER trunk_reservation_immutable BEFORE UPDATE OR DELETE ON public.trunk_credential_reservations FOR EACH ROW EXECUTE FUNCTION public.protect_trunk_reservation();
CREATE TRIGGER trunk_reservation_no_truncate BEFORE TRUNCATE ON public.trunk_credential_reservations FOR EACH STATEMENT EXECUTE FUNCTION public.reject_trunk_owner_mutation();

-- Fixed-path trigger serializes ordinal allocation on the binding before touching
-- generation rows. Future entrypoints must acquire authority/node/peer locks first.
CREATE FUNCTION public.check_trunk_generation_scope() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $body$
DECLARE allowed text[]; next_ordinal integer;
BEGIN
 SELECT b.purposes INTO allowed FROM public.trunk_credential_bindings b WHERE b.id=NEW.binding_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown trunk binding' USING ERRCODE='23503'; END IF;
 SELECT COALESCE(max(g.ordinal),0)+1 INTO next_ordinal FROM public.trunk_credential_generations g WHERE g.binding_id=NEW.binding_id;
 IF NEW.ordinal<>next_ordinal THEN RAISE EXCEPTION 'Invalid trunk generation ordinal' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$body$;
CREATE TRIGGER trunk_generation_scope BEFORE INSERT ON public.trunk_credential_generations FOR EACH ROW EXECUTE FUNCTION public.check_trunk_generation_scope();
CREATE FUNCTION public.check_trunk_binding_purposes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $body$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.trunk_credential_peer_scopes p WHERE p.peer_id=NEW.peer_id AND p.node_id=NEW.node_id AND p.installation_id=NEW.installation_id AND NEW.purposes <@ p.purposes) THEN
  RAISE EXCEPTION 'Unsupported trunk credential purposes' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$body$;
CREATE TRIGGER trunk_binding_purposes BEFORE INSERT ON public.trunk_credential_bindings FOR EACH ROW EXECUTE FUNCTION public.check_trunk_binding_purposes();

-- Reservation/result tombstones and state history cannot commit without the
-- matching actor-attributed application audit written in this SAME transaction.
CREATE FUNCTION public.check_trunk_reservation_evidence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $body$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.trunk_credential_reservation_history h WHERE h.operation_id=NEW.id AND h.state=NEW.state AND h.transaction_id=pg_current_xact_id()) OR
 NOT EXISTS(SELECT 1 FROM public.audit_events a JOIN public.trunk_credential_audit_transactions t ON t.audit_event_id=a.id WHERE a.event_type='trunk.credential.'||NEW.state
  AND a.target_type='trunk_credential_operation' AND a.target_reference=NEW.id::text
  AND a.actor_kind='platform_operator' AND a.actor_reference=NEW.operator_id::text
  AND a.identity_plane='platform' AND a.actor_tenant_id IS NULL AND a.tenant_id IS NULL AND a.system_reason IS NULL
  AND a.correlation_id=NEW.correlation_id AND t.transaction_id=pg_current_xact_id()
  AND a.metadata=jsonb_build_object('bindingId',NEW.binding_id::text,'generationId',NEW.generation_id::text)) THEN
  RAISE EXCEPTION 'Missing atomic trunk reservation evidence' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$body$;
CREATE CONSTRAINT TRIGGER trunk_reservation_evidence AFTER INSERT OR UPDATE ON public.trunk_credential_reservations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_trunk_reservation_evidence();

REVOKE ALL ON public.trunk_credential_peer_scopes, public.trunk_credential_bindings, public.trunk_credential_generations, public.trunk_credential_reservations, public.trunk_credential_reservation_history, public.trunk_credential_audit_transactions FROM PUBLIC,myims_runtime,myims_trunk_owner;
GRANT SELECT ON public.trunk_credential_peer_scopes, public.trunk_credential_bindings, public.trunk_credential_generations, public.trunk_credential_reservations, public.trunk_credential_reservation_history TO myims_trunk_owner;
GRANT INSERT(id,node_id,installation_id,peer_id,purposes,created_by) ON public.trunk_credential_bindings TO myims_trunk_owner;
GRANT INSERT(id,binding_id,node_id,installation_id,peer_id,ordinal,operation_id) ON public.trunk_credential_generations TO myims_trunk_owner;
GRANT INSERT(id,binding_id,generation_id,request_id,operator_id,authentication_version,node_version,peer_revision,expected_owner_revision,correlation_id) ON public.trunk_credential_reservations TO myims_trunk_owner;
GRANT UPDATE(state,terminal_at) ON public.trunk_credential_reservations TO myims_trunk_owner;
GRANT INSERT(operation_id,state) ON public.trunk_credential_reservation_history TO myims_trunk_owner;
GRANT INSERT(id,event_type,schema_version,actor_kind,actor_reference,identity_plane,actor_tenant_id,system_reason,target_type,target_reference,tenant_id,correlation_id,metadata) ON public.audit_events TO myims_trunk_owner;
REVOKE ALL ON FUNCTION public.reject_trunk_owner_mutation(), public.protect_trunk_reservation(), public.check_trunk_generation_scope(), public.check_trunk_binding_purposes(), public.check_trunk_reservation_evidence(), public.record_trunk_audit_transaction() FROM PUBLIC,myims_runtime,myims_trunk_owner;

-- No eligibility, verification, claim or cleanup authority is exposed by this
-- foundation. Runtime reads explicitly enumerate only non-secret immutable facts.
CREATE VIEW public.trunk_credential_owner_references AS SELECT b.id AS binding_id,b.node_id,b.installation_id,b.peer_id,b.purposes,b.owner_revision,g.id AS generation_id,g.ordinal AS generation_ordinal,g.material_version,r.id AS operation_id,r.state AS reservation_state
 FROM public.trunk_credential_bindings b JOIN public.trunk_credential_generations g ON g.binding_id=b.id JOIN public.trunk_credential_reservations r ON r.id=g.operation_id;
REVOKE ALL ON public.trunk_credential_owner_references FROM PUBLIC,myims_runtime,myims_trunk_owner;
GRANT SELECT ON public.trunk_credential_owner_references TO myims_runtime,myims_trunk_owner;
COMMIT;
