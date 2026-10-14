BEGIN;
CREATE TABLE public.pbx_nodes (
 id uuid PRIMARY KEY,
 installation_id uuid NOT NULL CONSTRAINT pbx_nodes_installation_unique UNIQUE,
 display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 200 AND display_name = btrim(display_name) AND display_name !~ '[[:cntrl:]]'),
 target_alias text NOT NULL CHECK (target_alias ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
 host text NOT NULL CHECK (host ~ '^[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}$'),
 transport text NOT NULL CHECK (transport ~ '^[a-z][a-z0-9-]{0,31}$'),
 port integer NOT NULL CHECK (port BETWEEN 1 AND 65535),
 tls_server_name text NOT NULL CHECK (tls_server_name ~ '^[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}$'),
 credential_alias text NOT NULL CHECK (credential_alias ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_by uuid NOT NULL,
 updated_by uuid NOT NULL
);
CREATE FUNCTION public.protect_pbx_node() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'PBX deletion unavailable' USING ERRCODE='23514'; END IF;
 IF NEW.id <> OLD.id OR NEW.created_at <> OLD.created_at OR NEW.created_by <> OLD.created_by OR NEW.version <> OLD.version+1 OR NEW.updated_at < OLD.updated_at THEN
  RAISE EXCEPTION 'Invalid PBX registry mutation' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$body$;
REVOKE ALL ON FUNCTION public.protect_pbx_node() FROM PUBLIC;
CREATE TRIGGER pbx_node_protection BEFORE UPDATE OR DELETE ON public.pbx_nodes FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_node();
CREATE TABLE public.pbx_create_receipts (
 operator_id uuid NOT NULL REFERENCES public.platform_operators(id) ON DELETE RESTRICT,
 request_id uuid NOT NULL,
 fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
 node_id uuid NOT NULL UNIQUE REFERENCES public.pbx_nodes(id) ON DELETE RESTRICT,
 result jsonb NOT NULL CHECK (jsonb_typeof(result)='object' AND octet_length(result::text)<=4096 AND result->>'id'=node_id::text),
 correlation_id text NOT NULL CHECK (correlation_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(operator_id,request_id)
);
CREATE FUNCTION public.protect_pbx_receipt() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
 IF TG_OP='DELETE' AND OLD.created_at <= clock_timestamp()-interval '30 days' THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'Immutable PBX creation receipt' USING ERRCODE='23514';
END;
$body$;
REVOKE ALL ON FUNCTION public.protect_pbx_receipt() FROM PUBLIC;
CREATE TRIGGER pbx_receipt_protection BEFORE UPDATE OR DELETE ON public.pbx_create_receipts FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_receipt();
CREATE INDEX pbx_receipt_expiry ON public.pbx_create_receipts(created_at);
REVOKE ALL ON public.pbx_nodes, public.pbx_create_receipts FROM PUBLIC, myims_runtime;
GRANT SELECT ON public.pbx_nodes, public.pbx_create_receipts TO myims_runtime;
GRANT INSERT(id,installation_id,display_name,target_alias,host,transport,port,tls_server_name,credential_alias,created_by,updated_by) ON public.pbx_nodes TO myims_runtime;
GRANT UPDATE(installation_id,display_name,target_alias,host,transport,port,tls_server_name,credential_alias,version,updated_at,updated_by) ON public.pbx_nodes TO myims_runtime;
GRANT INSERT(operator_id,request_id,fingerprint,node_id,result,correlation_id) ON public.pbx_create_receipts TO myims_runtime;
COMMIT;
