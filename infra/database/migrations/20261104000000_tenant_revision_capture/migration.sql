BEGIN;
-- Tenancy-owned safe fact port, callable inside the telephony capture statement.
-- Invoker rights preserve the process-specific canonical read grants.
CREATE FUNCTION public.tenant_routing_capture(tenant_ids uuid[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog,public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version,
  'authorityVersion',authority_version,'status',status,'voicePreference',voice_preference) ORDER BY id),'[]'::jsonb)
 FROM (SELECT id,version,authority_version,status,voice_preference FROM public.tenants
       WHERE id=ANY(tenant_ids) ORDER BY id LIMIT 2049) t
$$;
REVOKE ALL ON FUNCTION public.tenant_routing_capture(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_routing_capture(uuid[]) TO myims_runtime,myims_pbx_executor;
GRANT SELECT(id,version,authority_version,status,voice_preference) ON public.tenants TO myims_pbx_executor;
GRANT SELECT ON public.tenant_inventory_claims,public.tenant_route_authorizations TO myims_pbx_executor;
ALTER TABLE public.pbx_live_pins DROP CONSTRAINT pbx_live_pins_kind_check,
 ADD CONSTRAINT pbx_live_pins_kind_check CHECK(kind IN ('node','capability','profiles','extensions','trunks','gateways','dids','groups','reservations','inbound','outbound','credentials','tenants','allocations','authorizations'));
COMMIT;
