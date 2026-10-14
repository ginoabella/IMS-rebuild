BEGIN;
-- The preceding migration is already applied locally: harden through a new
-- version rather than rewriting applied migration history.
CREATE OR REPLACE FUNCTION public.protect_pbx_epoch() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Epoch deletion denied' USING ERRCODE='23514'; END IF;
 IF NEW.node_id<>OLD.node_id OR NEW.epoch<OLD.epoch OR NEW.epoch>OLD.epoch+1 OR
   (NEW.incarnation IS DISTINCT FROM OLD.incarnation AND NEW.incarnation IS NOT NULL AND NEW.epoch<>OLD.epoch+1) OR
   (NEW.epoch>OLD.epoch AND OLD.expires_at>clock_timestamp()) OR
   (NEW.epoch=OLD.epoch AND OLD.expires_at<=clock_timestamp() AND NEW.expires_at>clock_timestamp()) THEN
  RAISE EXCEPTION 'Invalid ownership generation' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$body$;
REVOKE INSERT,UPDATE ON public.pbx_observations,public.pbx_ownership FROM myims_runtime;
GRANT INSERT(node_id,desired_version) ON public.pbx_observations,public.pbx_ownership TO myims_runtime;
GRANT UPDATE(desired_version,epoch,sequence,last_success_at,connection,reconciliation,failure,registrations,coverage,updated_at) ON public.pbx_observations TO myims_runtime;
GRANT UPDATE(epoch,incarnation,desired_version,expires_at) ON public.pbx_ownership TO myims_runtime;
COMMIT;
