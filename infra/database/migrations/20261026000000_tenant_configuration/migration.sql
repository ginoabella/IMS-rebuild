BEGIN;
-- Tenancy owns contact persistence; platform owns immutable edit outcomes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
ALTER TABLE public.tenants ADD COLUMN contact_name text,
 ADD COLUMN contact_email text, ADD COLUMN contact_phone text,
 ADD CONSTRAINT tenant_contact_name_bound CHECK (contact_name IS NULL OR char_length(contact_name) BETWEEN 1 AND 200),
 ADD CONSTRAINT tenant_contact_email_bound CHECK (contact_email IS NULL OR char_length(contact_email) BETWEEN 1 AND 254),
 ADD CONSTRAINT tenant_contact_phone_bound CHECK (contact_phone IS NULL OR char_length(contact_phone) BETWEEN 1 AND 50);
CREATE INDEX tenant_name_search ON public.tenants USING gin (display_name gin_trgm_ops);
CREATE INDEX tenant_code_search ON public.tenants USING gin (normalized_code gin_trgm_ops);
CREATE INDEX tenant_status_page ON public.tenants(status,id);
GRANT UPDATE(contact_name,contact_email,contact_phone) ON public.tenants TO myims_runtime;
CREATE TABLE public.tenant_edit_receipts (
 request_id uuid PRIMARY KEY,
 operator_id uuid NOT NULL REFERENCES public.platform_operators(id),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 section text NOT NULL CHECK (section IN ('name','contacts')),
 fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
 version integer NOT NULL CHECK (version > 0),
 authority_version integer NOT NULL CHECK (authority_version > 0),
 correlation_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION public.protect_tenant_edit_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Tenant edit receipts are immutable'; END $$;
REVOKE ALL ON FUNCTION public.protect_tenant_edit_receipt() FROM PUBLIC;
CREATE TRIGGER tenant_edit_receipt_immutable BEFORE UPDATE OR DELETE ON public.tenant_edit_receipts
 FOR EACH ROW EXECUTE FUNCTION public.protect_tenant_edit_receipt();
REVOKE ALL ON public.tenant_edit_receipts FROM PUBLIC,myims_runtime;
GRANT SELECT ON public.tenant_edit_receipts TO myims_runtime;
GRANT INSERT(request_id,operator_id,tenant_id,section,fingerprint,version,authority_version,correlation_id)
 ON public.tenant_edit_receipts TO myims_runtime;
COMMIT;
