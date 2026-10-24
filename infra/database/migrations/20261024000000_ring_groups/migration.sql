BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE public.extensions ADD UNIQUE(id,node_id,installation_id);
CREATE TABLE public.ring_groups (
 id uuid PRIMARY KEY, node_id uuid NOT NULL, installation_id uuid NOT NULL,
 name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 80 AND name=btrim(name) AND name !~ '[[:cntrl:]]'),
 number text CHECK(number ~ '^[1-9][0-9]{3,5}$' AND number::integer BETWEEN 1000 AND 899999),
 strategy text NOT NULL CHECK(strategy IN ('simultaneous','sequential')),
 timeout integer NOT NULL DEFAULT 20 CHECK(timeout BETWEEN 5 AND 120),
 fallback_extension_id uuid, fallback_group_id uuid,
 CHECK(fallback_extension_id IS NULL OR fallback_group_id IS NULL),
 CHECK(fallback_group_id IS DISTINCT FROM id),
 enabled boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_by uuid NOT NULL REFERENCES public.platform_operators(id), updated_by uuid NOT NULL REFERENCES public.platform_operators(id), removed_at timestamptz,
 UNIQUE(id,node_id,installation_id),
 FOREIGN KEY(node_id,installation_id) REFERENCES public.pbx_nodes(id,installation_id),
 FOREIGN KEY(fallback_extension_id,node_id,installation_id) REFERENCES public.extensions(id,node_id,installation_id),
 FOREIGN KEY(fallback_group_id,node_id,installation_id) REFERENCES public.ring_groups(id,node_id,installation_id)
);
CREATE TABLE public.ring_group_members (
 group_id uuid NOT NULL, node_id uuid NOT NULL, installation_id uuid NOT NULL,
 extension_id uuid NOT NULL, position integer NOT NULL CHECK(position BETWEEN 1 AND 32),
 PRIMARY KEY(group_id,extension_id), UNIQUE(group_id,position),
 FOREIGN KEY(group_id,node_id,installation_id) REFERENCES public.ring_groups(id,node_id,installation_id),
 FOREIGN KEY(extension_id,node_id,installation_id) REFERENCES public.extensions(id,node_id,installation_id)
);
CREATE FUNCTION public.check_ring_group_member_count() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE target uuid; member_count integer;
BEGIN
 IF TG_TABLE_NAME='ring_groups' THEN target:=NEW.id;
 ELSE target:=CASE WHEN TG_OP='DELETE' THEN OLD.group_id ELSE NEW.group_id END;
 END IF;
 SELECT count(*) INTO member_count FROM public.ring_group_members WHERE group_id=target;
 IF member_count NOT BETWEEN 1 AND 32 THEN RAISE EXCEPTION 'Group requires 1–32 members' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.check_ring_group_member_count() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER group_member_count AFTER INSERT OR UPDATE ON public.ring_groups DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_ring_group_member_count();
CREATE CONSTRAINT TRIGGER member_count AFTER INSERT OR UPDATE OR DELETE ON public.ring_group_members DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_ring_group_member_count();
CREATE TABLE public.number_reservations (
 id uuid PRIMARY KEY, node_id uuid NOT NULL, installation_id uuid NOT NULL,
 name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 80 AND name=btrim(name) AND name !~ '[[:cntrl:]]'),
 purpose text NOT NULL CHECK(char_length(purpose) BETWEEN 1 AND 80 AND purpose=btrim(purpose) AND purpose !~ '[[:cntrl:]]'),
 pattern_kind text NOT NULL CHECK(pattern_kind IN ('exact','prefix')),
 digits text NOT NULL CHECK(digits ~ '^[0-9]{1,15}$'),
 min_length integer NOT NULL, max_length integer NOT NULL,
 CHECK(min_length BETWEEN char_length(digits) AND 15 AND max_length BETWEEN min_length AND 15),
 CHECK(pattern_kind <> 'exact' OR (min_length=char_length(digits) AND max_length=char_length(digits))),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_by uuid NOT NULL REFERENCES public.platform_operators(id), updated_by uuid NOT NULL REFERENCES public.platform_operators(id), removed_at timestamptz,
 FOREIGN KEY(node_id,installation_id) REFERENCES public.pbx_nodes(id,installation_id)
);
CREATE UNIQUE INDEX ring_group_name ON public.ring_groups(installation_id,lower(name)) WHERE removed_at IS NULL;
CREATE UNIQUE INDEX number_reservation_name ON public.number_reservations(installation_id,lower(name)) WHERE removed_at IS NULL;
CREATE INDEX ring_group_page ON public.ring_groups(node_id,id) WHERE removed_at IS NULL;
CREATE INDEX reservation_page ON public.number_reservations(node_id,id) WHERE removed_at IS NULL;
CREATE INDEX group_member_reference ON public.ring_group_members(extension_id,group_id);
CREATE INDEX group_fallback_reference ON public.ring_groups(fallback_group_id) WHERE removed_at IS NULL;
CREATE TABLE public.routing_receipts (
 operator_id uuid NOT NULL REFERENCES public.platform_operators(id), request_id uuid NOT NULL,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'), result jsonb NOT NULL CHECK(octet_length(result::text)<=16384),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(operator_id,request_id)
);
-- One derived constraint index for all namespace owners. Length preserves leading zeros.
-- SECURITY DEFINER triggers are the sole claim writer, not HTTP or replica-local checks.
CREATE TABLE public.telephony_number_claims (
 installation_id uuid NOT NULL, owner_kind text NOT NULL, owner_id uuid NOT NULL,
 digit_length integer NOT NULL CHECK(digit_length BETWEEN 1 AND 15), span int8range NOT NULL,
 PRIMARY KEY(owner_kind,owner_id,digit_length),
 CONSTRAINT telephony_namespace_exclusion EXCLUDE USING gist(installation_id WITH =,digit_length WITH =,span WITH &&)
);
CREATE FUNCTION public.sync_telephony_number_claims() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE claim_digits text; min_len integer; max_len integer; n integer; claim_kind text;
BEGIN
 claim_kind := TG_TABLE_NAME;
 DELETE FROM public.telephony_number_claims WHERE owner_kind=claim_kind AND owner_id=NEW.id;
 IF TG_TABLE_NAME='extensions' THEN claim_digits:=NEW.number; min_len:=length(claim_digits); max_len:=min_len;
 ELSIF NEW.removed_at IS NOT NULL THEN RETURN NEW;
 ELSIF TG_TABLE_NAME='ring_groups' THEN claim_digits:=NEW.number; min_len:=length(claim_digits); max_len:=min_len;
 ELSE claim_digits:=NEW.digits; min_len:=NEW.min_length; max_len:=NEW.max_length;
 END IF;
 IF claim_digits IS NOT NULL THEN
  FOR n IN min_len..max_len LOOP
   INSERT INTO public.telephony_number_claims VALUES(NEW.installation_id,claim_kind,NEW.id,n,int8range(rpad(claim_digits,n,'0')::bigint,rpad(claim_digits,n,'9')::bigint+1,'[)'));
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_telephony_number_claims() FROM PUBLIC;
CREATE TRIGGER extension_number_claim AFTER INSERT ON public.extensions FOR EACH ROW EXECUTE FUNCTION public.sync_telephony_number_claims();
CREATE TRIGGER group_number_claim AFTER INSERT OR UPDATE OF number,removed_at ON public.ring_groups FOR EACH ROW EXECUTE FUNCTION public.sync_telephony_number_claims();
CREATE TRIGGER reservation_number_claim AFTER INSERT OR UPDATE OF digits,min_length,max_length,removed_at ON public.number_reservations FOR EACH ROW EXECUTE FUNCTION public.sync_telephony_number_claims();
INSERT INTO public.telephony_number_claims SELECT installation_id,'extensions',id,length(number),int8range(number::bigint,number::bigint+1,'[)') FROM public.extensions;
CREATE TRIGGER ring_group_protection BEFORE UPDATE OR DELETE ON public.ring_groups FOR EACH ROW EXECUTE FUNCTION public.protect_sip_peer();
CREATE TRIGGER reservation_protection BEFORE UPDATE OR DELETE ON public.number_reservations FOR EACH ROW EXECUTE FUNCTION public.protect_sip_peer();
REVOKE ALL ON public.ring_groups,public.ring_group_members,public.number_reservations,public.routing_receipts,public.telephony_number_claims FROM PUBLIC,myims_runtime;
GRANT SELECT,INSERT ON public.ring_groups,public.ring_group_members,public.number_reservations,public.routing_receipts TO myims_runtime;
GRANT SELECT ON public.telephony_number_claims TO myims_runtime;
GRANT DELETE ON public.ring_group_members TO myims_runtime;
GRANT UPDATE(name,number,strategy,timeout,fallback_extension_id,fallback_group_id,enabled,version,updated_at,updated_by,removed_at) ON public.ring_groups TO myims_runtime;
GRANT UPDATE(name,purpose,pattern_kind,digits,min_length,max_length,version,updated_at,updated_by,removed_at) ON public.number_reservations TO myims_runtime;
COMMIT;
