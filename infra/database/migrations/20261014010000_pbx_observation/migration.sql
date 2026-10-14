BEGIN;
CREATE TABLE public.pbx_observations (
 node_id uuid PRIMARY KEY REFERENCES public.pbx_nodes(id) ON DELETE RESTRICT,
 desired_version integer NOT NULL CHECK (desired_version>0),
 epoch bigint NOT NULL DEFAULT 0 CHECK(epoch>=0),
 sequence bigint NOT NULL DEFAULT 0 CHECK(sequence BETWEEN 0 AND 9007199254740991),
 last_success_at timestamptz,
 connection text NOT NULL DEFAULT 'unknown' CHECK(connection IN ('unknown','reachable','disconnected')),
 reconciliation text NOT NULL DEFAULT 'reconciling' CHECK(reconciliation IN ('complete','reconciling')),
 failure text CHECK(failure IN ('secret_missing','secret_unavailable','destination_denied','resolution_unavailable','connect_failed','auth_failed','timeout','protocol_failed','snapshot_incomplete','resource_limit','disconnected','ownership_lost')),
 registrations jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(registrations)='array' AND jsonb_array_length(registrations)<=1000 AND octet_length(registrations::text)<=262144),
 coverage text NOT NULL DEFAULT 'unknown' CHECK(coverage IN ('unknown','pjsip-dynamic-contacts')),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.pbx_ownership (
 node_id uuid PRIMARY KEY REFERENCES public.pbx_nodes(id) ON DELETE RESTRICT,
 epoch bigint NOT NULL DEFAULT 0 CHECK(epoch>=0),
 incarnation uuid,
 desired_version integer NOT NULL CHECK(desired_version>0),
 expires_at timestamptz NOT NULL DEFAULT '-infinity'
);
INSERT INTO public.pbx_observations(node_id,desired_version) SELECT id,version FROM public.pbx_nodes;
INSERT INTO public.pbx_ownership(node_id,desired_version) SELECT id,version FROM public.pbx_nodes;
CREATE FUNCTION public.protect_pbx_epoch() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Epoch deletion denied' USING ERRCODE='23514'; END IF;
 IF NEW.epoch<OLD.epoch OR NEW.epoch>OLD.epoch+1 OR (NEW.incarnation IS DISTINCT FROM OLD.incarnation AND NEW.incarnation IS NOT NULL AND NEW.epoch<>OLD.epoch+1) THEN
  RAISE EXCEPTION 'Epoch reuse denied' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$body$;
REVOKE ALL ON FUNCTION public.protect_pbx_epoch() FROM PUBLIC;
CREATE TRIGGER pbx_epoch_protection BEFORE UPDATE OR DELETE ON public.pbx_ownership FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_epoch();
REVOKE ALL ON public.pbx_observations,public.pbx_ownership FROM PUBLIC,myims_runtime;
GRANT SELECT,INSERT,UPDATE ON public.pbx_observations,public.pbx_ownership TO myims_runtime;
COMMIT;
