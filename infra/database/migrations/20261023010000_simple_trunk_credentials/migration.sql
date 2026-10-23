BEGIN;
-- Only confirmed versions are selectable. Imports retain an exact durable identity
-- before crossing the provider boundary; no secret or secret digest is persisted.
CREATE TABLE public.sip_credentials (
 id uuid PRIMARY KEY,
 installation_id uuid NOT NULL REFERENCES public.pbx_nodes(installation_id),
 label text NOT NULL CHECK(char_length(label) BETWEEN 1 AND 80 AND label=btrim(label) AND label !~ '[[:cntrl:]]'),
 purpose text NOT NULL DEFAULT 'outbound-digest' CHECK(purpose='outbound-digest'),
 available boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,installation_id)
);
CREATE UNIQUE INDEX sip_credential_label ON public.sip_credentials(installation_id,lower(label));
CREATE TABLE public.sip_credential_versions (
 credential_id uuid NOT NULL REFERENCES public.sip_credentials(id),
 material_version integer NOT NULL CHECK(material_version>0),
 available boolean NOT NULL DEFAULT true,
 confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(credential_id,material_version)
);
CREATE TABLE public.sip_credential_imports (
 operation_id uuid PRIMARY KEY,
 credential_id uuid NOT NULL REFERENCES public.sip_credentials(id),
 expected_version integer NOT NULL CHECK(expected_version>=0),
 state text NOT NULL CHECK(state IN ('pending','confirmed')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(credential_id,expected_version)
);
CREATE UNIQUE INDEX sip_credential_pending ON public.sip_credential_imports(credential_id) WHERE state='pending';
-- Preserve IP-peer rows and their exact JSON shape. Digest holds only safe refs.
CREATE FUNCTION public.valid_trunk_settings(s jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $body$
 SELECT public.valid_ip_peer_settings(s) OR COALESCE(
 s->>'authentication'='outbound-digest'
 AND public.valid_ip_peer_settings((s - ARRAY['credential','registration']) || '{"authentication":"ip-peer"}'::jsonb)
 AND jsonb_typeof(s->'credential')='object'
 AND (s->'credential') ?& ARRAY['id','version']
 AND (s->'credential') - ARRAY['id','version']='{}'::jsonb
 AND s->'credential'->>'id' ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
 AND jsonb_typeof(s->'credential'->'version')='number'
 AND s->'credential'->>'version' ~ '^[1-9][0-9]{0,9}$'
 AND (s->'credential'->>'version')::numeric<2147483647
 AND (NOT s ? 'registration' OR (
 jsonb_typeof(s->'registration')='object'
 AND (s->'registration') ?& ARRAY['registrar','realm','expiration','retryInterval','forbiddenRetryInterval']
 AND (s->'registration') - ARRAY['registrar','realm','expiration','retryInterval','forbiddenRetryInterval']='{}'::jsonb
 AND s->'registration'->>'registrar' ~ '^[a-zA-Z0-9:.][-a-zA-Z0-9:.]{0,252}$'
 AND s->'registration'->>'realm' ~ '^[a-zA-Z0-9][-a-zA-Z0-9.]{0,252}$'
 AND s->'registration'->'expiration'='3600'::jsonb
 AND s->'registration'->'retryInterval'='60'::jsonb
 AND s->'registration'->'forbiddenRetryInterval'='10'::jsonb)), false)
$body$;
ALTER TABLE public.sip_trunks DROP CONSTRAINT sip_trunks_settings_check;
ALTER TABLE public.sip_trunks ADD CHECK(public.valid_trunk_settings(settings));
ALTER TABLE public.sip_trunks ADD CHECK(direction<>'inbound' OR settings->>'authentication'='ip-peer');
CREATE FUNCTION public.check_trunk_credential() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
 IF NEW.settings->>'authentication'='outbound-digest' THEN
  PERFORM 1 FROM public.sip_credentials c JOIN public.sip_credential_versions v ON v.credential_id=c.id
   WHERE c.id=(NEW.settings->'credential'->>'id')::uuid AND c.installation_id=NEW.installation_id
   AND c.purpose='outbound-digest' AND c.available AND v.available
   AND v.material_version=(NEW.settings->'credential'->>'version')::integer FOR SHARE OF c,v;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unavailable trunk credential' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END;
$body$;
CREATE TRIGGER sip_trunk_credential BEFORE INSERT OR UPDATE OF settings ON public.sip_trunks FOR EACH ROW EXECUTE FUNCTION public.check_trunk_credential();
REVOKE ALL ON public.sip_credentials,public.sip_credential_versions,public.sip_credential_imports FROM PUBLIC,myims_runtime;
GRANT SELECT ON public.sip_credentials,public.sip_credential_versions TO myims_runtime;
-- PostgreSQL requires UPDATE on at least one column to acquire FOR SHARE.
-- Runtime receives identity-column grants solely for locks; every actual runtime
-- UPDATE is rejected by this trigger (including no-ops).
CREATE FUNCTION public.protect_sip_credential_metadata() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
 IF current_user='myims_runtime' THEN
  RAISE EXCEPTION 'Credential metadata is administrator-owned' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END;
$body$;
CREATE TRIGGER sip_credential_metadata_guard BEFORE UPDATE ON public.sip_credentials FOR EACH ROW EXECUTE FUNCTION public.protect_sip_credential_metadata();
CREATE TRIGGER sip_credential_version_guard BEFORE UPDATE ON public.sip_credential_versions FOR EACH ROW EXECUTE FUNCTION public.protect_sip_credential_metadata();
GRANT UPDATE(id) ON public.sip_credentials TO myims_runtime;
GRANT UPDATE(credential_id) ON public.sip_credential_versions TO myims_runtime;
REVOKE ALL ON FUNCTION public.protect_sip_credential_metadata() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.valid_trunk_settings(jsonb),public.check_trunk_credential() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.valid_trunk_settings(jsonb) TO myims_runtime;
COMMIT;
