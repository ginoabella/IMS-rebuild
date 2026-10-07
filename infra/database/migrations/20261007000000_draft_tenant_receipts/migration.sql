BEGIN;
-- Identity-owned qualified key for platform's immutable creation provenance.
ALTER TABLE public.staff_users ADD CONSTRAINT staff_users_tenant_id_id_key UNIQUE (tenant_id,id);
CREATE TABLE public.draft_tenant_receipts (
  operator_id uuid NOT NULL REFERENCES public.platform_operators(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  staff_id uuid NOT NULL,
  correlation_id text NOT NULL CHECK (correlation_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (operator_id,request_id),
  FOREIGN KEY (tenant_id,staff_id) REFERENCES public.staff_users(tenant_id,id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE FUNCTION public.protect_draft_receipt() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  RAISE EXCEPTION 'Immutable creation provenance' USING ERRCODE = '23514';
END;
$body$;
REVOKE ALL ON FUNCTION public.protect_draft_receipt() FROM PUBLIC;
CREATE TRIGGER draft_receipt_immutable BEFORE UPDATE OR DELETE ON public.draft_tenant_receipts FOR EACH ROW EXECUTE FUNCTION public.protect_draft_receipt();
REVOKE ALL ON public.draft_tenant_receipts FROM PUBLIC, myims_runtime;
GRANT SELECT ON public.draft_tenant_receipts TO myims_runtime;
GRANT INSERT (operator_id,request_id,fingerprint,tenant_id,staff_id,correlation_id) ON public.draft_tenant_receipts TO myims_runtime;
COMMIT;
