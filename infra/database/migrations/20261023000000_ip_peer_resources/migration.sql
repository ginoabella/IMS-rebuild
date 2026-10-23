BEGIN;
CREATE FUNCTION public.valid_ip_peer_settings(s jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $body$
 SELECT COALESCE(jsonb_typeof(s)='object'
 AND s ?& ARRAY['host','port','transport','media','codecs','directMedia','rtpSymmetric','forceRport','authentication']
 AND s - ARRAY['host','port','transport','media','codecs','directMedia','rtpSymmetric','forceRport','authentication'] = '{}'::jsonb
 AND jsonb_typeof(s->'host')='string' AND length(s->>'host') BETWEEN 1 AND 253 AND s->>'host' ~ '^[a-zA-Z0-9:.][-a-zA-Z0-9:.]*$'
 AND jsonb_typeof(s->'port')='number' AND (s->>'port') ~ '^[0-9]{1,5}$' AND (s->>'port')::numeric BETWEEN 1 AND 65535
 AND s->'codecs' IN ('["ulaw"]'::jsonb,'["alaw"]'::jsonb,'["alaw","ulaw"]'::jsonb,'["ulaw","alaw"]'::jsonb)
 AND s->>'authentication'='ip-peer' AND s->>'transport'='udp' AND s->>'media'='rtp'
 AND s->'directMedia'='false'::jsonb AND s->'rtpSymmetric'='true'::jsonb AND s->'forceRport'='true'::jsonb,false)
$body$;
REVOKE ALL ON FUNCTION public.valid_ip_peer_settings(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.valid_ip_peer_settings(jsonb) TO myims_runtime;
CREATE TABLE public.sip_trunks (
 id uuid PRIMARY KEY,
 node_id uuid NOT NULL,
 installation_id uuid NOT NULL,
 name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 80 AND name=btrim(name) AND name !~ '[[:cntrl:]]'),
 direction text NOT NULL CHECK(direction IN ('inbound','outbound','both')),
 settings jsonb NOT NULL CHECK(public.valid_ip_peer_settings(settings)),
 enabled boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_by uuid NOT NULL REFERENCES public.platform_operators(id),
 updated_by uuid NOT NULL REFERENCES public.platform_operators(id),
 removed_at timestamptz,
 UNIQUE(id,node_id,installation_id),
 FOREIGN KEY(node_id,installation_id) REFERENCES public.pbx_nodes(id,installation_id)
);
CREATE INDEX sip_trunk_page ON public.sip_trunks(node_id,id) WHERE removed_at IS NULL;
CREATE UNIQUE INDEX sip_trunk_name ON public.sip_trunks(installation_id,lower(name)) WHERE removed_at IS NULL;
CREATE TABLE public.sip_gateways (
 id uuid PRIMARY KEY,
 node_id uuid NOT NULL,
 installation_id uuid NOT NULL,
 name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 80 AND name=btrim(name) AND name !~ '[[:cntrl:]]'),
 kind text NOT NULL CHECK(kind IN ('sip-provider','sip-device')),
 trunk_id uuid,
 CHECK(kind<>'sip-provider' OR trunk_id IS NOT NULL),
 enabled boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_by uuid NOT NULL REFERENCES public.platform_operators(id),
 updated_by uuid NOT NULL REFERENCES public.platform_operators(id),
 removed_at timestamptz,
 UNIQUE(id,installation_id),
 FOREIGN KEY(node_id,installation_id) REFERENCES public.pbx_nodes(id,installation_id),
 FOREIGN KEY(trunk_id,node_id,installation_id) REFERENCES public.sip_trunks(id,node_id,installation_id)
);
CREATE INDEX sip_gateway_page ON public.sip_gateways(node_id,id) WHERE removed_at IS NULL;
CREATE INDEX sip_gateway_trunk_reference ON public.sip_gateways(trunk_id,id) WHERE removed_at IS NULL;
CREATE UNIQUE INDEX sip_gateway_name ON public.sip_gateways(installation_id,lower(name)) WHERE removed_at IS NULL;
-- Removed gateways retain their sources here; uniqueness covers only current claims.
CREATE TABLE public.sip_gateway_sources (
 gateway_id uuid NOT NULL,
 installation_id uuid NOT NULL,
 address inet NOT NULL CHECK(masklen(address)=CASE family(address) WHEN 4 THEN 32 ELSE 128 END),
 removed_at timestamptz,
 PRIMARY KEY(gateway_id,address),
 FOREIGN KEY(gateway_id,installation_id) REFERENCES public.sip_gateways(id,installation_id)
);
CREATE UNIQUE INDEX sip_gateway_source_unique ON public.sip_gateway_sources(installation_id,address) WHERE removed_at IS NULL;
CREATE TABLE public.sip_peer_receipts (
 operator_id uuid NOT NULL REFERENCES public.platform_operators(id),
 request_id uuid NOT NULL,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 result jsonb NOT NULL CHECK(octet_length(result::text)<=16384),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(operator_id,request_id)
);
CREATE FUNCTION public.protect_sip_peer() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Soft removal required' USING ERRCODE='23514'; END IF;
 IF NEW.id<>OLD.id OR NEW.node_id<>OLD.node_id OR NEW.installation_id<>OLD.installation_id OR NEW.created_at<>OLD.created_at OR NEW.created_by<>OLD.created_by OR NEW.version<>OLD.version+1 OR OLD.removed_at IS NOT NULL THEN
  RAISE EXCEPTION 'Invalid peer mutation' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$body$;
CREATE TRIGGER sip_trunk_protection BEFORE UPDATE OR DELETE ON public.sip_trunks FOR EACH ROW EXECUTE FUNCTION public.protect_sip_peer();
CREATE TRIGGER sip_gateway_protection BEFORE UPDATE OR DELETE ON public.sip_gateways FOR EACH ROW EXECUTE FUNCTION public.protect_sip_peer();
REVOKE ALL ON public.sip_trunks,public.sip_gateways,public.sip_gateway_sources,public.sip_peer_receipts FROM PUBLIC,myims_runtime;
GRANT SELECT,INSERT ON public.sip_trunks,public.sip_gateways,public.sip_gateway_sources,public.sip_peer_receipts TO myims_runtime;
GRANT UPDATE(name,direction,settings,enabled,version,updated_at,updated_by,removed_at) ON public.sip_trunks TO myims_runtime;
GRANT UPDATE(name,kind,trunk_id,enabled,version,updated_at,updated_by,removed_at) ON public.sip_gateways TO myims_runtime;
GRANT UPDATE(removed_at) ON public.sip_gateway_sources TO myims_runtime;
REVOKE ALL ON FUNCTION public.protect_sip_peer() FROM PUBLIC;
COMMIT;
