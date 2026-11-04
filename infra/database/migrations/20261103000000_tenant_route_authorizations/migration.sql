BEGIN;
ALTER TABLE public.inbound_rules ADD UNIQUE(id,node_id,installation_id);
ALTER TABLE public.outbound_rules ADD UNIQUE(id,node_id,installation_id);
ALTER TABLE public.sip_dids ADD UNIQUE(id,node_id,installation_id);
CREATE TABLE public.tenant_route_authorizations (
 id uuid PRIMARY KEY, tenant_id uuid REFERENCES public.tenants(id),
 node_id uuid NOT NULL, installation_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('dids','groups','inbound','outbound','trunks','permission')),
 did_id uuid, group_id uuid, inbound_id uuid, outbound_id uuid, trunk_id uuid,
 resource_id uuid GENERATED ALWAYS AS (coalesce(did_id,group_id,inbound_id,outbound_id,trunk_id)) STORED,
 scope text NOT NULL CHECK(scope IN ('owned','shared')),
 state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','revoked')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 evaluated jsonb NOT NULL CHECK(jsonb_typeof(evaluated)='array' AND jsonb_array_length(evaluated)<=512 AND octet_length(evaluated::text)<=65536),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_by uuid NOT NULL REFERENCES public.platform_operators(id), updated_by uuid NOT NULL REFERENCES public.platform_operators(id),
 CHECK(num_nonnulls(did_id,group_id,inbound_id,outbound_id,trunk_id)=1),
 CHECK((kind='dids' AND did_id IS NOT NULL) OR (kind='groups' AND group_id IS NOT NULL) OR (kind='inbound' AND inbound_id IS NOT NULL) OR (kind='outbound' AND outbound_id IS NOT NULL) OR (kind IN ('trunks','permission') AND trunk_id IS NOT NULL)),
 CHECK((scope='shared' AND kind='trunks' AND tenant_id IS NULL) OR (scope='owned' AND tenant_id IS NOT NULL)),
 FOREIGN KEY(did_id,node_id,installation_id) REFERENCES public.sip_dids(id,node_id,installation_id),
 FOREIGN KEY(group_id,node_id,installation_id) REFERENCES public.ring_groups(id,node_id,installation_id),
 FOREIGN KEY(inbound_id,node_id,installation_id) REFERENCES public.inbound_rules(id,node_id,installation_id),
 FOREIGN KEY(outbound_id,node_id,installation_id) REFERENCES public.outbound_rules(id,node_id,installation_id),
 FOREIGN KEY(trunk_id,node_id,installation_id) REFERENCES public.sip_trunks(id,node_id,installation_id)
);
CREATE UNIQUE INDEX tenant_route_owner ON public.tenant_route_authorizations(kind,resource_id) WHERE state='active' AND kind<>'permission';
CREATE UNIQUE INDEX tenant_trunk_permission ON public.tenant_route_authorizations(tenant_id,trunk_id) WHERE state='active' AND kind='permission';
CREATE INDEX tenant_route_page ON public.tenant_route_authorizations(node_id,tenant_id,id);
CREATE INDEX tenant_route_facts ON public.tenant_route_authorizations USING gin(evaluated);
CREATE TABLE public.tenant_route_history (
 authorization_id uuid NOT NULL REFERENCES public.tenant_route_authorizations(id), version integer NOT NULL,
 old_value jsonb, new_value jsonb NOT NULL, actor_id uuid NOT NULL REFERENCES public.platform_operators(id),
 changed_at timestamptz NOT NULL, PRIMARY KEY(authorization_id,version)
);
CREATE TABLE public.tenant_route_receipts (
 operator_id uuid NOT NULL REFERENCES public.platform_operators(id), request_id uuid NOT NULL,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'), result jsonb NOT NULL CHECK(jsonb_typeof(result)='object' AND octet_length(result::text)<=65536),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(operator_id,request_id)
);
CREATE FUNCTION public.protect_tenant_route_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retained tenant route history' USING ERRCODE='23514'; END IF;
 PERFORM id FROM public.pbx_nodes WHERE id=NEW.node_id FOR UPDATE;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-ARRAY['state','version','evaluated','updated_at','updated_by','resource_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','version','evaluated','updated_at','updated_by','resource_id'])
   OR OLD.state<>'active' OR NEW.version<>OLD.version+1 OR NEW.updated_at<OLD.updated_at
  THEN RAISE EXCEPTION 'Invalid route authorization transition' USING ERRCODE='23514'; END IF;
  IF NEW.state='revoked' AND NEW.kind IN ('dids','groups','trunks') AND EXISTS(
   SELECT 1 FROM public.tenant_route_authorizations a WHERE a.node_id=NEW.node_id AND a.state='active' AND a.id<>NEW.id AND a.evaluated @> jsonb_build_array(jsonb_build_object('kind','authorization','id',NEW.id)))
  THEN RAISE EXCEPTION 'Tenant route dependency' USING ERRCODE='23514'; END IF;
 ELSIF NEW.version<>1 OR NEW.state<>'active' THEN RAISE EXCEPTION 'Invalid initial route authorization' USING ERRCODE='23514'; END IF;
 IF NEW.state='active' AND NEW.kind='permission' AND NOT EXISTS(SELECT 1 FROM public.tenant_route_authorizations a WHERE a.trunk_id=NEW.trunk_id AND a.kind='trunks' AND a.state='active' AND (a.scope='shared' OR a.tenant_id=NEW.tenant_id))
 THEN RAISE EXCEPTION 'Unpermitted trunk ownership' USING ERRCODE='23514'; END IF;
 IF NEW.state='active' AND NEW.kind='inbound' AND EXISTS(SELECT 1 FROM public.inbound_rules WHERE id=NEW.inbound_id AND did_id IS NULL)
 THEN RAISE EXCEPTION 'Platform catch-all cannot bind tenant' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tenant_route_protection BEFORE INSERT OR UPDATE OR DELETE ON public.tenant_route_authorizations FOR EACH ROW EXECUTE FUNCTION public.protect_tenant_route_authorization();
CREATE FUNCTION public.record_tenant_route_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 INSERT INTO public.tenant_route_history VALUES(NEW.id,NEW.version,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW),NEW.updated_by,NEW.updated_at);
 RETURN NEW;
END $$;
CREATE TRIGGER tenant_route_history_write AFTER INSERT OR UPDATE ON public.tenant_route_authorizations FOR EACH ROW EXECUTE FUNCTION public.record_tenant_route_history();
CREATE TRIGGER tenant_route_history_immutable BEFORE UPDATE OR DELETE ON public.tenant_route_history FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_receipt();
CREATE TRIGGER tenant_route_receipt_immutable BEFORE UPDATE OR DELETE ON public.tenant_route_receipts FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_receipt();
-- Name/status edits retain ownership; structural edits require explicit unbinding.
CREATE FUNCTION public.protect_tenant_route_resource() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE resource_kind text; resource_uuid uuid; old_data jsonb; new_data jsonb;
BEGIN
 resource_kind:=TG_ARGV[0]; resource_uuid:=OLD.id;
 PERFORM id FROM public.pbx_nodes WHERE id=OLD.node_id FOR UPDATE;
 old_data:=to_jsonb(OLD)-ARRAY['name','enabled','administrative_status','version','updated_at','updated_by'];
 IF TG_OP='UPDATE' THEN new_data:=to_jsonb(NEW)-ARRAY['name','enabled','administrative_status','version','updated_at','updated_by']; END IF;
 IF (TG_OP='DELETE' OR old_data IS DISTINCT FROM new_data) AND EXISTS(
  SELECT 1 FROM public.tenant_route_authorizations a WHERE a.node_id=OLD.node_id AND a.state='active' AND a.evaluated @> jsonb_build_array(jsonb_build_object('kind',resource_kind,'id',resource_uuid)))
 THEN RAISE EXCEPTION 'Tenant route dependency' USING ERRCODE='23514'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER did_tenant_route_dependency BEFORE UPDATE OR DELETE ON public.sip_dids FOR EACH ROW EXECUTE FUNCTION public.protect_tenant_route_resource('dids');
CREATE TRIGGER group_tenant_route_dependency BEFORE UPDATE OR DELETE ON public.ring_groups FOR EACH ROW EXECUTE FUNCTION public.protect_tenant_route_resource('groups');
CREATE TRIGGER inbound_tenant_route_dependency BEFORE UPDATE OR DELETE ON public.inbound_rules FOR EACH ROW EXECUTE FUNCTION public.protect_tenant_route_resource('inbound');
CREATE TRIGGER outbound_tenant_route_dependency BEFORE UPDATE OR DELETE ON public.outbound_rules FOR EACH ROW EXECUTE FUNCTION public.protect_tenant_route_resource('outbound');
CREATE TRIGGER trunk_tenant_route_dependency BEFORE UPDATE OR DELETE ON public.sip_trunks FOR EACH ROW EXECUTE FUNCTION public.protect_tenant_route_resource('trunks');
CREATE TRIGGER gateway_tenant_route_dependency BEFORE UPDATE OR DELETE ON public.sip_gateways FOR EACH ROW EXECUTE FUNCTION public.protect_tenant_route_resource('gateways');
CREATE FUNCTION public.protect_tenant_route_member() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE g uuid; n uuid;
BEGIN
 g:=CASE WHEN TG_OP='DELETE' THEN OLD.group_id ELSE NEW.group_id END;
 SELECT node_id INTO n FROM public.ring_groups WHERE id=g;
 PERFORM id FROM public.pbx_nodes WHERE id=n FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.tenant_route_authorizations WHERE node_id=n AND state='active' AND evaluated @> jsonb_build_array(jsonb_build_object('kind','groups','id',g)))
 THEN RAISE EXCEPTION 'Tenant-owned group members require explicit unbinding' USING ERRCODE='23514'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER member_tenant_route_dependency BEFORE INSERT OR UPDATE OR DELETE ON public.ring_group_members FOR EACH ROW EXECUTE FUNCTION public.protect_tenant_route_member();
CREATE FUNCTION public.protect_tenant_gateway_source() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE g uuid; n uuid;
BEGIN
 g:=CASE WHEN TG_OP='DELETE' THEN OLD.gateway_id ELSE NEW.gateway_id END;
 SELECT node_id INTO n FROM public.sip_gateways WHERE id=g;
 PERFORM id FROM public.pbx_nodes WHERE id=n FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.tenant_route_authorizations WHERE node_id=n AND state='active' AND evaluated @> jsonb_build_array(jsonb_build_object('kind','gateways','id',g)))
 THEN RAISE EXCEPTION 'Tenant route gateway source dependency' USING ERRCODE='23514'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER gateway_source_tenant_dependency BEFORE INSERT OR UPDATE OR DELETE ON public.sip_gateway_sources FOR EACH ROW EXECUTE FUNCTION public.protect_tenant_gateway_source();
REVOKE ALL ON FUNCTION public.protect_tenant_gateway_source() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_tenant_route_authorization(),public.record_tenant_route_history(),public.protect_tenant_route_resource(),public.protect_tenant_route_member() FROM PUBLIC;
REVOKE ALL ON public.tenant_route_authorizations,public.tenant_route_history,public.tenant_route_receipts FROM PUBLIC,myims_runtime;
GRANT SELECT,INSERT ON public.tenant_route_authorizations,public.tenant_route_receipts TO myims_runtime;
GRANT SELECT ON public.tenant_route_history TO myims_runtime;
GRANT UPDATE(state,version,evaluated,updated_at,updated_by) ON public.tenant_route_authorizations TO myims_runtime;
COMMIT;
