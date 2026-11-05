BEGIN;
CREATE TABLE public.pbx_artifact_retirement_intents (
 id uuid PRIMARY KEY,node_id uuid NOT NULL,predecessor_id uuid REFERENCES public.pbx_artifact_retirement_intents(id),
 artifact_id uuid NOT NULL,replacement_id uuid NOT NULL,resource_id uuid NOT NULL,
 operator_id uuid NOT NULL REFERENCES public.platform_operators(id), authentication_version integer NOT NULL CHECK(authentication_version>0),
 request_id uuid NOT NULL,fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(operator_id,request_id),UNIQUE(id,node_id),
 FOREIGN KEY(artifact_id,node_id) REFERENCES public.pbx_live_artifacts(id,node_id),
 FOREIGN KEY(replacement_id,node_id) REFERENCES public.pbx_live_artifacts(id,node_id),
 FOREIGN KEY(resource_id) REFERENCES public.extensions(id),
 CHECK(artifact_id<>replacement_id)
);
CREATE TABLE public.pbx_artifact_retirement_progress (
 intent_id uuid PRIMARY KEY REFERENCES public.pbx_artifact_retirement_intents(id),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','retired','rejected','unknown')),
 owner_epoch bigint,updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.pbx_artifact_retirements (
 artifact_id uuid PRIMARY KEY REFERENCES public.pbx_live_artifacts(id),
 intent_id uuid NOT NULL UNIQUE REFERENCES public.pbx_artifact_retirement_intents(id),
 replacement_id uuid NOT NULL REFERENCES public.pbx_live_artifacts(id),
 owner_epoch bigint NOT NULL CHECK(owner_epoch>0),
 retired_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER pbx_retirement_intent_immutable BEFORE UPDATE OR DELETE ON public.pbx_artifact_retirement_intents FOR EACH ROW EXECUTE FUNCTION public.reject_pbx_live_history_change();
CREATE TRIGGER pbx_retirement_result_immutable BEFORE UPDATE OR DELETE ON public.pbx_artifact_retirements FOR EACH ROW EXECUTE FUNCTION public.reject_pbx_live_history_change();
ALTER TABLE public.pbx_live_runtime ADD COLUMN active_retirement_id uuid REFERENCES public.pbx_artifact_retirement_intents(id);
CREATE FUNCTION public.invalidate_retirement_generation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.active_retirement_id IS DISTINCT FROM OLD.active_retirement_id THEN NEW.routing_generation:=NEW.routing_generation+1; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zz_retirement_generation BEFORE UPDATE ON public.pbx_live_runtime FOR EACH ROW EXECUTE FUNCTION public.invalidate_retirement_generation();
ALTER TABLE public.pbx_live_pins ADD COLUMN release_retirement_id uuid REFERENCES public.pbx_artifact_retirement_intents(id);
DO $$ DECLARE c text; BEGIN
 SELECT conname INTO c FROM pg_constraint WHERE conrelid='public.pbx_live_pins'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%release_operation_id%';
 EXECUTE format('ALTER TABLE public.pbx_live_pins DROP CONSTRAINT %I',c);
END $$;
ALTER TABLE public.pbx_live_pins ADD CHECK((released_at IS NULL)=(release_operation_id IS NULL AND release_retirement_id IS NULL)),
 ADD CHECK(release_operation_id IS NULL OR release_retirement_id IS NULL);
REVOKE ALL ON public.pbx_artifact_retirement_intents,public.pbx_artifact_retirement_progress,public.pbx_artifact_retirements FROM PUBLIC,myims_runtime;
GRANT SELECT ON public.pbx_artifact_retirement_intents,public.pbx_artifact_retirement_progress,public.pbx_artifact_retirements TO myims_runtime,myims_pbx_executor;
GRANT INSERT ON public.pbx_artifact_retirement_intents TO myims_runtime;
GRANT INSERT(intent_id) ON public.pbx_artifact_retirement_progress TO myims_runtime;
GRANT UPDATE(active_retirement_id) ON public.pbx_live_runtime TO myims_runtime,myims_pbx_executor;
GRANT UPDATE(release_retirement_id) ON public.pbx_live_pins TO myims_pbx_executor;
GRANT UPDATE ON public.pbx_artifact_retirement_progress TO myims_pbx_executor;
GRANT INSERT ON public.pbx_artifact_retirements TO myims_pbx_executor;
COMMIT;
