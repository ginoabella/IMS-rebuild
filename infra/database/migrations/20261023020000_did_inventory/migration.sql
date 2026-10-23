BEGIN;
-- Additive desired-only inventory; retained identities never retarget after removal.
ALTER TABLE public.sip_gateways ADD UNIQUE(id,node_id,installation_id);
CREATE TABLE public.sip_dids (
 id uuid PRIMARY KEY,
 node_id uuid NOT NULL,
 installation_id uuid NOT NULL,
 name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 80 AND name=btrim(name) AND name !~ '[[:cntrl:]]'),
 number text NOT NULL CHECK(number ~ '^\+?[0-9]{1,15}$'),
 gateway_id uuid NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_by uuid NOT NULL REFERENCES public.platform_operators(id),
 updated_by uuid NOT NULL REFERENCES public.platform_operators(id),
 removed_at timestamptz,
 FOREIGN KEY(node_id,installation_id) REFERENCES public.pbx_nodes(id,installation_id),
 FOREIGN KEY(gateway_id,node_id,installation_id) REFERENCES public.sip_gateways(id,node_id,installation_id)
);
CREATE INDEX sip_did_page ON public.sip_dids(node_id,id) WHERE removed_at IS NULL;
CREATE INDEX sip_did_gateway_reference ON public.sip_dids(gateway_id,id) WHERE removed_at IS NULL;
CREATE UNIQUE INDEX sip_did_name ON public.sip_dids(installation_id,lower(name)) WHERE removed_at IS NULL;
CREATE UNIQUE INDEX sip_did_number ON public.sip_dids(installation_id,number) WHERE removed_at IS NULL;
CREATE TRIGGER sip_did_protection BEFORE UPDATE OR DELETE ON public.sip_dids FOR EACH ROW EXECUTE FUNCTION public.protect_sip_peer();
REVOKE ALL ON public.sip_dids FROM PUBLIC,myims_runtime;
GRANT SELECT,INSERT ON public.sip_dids TO myims_runtime;
GRANT UPDATE(name,number,gateway_id,enabled,version,updated_at,updated_by,removed_at) ON public.sip_dids TO myims_runtime;
COMMIT;
