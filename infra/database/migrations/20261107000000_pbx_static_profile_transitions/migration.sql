BEGIN;
CREATE TABLE public.pbx_static_profiles (
 node_id uuid NOT NULL REFERENCES public.pbx_nodes(id),
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(node_id,digest)
);
CREATE TABLE public.pbx_profile_operations (
 id uuid PRIMARY KEY,node_id uuid NOT NULL,installation_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('upgrade','rollback')),
 predecessor_id uuid,
 source_artifact_id uuid NOT NULL,source_digest text NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 target_artifact_id uuid NOT NULL,target_digest text NOT NULL CHECK(target_digest ~ '^[a-f0-9]{64}$'),
 source_revision_id uuid, expected_node_version integer NOT NULL CHECK(expected_node_version>0),
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(id,node_id),
 FOREIGN KEY(node_id,installation_id) REFERENCES public.pbx_nodes(id,installation_id),
 FOREIGN KEY(predecessor_id,node_id) REFERENCES public.pbx_profile_operations(id,node_id),
 FOREIGN KEY(source_artifact_id,node_id) REFERENCES public.pbx_live_artifacts(id,node_id),
 FOREIGN KEY(source_revision_id,node_id) REFERENCES public.pbx_revisions(id,node_id)
);
CREATE TABLE public.pbx_profile_progress (
 operation_id uuid PRIMARY KEY REFERENCES public.pbx_profile_operations(id),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','preparing','prepared','restart_dispatched','verified','rolled_back','unknown')),
 failure text CHECK(failure IN ('activity_busy','activity_unknown','custody_unavailable','stale_owner','wrong_target','proof_unavailable','reconciliation_required')),
 owner_epoch bigint,updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.pbx_artifact_profiles (
 artifact_id uuid PRIMARY KEY,node_id uuid NOT NULL,
 digest text NOT NULL,operation_id uuid REFERENCES public.pbx_profile_operations(id),
 FOREIGN KEY(artifact_id,node_id) REFERENCES public.pbx_live_artifacts(id,node_id),
 FOREIGN KEY(node_id,digest) REFERENCES public.pbx_static_profiles(node_id,digest)
);
CREATE TABLE public.pbx_profile_artifact_bindings (
 artifact_id uuid PRIMARY KEY,node_id uuid NOT NULL,digest text NOT NULL,
 FOREIGN KEY(node_id,digest) REFERENCES public.pbx_static_profiles(node_id,digest)
);
CREATE TRIGGER pbx_profile_binding_immutable BEFORE UPDATE OR DELETE ON public.pbx_profile_artifact_bindings FOR EACH ROW EXECUTE FUNCTION public.reject_pbx_live_history_change();
REVOKE ALL ON public.pbx_profile_artifact_bindings FROM PUBLIC,myims_runtime;
GRANT SELECT,INSERT ON public.pbx_profile_artifact_bindings TO myims_pbx_executor;
ALTER TABLE public.pbx_live_runtime ADD COLUMN active_profile_operation_id uuid,
 ADD FOREIGN KEY(active_profile_operation_id,node_id) REFERENCES public.pbx_profile_operations(id,node_id);
ALTER TABLE public.pbx_live_artifacts ADD COLUMN profile_operation_id uuid,
 ADD FOREIGN KEY(profile_operation_id,node_id) REFERENCES public.pbx_profile_operations(id,node_id);
CREATE FUNCTION public.fence_pbx_profile_operation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.active_profile_operation_id IS NOT NULL AND
   (NEW.active_operation_id IS DISTINCT FROM OLD.active_operation_id OR NEW.active_retirement_id IS DISTINCT FROM OLD.active_retirement_id)
 THEN RAISE EXCEPTION 'Profile operation unresolved' USING ERRCODE='23514'; END IF;
 IF NEW.active_profile_operation_id IS NOT NULL AND (NEW.active_operation_id IS NOT NULL OR NEW.active_retirement_id IS NOT NULL)
 THEN RAISE EXCEPTION 'PBX operation unresolved' USING ERRCODE='23514'; END IF;
 IF NEW.active_profile_operation_id IS DISTINCT FROM OLD.active_profile_operation_id THEN
  NEW.routing_generation:=NEW.routing_generation+1;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zzz_profile_operation_fence BEFORE UPDATE ON public.pbx_live_runtime FOR EACH ROW EXECUTE FUNCTION public.fence_pbx_profile_operation();
CREATE TRIGGER pbx_static_profile_immutable BEFORE UPDATE OR DELETE ON public.pbx_static_profiles FOR EACH ROW EXECUTE FUNCTION public.reject_pbx_live_history_change();
CREATE TRIGGER pbx_artifact_profile_immutable BEFORE UPDATE OR DELETE ON public.pbx_artifact_profiles FOR EACH ROW EXECUTE FUNCTION public.reject_pbx_live_history_change();
CREATE TRIGGER pbx_profile_operation_immutable BEFORE UPDATE OR DELETE ON public.pbx_profile_operations FOR EACH ROW EXECUTE FUNCTION public.reject_pbx_live_history_change();
REVOKE ALL ON public.pbx_static_profiles,public.pbx_profile_operations,public.pbx_profile_progress,public.pbx_artifact_profiles FROM PUBLIC,myims_runtime;
GRANT SELECT ON public.pbx_static_profiles,public.pbx_profile_operations,public.pbx_profile_progress,public.pbx_artifact_profiles TO myims_runtime,myims_pbx_executor;
GRANT INSERT ON public.pbx_static_profiles,public.pbx_artifact_profiles TO myims_pbx_executor;
GRANT UPDATE ON public.pbx_profile_progress TO myims_pbx_executor;
GRANT UPDATE(active_profile_operation_id) ON public.pbx_live_runtime TO myims_pbx_executor;
-- Profile artifacts may refer to an existing immutable revision with a new
-- materialized marker. They are never relabelled as an initial baseline.
GRANT INSERT(profile_operation_id) ON public.pbx_live_artifacts TO myims_pbx_executor;
COMMIT;
