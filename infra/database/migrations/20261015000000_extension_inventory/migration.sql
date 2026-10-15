BEGIN;
-- Trusted deployment declarations only. Runtime never infers endpoint support from AMI.
CREATE TABLE public.endpoint_capabilities (
 installation_id uuid PRIMARY KEY,
 revision integer NOT NULL CHECK (revision > 0),
 kinds text[] NOT NULL CHECK (cardinality(kinds) BETWEEN 1 AND 2 AND kinds <@ ARRAY['sip','webrtc']::text[]),
 signaling text[] NOT NULL CHECK (cardinality(signaling) BETWEEN 1 AND 2 AND signaling <@ ARRAY['udp','wss']::text[]),
 codecs text[] NOT NULL CHECK (cardinality(codecs) BETWEEN 1 AND 3 AND codecs <@ ARRAY['opus','ulaw','alaw']::text[]),
 media text[] NOT NULL CHECK (cardinality(media) BETWEEN 1 AND 2 AND media <@ ARRAY['none','dtls-srtp']::text[])
);
ALTER TABLE public.pbx_nodes ADD CONSTRAINT pbx_node_installation_pair UNIQUE(id,installation_id);
CREATE TABLE public.endpoint_profiles (
 id uuid PRIMARY KEY,
 node_id uuid NOT NULL REFERENCES public.pbx_nodes(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('sip','webrtc')),
 name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 80 AND name=btrim(name) AND name !~ '[[:cntrl:]]'),
 head_version integer NOT NULL DEFAULT 1 CHECK(head_version>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_by uuid NOT NULL REFERENCES public.platform_operators(id),
 updated_by uuid NOT NULL REFERENCES public.platform_operators(id),
 UNIQUE(id,node_id,kind)
);
CREATE UNIQUE INDEX endpoint_profile_name_unique ON public.endpoint_profiles(node_id,lower(name));
-- Enforce the safe typed profile shape even at the SQL runtime grant boundary.
CREATE FUNCTION public.valid_endpoint_settings(k text,s jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $body$
 SELECT CASE WHEN jsonb_typeof(s)='object' AND jsonb_typeof(s->'codecs')='array' THEN
  s @> '{"removeExisting":false,"directMedia":false,"rtpSymmetric":true,"forceRport":true}'::jsonb
  AND s ?& ARRAY['maxContacts','codecs']
  AND jsonb_typeof(s->'maxContacts')='number' AND s->>'maxContacts' ~ '^[1-5]$'
  AND jsonb_array_length(s->'codecs') BETWEEN 1 AND 3
  AND (SELECT count(DISTINCT value) FROM jsonb_array_elements(s->'codecs'))=jsonb_array_length(s->'codecs')
  AND CASE k WHEN 'sip' THEN
   s->'codecs' <@ '["ulaw","alaw"]'::jsonb
   AND s @> '{"signaling":"udp","mediaEncryption":"none","rewriteContact":true,"ice":false,"avpf":false,"rtcpMux":false,"useReceivedTransport":false}'::jsonb
   AND s-ARRAY['codecs','maxContacts','removeExisting','directMedia','rtpSymmetric','forceRport','signaling','mediaEncryption','rewriteContact','ice','avpf','rtcpMux','useReceivedTransport']='{}'::jsonb
  WHEN 'webrtc' THEN
   s->'codecs' <@ '["opus","ulaw","alaw"]'::jsonb
   AND s @> '{"signaling":"wss","mediaEncryption":"dtls-srtp","rewriteContact":false,"ice":true,"avpf":true,"rtcpMux":true,"useReceivedTransport":true,"dtlsVerify":"fingerprint","dtlsSetup":"actpass"}'::jsonb
   AND s-ARRAY['codecs','maxContacts','removeExisting','directMedia','rtpSymmetric','forceRport','signaling','mediaEncryption','rewriteContact','ice','avpf','rtcpMux','useReceivedTransport','dtlsVerify','dtlsSetup']='{}'::jsonb
  ELSE false END
 ELSE false END;
$body$;
REVOKE ALL ON FUNCTION public.valid_endpoint_settings(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.valid_endpoint_settings(text,jsonb) TO myims_runtime;
CREATE TABLE public.endpoint_profile_versions (
 profile_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0),
 node_id uuid NOT NULL,
 kind text NOT NULL,
 name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 80 AND name=btrim(name) AND name !~ '[[:cntrl:]]'),
 settings jsonb NOT NULL CHECK(octet_length(settings::text)<=2048 AND public.valid_endpoint_settings(kind,settings)),
 capability_revision integer NOT NULL CHECK(capability_revision>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_by uuid NOT NULL REFERENCES public.platform_operators(id),
 PRIMARY KEY(profile_id,version),
 UNIQUE(profile_id,version,node_id,kind),
 FOREIGN KEY(profile_id,node_id,kind) REFERENCES public.endpoint_profiles(id,node_id,kind) ON DELETE RESTRICT
);
ALTER TABLE public.endpoint_profiles ADD CONSTRAINT endpoint_profile_head_fk FOREIGN KEY(id,head_version) REFERENCES public.endpoint_profile_versions(profile_id,version) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE public.extensions (
 id uuid PRIMARY KEY,
 node_id uuid NOT NULL,
 installation_id uuid NOT NULL,
 number text NOT NULL CHECK(number ~ '^[1-9][0-9]{3,5}$' AND number::integer BETWEEN 1000 AND 899999),
 kind text NOT NULL CHECK(kind IN ('sip','webrtc')),
 profile_id uuid NOT NULL,
 profile_version integer NOT NULL,
 administrative_status text NOT NULL DEFAULT 'disabled' CHECK(administrative_status IN ('enabled','disabled')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 endpoint_key text NOT NULL UNIQUE,
 auth_key text NOT NULL UNIQUE,
 aor_key text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_by uuid NOT NULL REFERENCES public.platform_operators(id),
 updated_by uuid NOT NULL REFERENCES public.platform_operators(id),
 UNIQUE(node_id,number),
 FOREIGN KEY(node_id,installation_id) REFERENCES public.pbx_nodes(id,installation_id) ON DELETE RESTRICT,
 FOREIGN KEY(profile_id,profile_version,node_id,kind) REFERENCES public.endpoint_profile_versions(profile_id,version,node_id,kind) ON DELETE RESTRICT,
 CHECK(endpoint_key='ims-e-'||replace(installation_id::text,'-','')||'-'||replace(id::text,'-','')),
 CHECK(auth_key='ims-a-'||replace(installation_id::text,'-','')||'-'||replace(id::text,'-','')),
 CHECK(aor_key='ims-r-'||replace(installation_id::text,'-','')||'-'||replace(id::text,'-',''))
);
CREATE INDEX extensions_node_cursor ON public.extensions(node_id,id);
CREATE INDEX endpoint_profiles_node_cursor ON public.endpoint_profiles(node_id,id);
CREATE FUNCTION public.protect_inventory_mutation() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Inventory deletion unavailable' USING ERRCODE='23514'; END IF;
 IF NEW.id<>OLD.id OR NEW.node_id<>OLD.node_id OR NEW.kind<>OLD.kind OR NEW.created_at<>OLD.created_at OR NEW.created_by<>OLD.created_by OR NEW.updated_at<OLD.updated_at THEN
  RAISE EXCEPTION 'Immutable inventory identity' USING ERRCODE='23514';
 END IF;
 IF TG_TABLE_NAME='extensions' THEN
  IF NEW.installation_id<>OLD.installation_id OR NEW.number<>OLD.number OR NEW.endpoint_key<>OLD.endpoint_key OR NEW.auth_key<>OLD.auth_key OR NEW.aor_key<>OLD.aor_key OR NEW.version<>OLD.version+1 THEN
   RAISE EXCEPTION 'Invalid extension mutation' USING ERRCODE='23514';
  END IF;
 ELSE
  IF NEW.head_version<>OLD.head_version+1 THEN RAISE EXCEPTION 'Invalid profile mutation' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END;
$body$;
REVOKE ALL ON FUNCTION public.protect_inventory_mutation() FROM PUBLIC;
CREATE TRIGGER extension_protection BEFORE UPDATE OR DELETE ON public.extensions FOR EACH ROW EXECUTE FUNCTION public.protect_inventory_mutation();
CREATE TRIGGER endpoint_profile_protection BEFORE UPDATE OR DELETE ON public.endpoint_profiles FOR EACH ROW EXECUTE FUNCTION public.protect_inventory_mutation();
CREATE FUNCTION public.immutable_profile_version() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN RAISE EXCEPTION 'Immutable profile version' USING ERRCODE='23514'; END;
$body$;
REVOKE ALL ON FUNCTION public.immutable_profile_version() FROM PUBLIC;
CREATE TRIGGER endpoint_version_protection BEFORE UPDATE OR DELETE ON public.endpoint_profile_versions FOR EACH ROW EXECUTE FUNCTION public.immutable_profile_version();
CREATE TABLE public.inventory_receipts (
 operator_id uuid NOT NULL REFERENCES public.platform_operators(id),
 operation text NOT NULL CHECK(operation IN ('extension-create','bulk-create','profile-create','profile-version')),
 request_id uuid NOT NULL,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
 result jsonb NOT NULL CHECK(jsonb_typeof(result)='object' AND octet_length(result::text)<=16384),
 correlation_id text NOT NULL CHECK(correlation_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(operator_id,operation,request_id)
);
CREATE TRIGGER inventory_receipt_protection BEFORE UPDATE OR DELETE ON public.inventory_receipts FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_receipt();
CREATE INDEX inventory_receipt_expiry ON public.inventory_receipts(created_at);
REVOKE ALL ON public.endpoint_capabilities,public.endpoint_profiles,public.endpoint_profile_versions,public.extensions,public.inventory_receipts FROM PUBLIC,myims_runtime;
GRANT SELECT ON public.endpoint_capabilities,public.endpoint_profiles,public.endpoint_profile_versions,public.extensions,public.inventory_receipts TO myims_runtime;
-- FOR SHARE needs an UPDATE grant; this identity column is protected by its trigger.
GRANT UPDATE(installation_id) ON public.endpoint_capabilities TO myims_runtime;
CREATE FUNCTION public.protect_capability_runtime() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
 IF current_user='myims_runtime' THEN RAISE EXCEPTION 'Deployment-owned capability declaration' USING ERRCODE='42501'; END IF;
 IF NEW.installation_id<>OLD.installation_id OR NEW.revision<=OLD.revision THEN RAISE EXCEPTION 'Invalid capability revision' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$body$;
REVOKE ALL ON FUNCTION public.protect_capability_runtime() FROM PUBLIC;
CREATE TRIGGER capability_protection BEFORE UPDATE ON public.endpoint_capabilities FOR EACH ROW EXECUTE FUNCTION public.protect_capability_runtime();
GRANT INSERT(id,node_id,kind,name,created_by,updated_by) ON public.endpoint_profiles TO myims_runtime;
GRANT UPDATE(name,head_version,updated_at,updated_by) ON public.endpoint_profiles TO myims_runtime;
GRANT INSERT(profile_id,version,node_id,kind,name,settings,capability_revision,created_by) ON public.endpoint_profile_versions TO myims_runtime;
GRANT INSERT(id,node_id,installation_id,number,kind,profile_id,profile_version,endpoint_key,auth_key,aor_key,created_by,updated_by) ON public.extensions TO myims_runtime;
GRANT UPDATE(profile_id,profile_version,administrative_status,version,updated_at,updated_by) ON public.extensions TO myims_runtime;
GRANT INSERT(operator_id,operation,request_id,fingerprint,result,correlation_id) ON public.inventory_receipts TO myims_runtime;
COMMIT;
