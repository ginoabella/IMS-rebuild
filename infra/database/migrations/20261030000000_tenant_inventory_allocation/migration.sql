BEGIN;
ALTER TABLE public.extensions ADD CONSTRAINT extension_allocation_identity UNIQUE(id,node_id,installation_id);
CREATE TABLE public.tenant_inventory_claims (
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
 node_id uuid NOT NULL, installation_id uuid NOT NULL, extension_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('reserved','allocated','released')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_by uuid NOT NULL REFERENCES public.platform_operators(id), updated_by uuid NOT NULL REFERENCES public.platform_operators(id),
 FOREIGN KEY(extension_id,node_id,installation_id) REFERENCES public.extensions(id,node_id,installation_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX tenant_inventory_exclusive ON public.tenant_inventory_claims(extension_id) WHERE state<>'released';
CREATE INDEX tenant_inventory_page ON public.tenant_inventory_claims(tenant_id,node_id,id);
CREATE TABLE public.tenant_inventory_history (
 claim_id uuid NOT NULL REFERENCES public.tenant_inventory_claims(id), version integer NOT NULL CHECK(version>0),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id), node_id uuid NOT NULL, installation_id uuid NOT NULL, extension_id uuid NOT NULL,
 old_state text CHECK(old_state IN ('reserved','allocated')), state text NOT NULL CHECK(state IN ('reserved','allocated','released')),
 actor_id uuid NOT NULL REFERENCES public.platform_operators(id), changed_at timestamptz NOT NULL,
 PRIMARY KEY(claim_id,version),
 FOREIGN KEY(extension_id,node_id,installation_id) REFERENCES public.extensions(id,node_id,installation_id)
);
CREATE TABLE public.tenant_inventory_receipts (
 operator_id uuid NOT NULL REFERENCES public.platform_operators(id), request_id uuid NOT NULL,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 result jsonb NOT NULL CHECK(jsonb_typeof(result)='object' AND octet_length(result::text)<=65536),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(operator_id,request_id)
);
CREATE FUNCTION public.protect_tenant_inventory_claim() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retained allocation history' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>1 OR NEW.state='released' THEN RAISE EXCEPTION 'Invalid initial claim' USING ERRCODE='23514'; END IF;
 ELSE
  IF (NEW.id,NEW.tenant_id,NEW.node_id,NEW.installation_id,NEW.extension_id,NEW.created_at,NEW.created_by)
      IS DISTINCT FROM (OLD.id,OLD.tenant_id,OLD.node_id,OLD.installation_id,OLD.extension_id,OLD.created_at,OLD.created_by)
   OR NEW.version<>OLD.version+1 OR NEW.updated_at<OLD.updated_at
   OR NOT ((OLD.state='reserved' AND NEW.state IN ('allocated','released')) OR (OLD.state='allocated' AND NEW.state='released'))
  THEN RAISE EXCEPTION 'Invalid allocation transition' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tenant_inventory_protection BEFORE INSERT OR UPDATE OR DELETE ON public.tenant_inventory_claims FOR EACH ROW EXECUTE FUNCTION public.protect_tenant_inventory_claim();
CREATE FUNCTION public.record_tenant_inventory_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 INSERT INTO public.tenant_inventory_history(claim_id,version,tenant_id,node_id,installation_id,extension_id,old_state,state,actor_id,changed_at)
 VALUES(NEW.id,NEW.version,NEW.tenant_id,NEW.node_id,NEW.installation_id,NEW.extension_id,CASE WHEN TG_OP='UPDATE' THEN OLD.state ELSE NULL END,NEW.state,NEW.updated_by,NEW.updated_at);
 RETURN NEW;
END $$;
CREATE TRIGGER tenant_inventory_history_write AFTER INSERT OR UPDATE ON public.tenant_inventory_claims FOR EACH ROW EXECUTE FUNCTION public.record_tenant_inventory_history();
CREATE TRIGGER tenant_inventory_history_immutable BEFORE UPDATE OR DELETE ON public.tenant_inventory_history FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_receipt();
CREATE TRIGGER tenant_inventory_receipt_immutable BEFORE UPDATE OR DELETE ON public.tenant_inventory_receipts FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_receipt();
CREATE FUNCTION public.protect_allocated_extension() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.profile_id,NEW.profile_version,NEW.credential_generation_id) IS DISTINCT FROM (OLD.profile_id,OLD.profile_version,OLD.credential_generation_id)
 AND EXISTS(SELECT 1 FROM public.tenant_inventory_claims WHERE extension_id=OLD.id AND state<>'released')
 THEN RAISE EXCEPTION 'Allocated inventory dependency' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER extension_allocation_dependency BEFORE UPDATE ON public.extensions FOR EACH ROW EXECUTE FUNCTION public.protect_allocated_extension();
REVOKE ALL ON FUNCTION public.protect_tenant_inventory_claim(),public.record_tenant_inventory_history(),public.protect_allocated_extension() FROM PUBLIC;
REVOKE ALL ON public.tenant_inventory_claims,public.tenant_inventory_history,public.tenant_inventory_receipts FROM PUBLIC,myims_runtime;
GRANT SELECT,INSERT ON public.tenant_inventory_claims,public.tenant_inventory_receipts TO myims_runtime;
GRANT SELECT ON public.tenant_inventory_history TO myims_runtime;
GRANT UPDATE(state,version,updated_at,updated_by) ON public.tenant_inventory_claims TO myims_runtime;
COMMIT;
