BEGIN;
CREATE TABLE public.outbound_rules (
 id uuid PRIMARY KEY, node_id uuid NOT NULL, installation_id uuid NOT NULL,
 name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 80 AND name=btrim(name) AND name !~ '[[:cntrl:]]'),
 trunk_id uuid NOT NULL,
 pattern_kind text NOT NULL CHECK(pattern_kind IN ('exact','prefix')),
 digits text NOT NULL CHECK(length(digits) BETWEEN 1 AND 15 AND digits !~ '[^0-9]'),
 min_length integer NOT NULL, max_length integer NOT NULL,
 CHECK(min_length >= length(digits) AND max_length >= min_length AND max_length <= 15),
 CHECK(pattern_kind <> 'exact' OR (min_length=length(digits) AND max_length=length(digits))),
 priority integer NOT NULL CHECK(priority >= 0),
 strip_count integer NOT NULL DEFAULT 0 CHECK(strip_count >= 0 AND strip_count <= min_length),
 add_prefix text NOT NULL DEFAULT '' CHECK(length(add_prefix)<=15 AND add_prefix !~ '[^0-9]'),
 CHECK(min_length-strip_count+length(add_prefix)>=1 AND max_length-strip_count+length(add_prefix)<=15),
 source_key text NOT NULL UNIQUE CHECK(source_key ~ '^route:[a-f0-9]{64}$'),
 context_hash text NOT NULL UNIQUE CHECK(context_hash ~ '^[a-f0-9]{64}$'),
 watch_identity text NOT NULL UNIQUE CHECK(watch_identity ~ '^watch:[a-f0-9]{64}$'),
 attribution_key text NOT NULL UNIQUE CHECK(attribution_key ~ '^attribution:[a-f0-9]{64}$'),
 enabled boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_by uuid NOT NULL REFERENCES public.platform_operators(id), updated_by uuid NOT NULL REFERENCES public.platform_operators(id), removed_at timestamptz,
 FOREIGN KEY(node_id,installation_id) REFERENCES public.pbx_nodes(id,installation_id),
 FOREIGN KEY(trunk_id,node_id,installation_id) REFERENCES public.sip_trunks(id,node_id,installation_id)
);
CREATE UNIQUE INDEX outbound_rule_name ON public.outbound_rules(installation_id,lower(name)) WHERE removed_at IS NULL;
CREATE INDEX outbound_rule_page ON public.outbound_rules(node_id,id) WHERE removed_at IS NULL;
CREATE INDEX outbound_trunk_reference ON public.outbound_rules(trunk_id) WHERE removed_at IS NULL;
CREATE TRIGGER outbound_rule_protection BEFORE UPDATE OR DELETE ON public.outbound_rules FOR EACH ROW EXECUTE FUNCTION public.protect_sip_peer();
REVOKE ALL ON public.outbound_rules FROM PUBLIC,myims_runtime;
GRANT SELECT,INSERT ON public.outbound_rules TO myims_runtime;
GRANT UPDATE(name,trunk_id,pattern_kind,digits,min_length,max_length,priority,strip_count,add_prefix,enabled,version,updated_at,updated_by,removed_at) ON public.outbound_rules TO myims_runtime;
-- Derived domains preserve leading zeros by indexing each admitted length.
CREATE TABLE public.outbound_number_domains (
 rule_id uuid NOT NULL REFERENCES public.outbound_rules(id),
 installation_id uuid NOT NULL, node_id uuid NOT NULL,
 domain text NOT NULL CHECK(domain IN ('input','output')),
 priority integer NOT NULL, digit_length integer NOT NULL,
 span int8range NOT NULL,
 PRIMARY KEY(rule_id,domain,digit_length),
 EXCLUDE USING gist(node_id WITH =,priority WITH =,digit_length WITH =,span WITH &&) WHERE(domain='input')
);
CREATE FUNCTION public.sync_outbound_domains() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE n integer; d text; lo integer; hi integer; domain_kind text;
BEGIN
 PERFORM 1 FROM public.pbx_nodes WHERE id=NEW.node_id FOR UPDATE;
 DELETE FROM public.outbound_number_domains WHERE rule_id=NEW.id;
 IF NEW.removed_at IS NOT NULL THEN RETURN NEW; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sip_trunks WHERE id=NEW.trunk_id AND node_id=NEW.node_id AND installation_id=NEW.installation_id AND removed_at IS NULL AND direction IN ('outbound','both')) THEN
  RAISE EXCEPTION 'Invalid outbound trunk' USING ERRCODE='23503';
 END IF;
 FOREACH domain_kind IN ARRAY ARRAY['input','output'] LOOP
  d:=NEW.digits; lo:=NEW.min_length; hi:=NEW.max_length;
  IF domain_kind='output' THEN
   d:=NEW.add_prefix || substring(d FROM NEW.strip_count+1);
   lo:=lo-NEW.strip_count+length(NEW.add_prefix); hi:=hi-NEW.strip_count+length(NEW.add_prefix);
  END IF;
  FOR n IN lo..hi LOOP
   IF EXISTS(SELECT 1 FROM public.telephony_number_claims c WHERE c.installation_id=NEW.installation_id AND c.owner_kind='number_reservations' AND c.digit_length=n AND c.span && int8range(rpad(d,n,'0')::bigint,rpad(d,n,'9')::bigint+1,'[)')) THEN
    RAISE EXCEPTION 'Reserved outbound domain' USING ERRCODE='23514';
   END IF;
   INSERT INTO public.outbound_number_domains VALUES(NEW.id,NEW.installation_id,NEW.node_id,domain_kind,NEW.priority,n,int8range(rpad(d,n,'0')::bigint,rpad(d,n,'9')::bigint+1,'[)'));
  END LOOP;
 END LOOP;
 RETURN NEW;
END $$;
CREATE FUNCTION public.check_outbound_reservation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM 1 FROM public.pbx_nodes WHERE id=NEW.node_id FOR UPDATE;
 IF NEW.removed_at IS NULL AND EXISTS(
  SELECT 1 FROM public.outbound_number_domains d WHERE d.installation_id=NEW.installation_id AND d.digit_length BETWEEN NEW.min_length AND NEW.max_length AND d.span && int8range(rpad(NEW.digits,d.digit_length,'0')::bigint,rpad(NEW.digits,d.digit_length,'9')::bigint+1,'[)')
 ) THEN RAISE EXCEPTION 'Reservation intersects outbound rule' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER outbound_domains AFTER INSERT OR UPDATE ON public.outbound_rules FOR EACH ROW EXECUTE FUNCTION public.sync_outbound_domains();
CREATE TRIGGER reservation_outbound BEFORE INSERT OR UPDATE ON public.number_reservations FOR EACH ROW EXECUTE FUNCTION public.check_outbound_reservation();
REVOKE ALL ON public.outbound_number_domains FROM PUBLIC,myims_runtime;
REVOKE ALL ON FUNCTION public.sync_outbound_domains(),public.check_outbound_reservation() FROM PUBLIC;
GRANT SELECT ON public.outbound_number_domains TO myims_runtime;
CREATE FUNCTION public.protect_outbound_trunk() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM 1 FROM public.pbx_nodes WHERE id=NEW.node_id FOR UPDATE;
 IF (NEW.removed_at IS NOT NULL OR NEW.direction='inbound' OR (NEW.settings-ARRAY['credential','registration','authentication']) IS DISTINCT FROM (OLD.settings-ARRAY['credential','registration','authentication'])) AND EXISTS(SELECT 1 FROM public.outbound_rules WHERE trunk_id=NEW.id AND removed_at IS NULL) THEN
  RAISE EXCEPTION 'Trunk has outbound references' USING ERRCODE='23503';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trunk_outbound_protection BEFORE UPDATE ON public.sip_trunks FOR EACH ROW EXECUTE FUNCTION public.protect_outbound_trunk();
REVOKE ALL ON FUNCTION public.protect_outbound_trunk() FROM PUBLIC;
COMMIT;
