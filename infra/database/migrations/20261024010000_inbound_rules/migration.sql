BEGIN;
ALTER TABLE public.sip_dids ADD UNIQUE(id,gateway_id,node_id,installation_id);
CREATE TABLE public.inbound_rules (
 id uuid PRIMARY KEY, node_id uuid NOT NULL, installation_id uuid NOT NULL,
 name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 80 AND name=btrim(name) AND name !~ '[[:cntrl:]]'),
 gateway_id uuid NOT NULL, did_id uuid,
 destination_extension_id uuid, destination_group_id uuid,
 CHECK(destination_extension_id IS NULL OR destination_group_id IS NULL),
 source_key text NOT NULL UNIQUE CHECK(source_key ~ '^route:[a-f0-9]{64}$'),
 context_hash text NOT NULL UNIQUE CHECK(context_hash ~ '^[a-f0-9]{64}$'),
 watch_identity text NOT NULL UNIQUE CHECK(watch_identity ~ '^watch:[a-f0-9]{64}$'),
 attribution_key text NOT NULL UNIQUE CHECK(attribution_key ~ '^attribution:[a-f0-9]{64}$'),
 enabled boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_by uuid NOT NULL REFERENCES public.platform_operators(id), updated_by uuid NOT NULL REFERENCES public.platform_operators(id), removed_at timestamptz,
 FOREIGN KEY(node_id,installation_id) REFERENCES public.pbx_nodes(id,installation_id),
 FOREIGN KEY(gateway_id,node_id,installation_id) REFERENCES public.sip_gateways(id,node_id,installation_id),
 FOREIGN KEY(did_id,gateway_id,node_id,installation_id) REFERENCES public.sip_dids(id,gateway_id,node_id,installation_id),
 FOREIGN KEY(destination_extension_id,node_id,installation_id) REFERENCES public.extensions(id,node_id,installation_id),
 FOREIGN KEY(destination_group_id,node_id,installation_id) REFERENCES public.ring_groups(id,node_id,installation_id)
);
CREATE UNIQUE INDEX inbound_rule_name ON public.inbound_rules(installation_id,lower(name)) WHERE removed_at IS NULL;
CREATE UNIQUE INDEX inbound_exact_selector ON public.inbound_rules(gateway_id,did_id) WHERE removed_at IS NULL AND did_id IS NOT NULL;
CREATE UNIQUE INDEX inbound_catch_all_selector ON public.inbound_rules(gateway_id) WHERE removed_at IS NULL AND did_id IS NULL;
CREATE INDEX inbound_rule_page ON public.inbound_rules(node_id,id) WHERE removed_at IS NULL;
CREATE INDEX inbound_did_reference ON public.inbound_rules(did_id) WHERE removed_at IS NULL;
CREATE INDEX inbound_group_reference ON public.inbound_rules(destination_group_id) WHERE removed_at IS NULL;
CREATE TRIGGER inbound_rule_protection BEFORE UPDATE OR DELETE ON public.inbound_rules FOR EACH ROW EXECUTE FUNCTION public.protect_sip_peer();
REVOKE ALL ON public.inbound_rules FROM PUBLIC,myims_runtime;
GRANT SELECT,INSERT ON public.inbound_rules TO myims_runtime;
GRANT UPDATE(name,gateway_id,did_id,destination_extension_id,destination_group_id,enabled,version,updated_at,updated_by,removed_at) ON public.inbound_rules TO myims_runtime;
COMMIT;
