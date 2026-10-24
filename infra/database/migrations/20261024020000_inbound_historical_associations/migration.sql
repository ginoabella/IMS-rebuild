BEGIN;
-- Historical removed rules retain their original ingress tuple. A live selector
-- must match the current DID association, but history must not pin mutable ingress.
ALTER TABLE public.sip_dids ADD UNIQUE(id,node_id,installation_id);
DO $$
DECLARE association_constraint name;
BEGIN
 SELECT conname INTO STRICT association_constraint FROM pg_constraint
 WHERE conrelid='public.inbound_rules'::regclass
 AND confrelid='public.sip_dids'::regclass AND contype='f';
 EXECUTE format('ALTER TABLE public.inbound_rules DROP CONSTRAINT %I',association_constraint);
END $$;
ALTER TABLE public.inbound_rules ADD CONSTRAINT inbound_did_ownership
 FOREIGN KEY(did_id,node_id,installation_id) REFERENCES public.sip_dids(id,node_id,installation_id);
CREATE FUNCTION public.check_current_inbound_did_association() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE associated_gateway uuid;
BEGIN
 IF NEW.removed_at IS NULL AND NEW.did_id IS NOT NULL THEN
  -- Share-lock the DID before checking its association. DID ingress updates take
  -- an incompatible row lock, so direct competing SQL cannot commit a mismatch.
  SELECT gateway_id INTO associated_gateway FROM public.sip_dids
   WHERE id=NEW.did_id AND node_id=NEW.node_id AND installation_id=NEW.installation_id FOR SHARE;
  IF associated_gateway IS DISTINCT FROM NEW.gateway_id THEN
   RAISE EXCEPTION 'Invalid current inbound DID association' USING ERRCODE='23503';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION public.protect_current_inbound_did_association() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.gateway_id IS DISTINCT FROM OLD.gateway_id AND EXISTS(
  SELECT 1 FROM public.inbound_rules WHERE did_id=OLD.id AND removed_at IS NULL
  AND gateway_id IS DISTINCT FROM NEW.gateway_id
 ) THEN RAISE EXCEPTION 'DID has current inbound references' USING ERRCODE='23503';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER inbound_did_association BEFORE INSERT OR UPDATE ON public.inbound_rules
 FOR EACH ROW EXECUTE FUNCTION public.check_current_inbound_did_association();
CREATE TRIGGER did_inbound_association BEFORE UPDATE OF gateway_id ON public.sip_dids
 FOR EACH ROW EXECUTE FUNCTION public.protect_current_inbound_did_association();
REVOKE ALL ON FUNCTION public.check_current_inbound_did_association(),public.protect_current_inbound_did_association() FROM PUBLIC;
COMMIT;
