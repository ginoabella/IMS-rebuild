BEGIN;
CREATE TABLE public.pbx_live_runtime (
 node_id uuid PRIMARY KEY REFERENCES public.pbx_nodes(id),
 installed_id uuid, verified_id uuid, known_good_id uuid,
 runtime_state text NOT NULL DEFAULT 'unavailable' CHECK(runtime_state IN ('unavailable','verified','unknown','failed')),
 active_operation_id uuid, baseline_verified_at timestamptz, executor_seen_at timestamptz,
 boundary_epoch bigint NOT NULL DEFAULT 0 CHECK(boundary_epoch>=0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.pbx_live_operations (
 id uuid PRIMARY KEY, node_id uuid NOT NULL, installation_id uuid NOT NULL,
 predecessor_id uuid,
 sequence integer NOT NULL CHECK(sequence>0), kind text NOT NULL CHECK(kind IN ('apply','recover','reconcile')),
 revision_id uuid, expected_baseline_id uuid NOT NULL, target_id uuid NOT NULL,
 operator_id uuid NOT NULL REFERENCES public.platform_operators(id), authentication_version integer NOT NULL CHECK(authentication_version>0),
 request_id uuid NOT NULL, fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 correlation_id text NOT NULL CHECK(correlation_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(node_id,sequence), UNIQUE(operator_id,request_id), UNIQUE(id,node_id),
 FOREIGN KEY(node_id,installation_id) REFERENCES public.pbx_nodes(id,installation_id),
 FOREIGN KEY(predecessor_id,node_id) REFERENCES public.pbx_live_operations(id,node_id),
 FOREIGN KEY(revision_id,node_id) REFERENCES public.pbx_revisions(id,node_id),
 CHECK((kind='apply' AND revision_id IS NOT NULL AND revision_id=target_id) OR (kind<>'apply' AND revision_id IS NULL))
);
CREATE TABLE public.pbx_live_progress (
 operation_id uuid PRIMARY KEY, node_id uuid NOT NULL,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','waiting','validating','installing','reloading','verifying','recovering','verified','recovered','validation_failed','failed','unknown','revoked')),
 validation text NOT NULL DEFAULT 'pending' CHECK(validation IN ('pending','passed','failed')),
 installation text NOT NULL DEFAULT 'pending' CHECK(installation IN ('pending','uncertain','installed','failed')),
 verification text NOT NULL DEFAULT 'pending' CHECK(verification IN ('pending','passed','failed','unknown')),
 recovery text NOT NULL DEFAULT 'not_required' CHECK(recovery IN ('not_required','pending','passed','failed','unknown')),
 failure text CHECK(failure IN ('activity_busy','activity_unknown','activity_deadline','originator_revoked','stale_dependencies','boundary_unavailable','stale_owner','validation_failed','install_failed','reload_failed','verification_failed','recovery_failed','reconciliation_required','material_invalid','material_missing','material_denied','material_unavailable')),
 delivered_at timestamptz,
 attempt integer NOT NULL DEFAULT 0 CHECK(attempt BETWEEN 0 AND 6),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(operation_id,node_id) REFERENCES public.pbx_live_operations(id,node_id)
);
ALTER TABLE public.pbx_live_runtime ADD FOREIGN KEY(active_operation_id,node_id) REFERENCES public.pbx_live_operations(id,node_id);
CREATE TABLE public.pbx_live_artifacts (
 id uuid PRIMARY KEY, node_id uuid NOT NULL REFERENCES public.pbx_nodes(id),
 revision_id uuid, initial_baseline boolean NOT NULL,
 verified_at timestamptz NOT NULL, operation_id uuid REFERENCES public.pbx_live_operations(id),
 FOREIGN KEY(revision_id,node_id) REFERENCES public.pbx_revisions(id,node_id),
 UNIQUE(id,node_id), CHECK(initial_baseline=(revision_id IS NULL))
);
ALTER TABLE public.pbx_live_runtime ADD FOREIGN KEY(verified_id,node_id) REFERENCES public.pbx_live_artifacts(id,node_id);
ALTER TABLE public.pbx_live_runtime ADD FOREIGN KEY(known_good_id,node_id) REFERENCES public.pbx_live_artifacts(id,node_id);
ALTER TABLE public.pbx_live_operations ADD FOREIGN KEY(expected_baseline_id,node_id) REFERENCES public.pbx_live_artifacts(id,node_id);
CREATE TABLE public.pbx_live_pins (
 revision_id uuid NOT NULL REFERENCES public.pbx_revisions(id), node_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('node','capability','profiles','extensions','trunks','gateways','dids','groups','reservations','inbound','outbound','credentials')),
 resource_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 material_kind text CHECK(material_kind IN ('endpoint','trunk')), material_version integer CHECK(material_version>0),
 CHECK((kind='credentials' AND material_kind IS NOT NULL AND material_version IS NOT NULL) OR (kind<>'credentials' AND material_kind IS NULL AND material_version IS NULL)),
 CHECK(material_kind<>'endpoint' OR material_version=1),
 released_at timestamptz, release_operation_id uuid REFERENCES public.pbx_live_operations(id),
 PRIMARY KEY(revision_id,kind,resource_id,version),
 FOREIGN KEY(revision_id,node_id) REFERENCES public.pbx_revisions(id,node_id),
 CHECK((released_at IS NULL)=(release_operation_id IS NULL))
);
CREATE INDEX pbx_live_pin_dependency ON public.pbx_live_pins(node_id,kind,resource_id) WHERE released_at IS NULL;
CREATE FUNCTION public.reject_pbx_live_history_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Immutable live history' USING ERRCODE='23514'; END $$;
CREATE TRIGGER pbx_live_intent_immutable BEFORE UPDATE OR DELETE ON public.pbx_live_operations FOR EACH ROW EXECUTE FUNCTION public.reject_pbx_live_history_change();
CREATE TRIGGER pbx_live_artifact_immutable BEFORE UPDATE OR DELETE ON public.pbx_live_artifacts FOR EACH ROW EXECUTE FUNCTION public.reject_pbx_live_history_change();
REVOKE ALL ON public.pbx_live_runtime,public.pbx_live_operations,public.pbx_live_progress,public.pbx_live_artifacts,public.pbx_live_pins FROM PUBLIC,myims_runtime;
GRANT SELECT,INSERT ON public.pbx_live_operations TO myims_runtime;
GRANT SELECT ON public.pbx_live_runtime,public.pbx_live_progress,public.pbx_live_artifacts TO myims_runtime;
GRANT INSERT(operation_id,node_id) ON public.pbx_live_progress TO myims_runtime;
GRANT UPDATE(delivered_at) ON public.pbx_live_progress TO myims_runtime;
GRANT UPDATE(active_operation_id,updated_at) ON public.pbx_live_runtime TO myims_runtime;
GRANT SELECT,INSERT ON public.pbx_live_pins TO myims_runtime;
GRANT UPDATE(released_at,release_operation_id) ON public.pbx_live_pins TO myims_runtime;
-- Canonical writers already lock node first. This trigger also fences trusted
-- direct structural mutations and keeps older runtime pins across desired edits.
CREATE FUNCTION public.protect_pbx_live_dependency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n uuid; r uuid; k text; changed boolean; fields text[]; before_row jsonb; after_row jsonb;
BEGIN
 k:=TG_ARGV[0]; r:=OLD.id;
 IF k='node' THEN n:=OLD.id; ELSE n:=OLD.node_id; END IF;
 PERFORM id FROM public.pbx_nodes WHERE id=n FOR SHARE;
 changed:=TG_OP='DELETE';
 IF TG_OP='UPDATE' THEN
  before_row:=to_jsonb(OLD); after_row:=to_jsonb(NEW);
  fields:=CASE k
   WHEN 'node' THEN ARRAY['installation_id','target_alias','host','port','transport','tls_server_name']
   WHEN 'extensions' THEN ARRAY['number','kind','profile_id']
   WHEN 'trunks' THEN ARRAY['removed_at','direction']
   WHEN 'gateways' THEN ARRAY['removed_at','kind','trunk_id']
   WHEN 'dids' THEN ARRAY['removed_at','number','gateway_id']
   WHEN 'groups' THEN ARRAY['removed_at','number']
   ELSE ARRAY['removed_at'] END;
  SELECT EXISTS(SELECT 1 FROM unnest(fields) f WHERE after_row->f IS DISTINCT FROM before_row->f) INTO changed;
  IF k='trunks' THEN changed:=changed OR ((after_row->'settings')-ARRAY['credential','registration','authentication']) IS DISTINCT FROM ((before_row->'settings')-ARRAY['credential','registration','authentication']); END IF;
 END IF;
 IF changed AND (EXISTS(SELECT 1 FROM public.pbx_live_pins WHERE node_id=n AND kind=k AND resource_id=r AND released_at IS NULL) OR (k='node' AND EXISTS(SELECT 1 FROM public.pbx_live_runtime WHERE node_id=n AND baseline_verified_at IS NOT NULL))) THEN
  RAISE EXCEPTION 'retained_runtime_dependency' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER live_node_dependency BEFORE UPDATE OR DELETE ON public.pbx_nodes FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_live_dependency('node');
CREATE TRIGGER live_extension_dependency BEFORE UPDATE OR DELETE ON public.extensions FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_live_dependency('extensions');
CREATE TRIGGER live_trunk_dependency BEFORE UPDATE OR DELETE ON public.sip_trunks FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_live_dependency('trunks');
CREATE TRIGGER live_gateway_dependency BEFORE UPDATE OR DELETE ON public.sip_gateways FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_live_dependency('gateways');
CREATE TRIGGER live_did_dependency BEFORE UPDATE OR DELETE ON public.sip_dids FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_live_dependency('dids');
CREATE TRIGGER live_group_dependency BEFORE UPDATE OR DELETE ON public.ring_groups FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_live_dependency('groups');
CREATE TRIGGER live_reservation_dependency BEFORE UPDATE OR DELETE ON public.number_reservations FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_live_dependency('reservations');
CREATE TRIGGER live_inbound_dependency BEFORE UPDATE OR DELETE ON public.inbound_rules FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_live_dependency('inbound');
CREATE TRIGGER live_outbound_dependency BEFORE UPDATE OR DELETE ON public.outbound_rules FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_live_dependency('outbound');
CREATE FUNCTION public.protect_pbx_live_gateway_source() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n uuid; g uuid;
BEGIN
 IF TG_OP='UPDATE' AND NEW.gateway_id IS DISTINCT FROM OLD.gateway_id AND
 EXISTS(SELECT 1 FROM public.pbx_live_pins WHERE kind='gateways' AND resource_id=OLD.gateway_id AND released_at IS NULL) THEN
  RAISE EXCEPTION 'retained_runtime_dependency' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN g:=OLD.gateway_id; ELSE g:=NEW.gateway_id; END IF;
 SELECT node_id INTO n FROM public.sip_gateways WHERE id=g;
 PERFORM id FROM public.pbx_nodes WHERE id=n FOR SHARE;
 IF EXISTS(SELECT 1 FROM public.pbx_live_pins WHERE node_id=n AND kind='gateways' AND resource_id=g AND released_at IS NULL)
 AND (TG_OP<>'UPDATE' OR NEW IS DISTINCT FROM OLD) THEN
  RAISE EXCEPTION 'retained_runtime_dependency' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER live_gateway_source_dependency BEFORE INSERT OR UPDATE OR DELETE ON public.sip_gateway_sources FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_live_gateway_source();
CREATE FUNCTION public.protect_pbx_live_credential() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n uuid; installation uuid; resource uuid; material integer; changed boolean;
BEGIN
 IF TG_TABLE_NAME='sip_credentials' THEN
  installation:=OLD.installation_id;resource:=OLD.id;material:=NULL;
  changed:=TG_OP='DELETE';
  IF TG_OP='UPDATE' THEN changed:=(OLD.available AND NOT NEW.available) OR NEW.id IS DISTINCT FROM OLD.id OR NEW.installation_id IS DISTINCT FROM OLD.installation_id OR NEW.purpose IS DISTINCT FROM OLD.purpose; END IF;
 ELSE
  resource:=OLD.credential_id;material:=OLD.material_version;
  SELECT installation_id INTO installation FROM public.sip_credentials WHERE id=resource;
  changed:=TG_OP='DELETE';
  IF TG_OP='UPDATE' THEN changed:=(OLD.available AND NOT NEW.available) OR NEW.credential_id IS DISTINCT FROM OLD.credential_id OR NEW.material_version IS DISTINCT FROM OLD.material_version; END IF;
 END IF;
 IF changed THEN
  SELECT id INTO n FROM public.pbx_nodes WHERE installation_id=installation FOR SHARE;
  IF EXISTS(SELECT 1 FROM public.pbx_live_pins WHERE node_id=n AND kind='credentials' AND material_kind='trunk' AND resource_id=resource AND (material IS NULL OR material_version=material) AND released_at IS NULL) THEN
   RAISE EXCEPTION 'retained_runtime_dependency' USING ERRCODE='23514';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER live_credential_dependency BEFORE UPDATE OR DELETE ON public.sip_credentials FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_live_credential();
CREATE TRIGGER live_credential_version_dependency BEFORE UPDATE OR DELETE ON public.sip_credential_versions FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_live_credential();
CREATE FUNCTION public.protect_pbx_live_pin_release() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.released_at IS NOT NULL AND current_user NOT IN ('myims_pbx_executor', 'myims') THEN
  RAISE EXCEPTION 'Runtime pin release requires execution authority' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER live_pin_release BEFORE UPDATE ON public.pbx_live_pins FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_live_pin_release();
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='myims_pbx_executor') THEN CREATE ROLE myims_pbx_executor NOLOGIN; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='myims_pbx_executor' AND (rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls)) THEN RAISE EXCEPTION 'Invalid PBX executor role'; END IF;
END $$;
GRANT USAGE ON SCHEMA public TO myims_pbx_executor;
GRANT SELECT ON public.pbx_nodes,public.pbx_observations,public.pbx_ownership,public.pbx_revisions,public.pbx_revision_validations,public.pbx_live_operations,public.pbx_live_progress,public.pbx_live_runtime,public.pbx_live_artifacts,public.pbx_live_pins,
 public.endpoint_profiles,public.endpoint_profile_versions,public.endpoint_capabilities,public.extensions,public.endpoint_credential_operations,
 public.sip_trunks,public.sip_gateways,public.sip_gateway_sources,public.sip_dids,public.ring_groups,public.ring_group_members,public.number_reservations,public.inbound_rules,public.outbound_rules,public.sip_credentials,public.sip_credential_versions,public.sip_credential_imports TO myims_pbx_executor;
GRANT SELECT(id,status,credential_state,version,authentication_version,password_hash,credential_changed_at) ON public.platform_operators TO myims_pbx_executor;
-- These identity-column grants permit canonical row locks, not ordinary resource edits.
GRANT UPDATE(id) ON public.pbx_nodes TO myims_pbx_executor;
GRANT UPDATE(node_id) ON public.pbx_observations,public.pbx_ownership TO myims_pbx_executor;
GRANT INSERT ON public.audit_events,public.pbx_live_artifacts,public.pbx_live_runtime TO myims_pbx_executor;
GRANT UPDATE(state,validation,installation,verification,recovery,failure,attempt,updated_at) ON public.pbx_live_progress TO myims_pbx_executor;
GRANT UPDATE(installed_id,verified_id,known_good_id,runtime_state,active_operation_id,baseline_verified_at,executor_seen_at,boundary_epoch,updated_at) ON public.pbx_live_runtime TO myims_pbx_executor;
GRANT UPDATE(released_at,release_operation_id) ON public.pbx_live_pins TO myims_pbx_executor;
COMMIT;
