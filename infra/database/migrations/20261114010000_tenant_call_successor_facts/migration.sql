BEGIN;
-- Trusted append-only successor metadata; original preparation/case facts survive.
CREATE TABLE public.tenant_call_preparation_fact_sets (
 preparation_id uuid NOT NULL REFERENCES public.tenant_call_preparations(id),
 generation integer NOT NULL CHECK(generation BETWEEN 1 AND 1000),
 request_id uuid NOT NULL UNIQUE,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 operator_id uuid NOT NULL REFERENCES public.platform_operators(id),
 authentication_version integer NOT NULL CHECK(authentication_version>0),
 source_digest text NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 facts jsonb NOT NULL CHECK(jsonb_typeof(facts)='array' AND jsonb_array_length(facts) BETWEEN 1 AND 128 AND octet_length(facts::text)<=65536),
 case_ids uuid[] NOT NULL CHECK(cardinality(case_ids) BETWEEN 1 AND 32),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(preparation_id,generation)
);
CREATE TRIGGER tenant_call_preparation_fact_sets_immutable BEFORE UPDATE OR DELETE ON public.tenant_call_preparation_fact_sets FOR EACH ROW EXECUTE FUNCTION public.reject_pbx_live_history_change();
REVOKE ALL ON public.tenant_call_preparation_fact_sets FROM PUBLIC,myims_runtime,myims_pbx_executor;
GRANT SELECT ON public.tenant_call_preparation_fact_sets TO myims_runtime,myims_pbx_executor;
CREATE FUNCTION public.tenant_preparation_current_facts(target uuid)
RETURNS TABLE(kind text,resource_id uuid,version integer,authority_version integer)
LANGUAGE sql STABLE AS $$
 SELECT f.kind,f.resource_id,f.version,f.authority_version FROM public.tenant_call_preparation_facts f
 WHERE f.preparation_id=target AND NOT EXISTS(SELECT 1 FROM public.tenant_call_preparation_fact_sets g WHERE g.preparation_id=target)
 UNION ALL
 SELECT x->>'kind',(x->>'resourceId')::uuid,(x->>'version')::integer,(x->>'authorityVersion')::integer
 FROM jsonb_array_elements((SELECT g.facts FROM public.tenant_call_preparation_fact_sets g WHERE g.preparation_id=target ORDER BY g.generation DESC LIMIT 1)) x
$$;
REVOKE ALL ON FUNCTION public.tenant_preparation_current_facts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_preparation_current_facts(uuid) TO myims_runtime,myims_pbx_executor;
CREATE OR REPLACE FUNCTION public.tenant_case_preparation_available(target uuid) RETURNS boolean
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
   OR EXISTS(SELECT 1 FROM public.tenant_preparation_current_facts(p.id) f LEFT JOIN (
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
   WHERE actual.id IS NULL)
   OR NOT EXISTS(SELECT 1 FROM public.tenant_call_custody_proofs f JOIN public.pbx_live_runtime r ON r.node_id=f.node_id JOIN public.pbx_live_artifacts a ON a.id=r.verified_id JOIN public.pbx_revisions v ON v.id=a.revision_id
    WHERE f.node_id=p.node_id AND f.owner_epoch=o.epoch AND f.valid AND f.checked_at>statement_timestamp()-interval '15 seconds' AND f.source_digest=v.source_digest))
 )
$$;
REVOKE ALL ON FUNCTION public.tenant_case_preparation_available(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_case_preparation_available(uuid) TO myims_runtime,myims_pbx_executor;
COMMIT;
