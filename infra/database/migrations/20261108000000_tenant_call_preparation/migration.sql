BEGIN;
-- Trusted deployment owns preparation; HTTP can only inspect approved cases.
CREATE TABLE public.tenant_call_preparations (
 id uuid PRIMARY KEY, node_id uuid NOT NULL, installation_id uuid NOT NULL,
 operator_id uuid NOT NULL REFERENCES public.platform_operators(id),
 authentication_version integer NOT NULL CHECK(authentication_version>0),
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 definition jsonb NOT NULL CHECK(jsonb_typeof(definition)='object' AND octet_length(definition::text)<=65536),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(node_id,installation_id) REFERENCES public.pbx_nodes(id,installation_id)
);
CREATE TABLE public.tenant_call_preparation_steps (
 preparation_id uuid NOT NULL REFERENCES public.tenant_call_preparations(id),
 step text NOT NULL CHECK(step ~ '^[a-z][a-z0-9-]{0,63}$'),
 phase text NOT NULL CHECK(phase IN ('intent','outcome')),
 result jsonb NOT NULL CHECK(jsonb_typeof(result)='object' AND octet_length(result::text)<=16384),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(preparation_id,step,phase)
);
CREATE TABLE public.tenant_call_preparation_cases (
 preparation_id uuid NOT NULL REFERENCES public.tenant_call_preparations(id),
 case_id uuid PRIMARY KEY REFERENCES public.tenant_route_test_cases(id)
);
CREATE TABLE public.tenant_call_preparation_facts (
 preparation_id uuid NOT NULL REFERENCES public.tenant_call_preparations(id),
 kind text NOT NULL CHECK(kind IN ('tenant','extension','claim','gateway','trunk','inbound','outbound','did','profile')),
 resource_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),
 authority_version integer CHECK(authority_version>0),
 CHECK((kind='tenant')=(authority_version IS NOT NULL)),
 PRIMARY KEY(preparation_id,kind,resource_id)
);
CREATE TABLE public.tenant_call_preparation_events (
 request_id uuid PRIMARY KEY,preparation_id uuid NOT NULL REFERENCES public.tenant_call_preparations(id),
 version integer NOT NULL CHECK(version>0),
 action text NOT NULL CHECK(action IN ('start','stop','disable')),
 owner_epoch bigint NOT NULL CHECK(owner_epoch>0),
 participant_instance uuid,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(preparation_id,version)
);
CREATE TABLE public.tenant_call_participant_instances (
 node_id uuid PRIMARY KEY REFERENCES public.pbx_nodes(id),instance_id uuid NOT NULL,
 started_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON public.tenant_call_participant_instances FROM PUBLIC,myims_runtime,myims_pbx_executor;
GRANT SELECT ON public.tenant_call_participant_instances TO myims_runtime,myims_pbx_executor;
GRANT INSERT,UPDATE ON public.tenant_call_participant_instances TO myims_pbx_executor;
CREATE INDEX tenant_call_preparation_latest ON public.tenant_call_preparation_events(preparation_id,version DESC);
CREATE TABLE public.tenant_route_case_disables (
 case_id uuid PRIMARY KEY REFERENCES public.tenant_route_test_cases(id),
 request_id uuid NOT NULL, preparation_id uuid NOT NULL REFERENCES public.tenant_call_preparations(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.tenant_call_custody_proofs (
 node_id uuid PRIMARY KEY REFERENCES public.pbx_nodes(id),owner_epoch bigint NOT NULL CHECK(owner_epoch>0),
 source_digest text NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 valid boolean NOT NULL,checked_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON public.tenant_call_custody_proofs FROM PUBLIC,myims_runtime,myims_pbx_executor;
GRANT SELECT ON public.tenant_call_custody_proofs TO myims_runtime,myims_pbx_executor;
GRANT INSERT,UPDATE ON public.tenant_call_custody_proofs TO myims_pbx_executor;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['tenant_call_preparations','tenant_call_preparation_steps','tenant_call_preparation_cases','tenant_call_preparation_facts','tenant_call_preparation_events','tenant_route_case_disables'] LOOP
 EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.reject_pbx_live_history_change()',t||'_immutable',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,myims_runtime,myims_pbx_executor',t);
 EXECUTE format('GRANT SELECT ON public.%I TO myims_runtime,myims_pbx_executor',t);
 END LOOP;
END $$;
-- Disabled/superseded cases retain immutable provenance and prior results.
-- Existing isolated cases without a persistent preparation keep their contract.
CREATE FUNCTION public.tenant_case_preparation_available(target uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
 SELECT NOT EXISTS(SELECT 1 FROM public.tenant_route_case_disables d WHERE d.case_id=target)
 AND NOT EXISTS(
  SELECT 1 FROM public.tenant_call_preparation_cases c
  JOIN public.tenant_call_preparations p ON p.id=c.preparation_id
  LEFT JOIN LATERAL (SELECT e.action,e.owner_epoch,e.participant_instance FROM public.tenant_call_preparation_events e WHERE e.preparation_id=p.id ORDER BY e.version DESC LIMIT 1) e ON true
  LEFT JOIN public.tenant_call_participant_instances participant ON participant.node_id=p.node_id
  LEFT JOIN public.pbx_ownership o ON o.node_id=p.node_id
  WHERE c.case_id=target AND (e.action IS DISTINCT FROM 'start' OR e.owner_epoch IS DISTINCT FROM o.epoch OR o.expires_at IS NULL OR o.expires_at<=statement_timestamp()
   OR e.participant_instance IS NULL OR e.participant_instance IS DISTINCT FROM participant.instance_id
   OR (p.definition ? 'expectedNodeVersion' AND NOT EXISTS(SELECT 1 FROM public.pbx_nodes n WHERE n.id=p.node_id AND n.version=(p.definition->>'expectedNodeVersion')::integer))
   OR (p.definition ? 'expectedCapabilityRevision' AND NOT EXISTS(SELECT 1 FROM public.endpoint_capabilities capability WHERE capability.installation_id=p.installation_id AND capability.revision=(p.definition->>'expectedCapabilityRevision')::integer))
   OR NOT EXISTS(SELECT 1 FROM public.platform_operators actor WHERE actor.id=p.operator_id AND actor.authentication_version=p.authentication_version AND actor.status='active' AND actor.credential_state='ready')
   OR EXISTS(SELECT 1 FROM public.tenant_call_preparation_facts f LEFT JOIN (
    SELECT 'tenant' AS kind,id,version,authority_version FROM public.tenants UNION ALL
    SELECT 'extension',id,version,NULL FROM public.extensions UNION ALL
    SELECT 'claim',id,version,NULL FROM public.tenant_inventory_claims UNION ALL
    SELECT 'gateway',id,version,NULL FROM public.sip_gateways WHERE removed_at IS NULL UNION ALL
    SELECT 'trunk',id,version,NULL FROM public.sip_trunks WHERE removed_at IS NULL UNION ALL
    SELECT 'inbound',id,version,NULL FROM public.inbound_rules WHERE removed_at IS NULL UNION ALL
    SELECT 'outbound',id,version,NULL FROM public.outbound_rules WHERE removed_at IS NULL UNION ALL
    SELECT 'did',id,version,NULL FROM public.sip_dids WHERE removed_at IS NULL UNION ALL
    SELECT 'profile',id,head_version,NULL FROM public.endpoint_profiles
   ) actual ON actual.kind=f.kind AND actual.id=f.resource_id AND actual.version=f.version AND actual.authority_version IS NOT DISTINCT FROM f.authority_version
   WHERE f.preparation_id=p.id AND actual.id IS NULL)
   OR NOT EXISTS(SELECT 1 FROM public.tenant_call_custody_proofs f JOIN public.pbx_live_runtime r ON r.node_id=f.node_id JOIN public.pbx_live_artifacts a ON a.id=r.verified_id JOIN public.pbx_revisions v ON v.id=a.revision_id
    WHERE f.node_id=p.node_id AND f.owner_epoch=o.epoch AND f.valid AND f.checked_at>statement_timestamp()-interval '15 seconds' AND f.source_digest=v.source_digest))
 )
$$;
REVOKE ALL ON FUNCTION public.tenant_case_preparation_available(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_case_preparation_available(uuid) TO myims_runtime,myims_pbx_executor;
COMMIT;
