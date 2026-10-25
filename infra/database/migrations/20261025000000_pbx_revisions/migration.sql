BEGIN;
CREATE TABLE public.pbx_revisions (
 id uuid PRIMARY KEY, node_id uuid NOT NULL, installation_id uuid NOT NULL,
 sequence integer NOT NULL CHECK(sequence>0), parent_id uuid, baseline_id uuid,
 compiler_version text NOT NULL, policy_version text NOT NULL,
 snapshot jsonb NOT NULL CHECK(octet_length(snapshot::text)<=4194304),
 source_digest text NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 created_by uuid NOT NULL REFERENCES public.platform_operators(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(node_id,sequence), UNIQUE(id,node_id),
 FOREIGN KEY(node_id,installation_id) REFERENCES public.pbx_nodes(id,installation_id),
 FOREIGN KEY(parent_id,node_id) REFERENCES public.pbx_revisions(id,node_id),
 FOREIGN KEY(baseline_id,node_id) REFERENCES public.pbx_revisions(id,node_id)
);
CREATE TABLE public.pbx_revision_receipts (
 operator_id uuid NOT NULL REFERENCES public.platform_operators(id), request_id uuid NOT NULL,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 revision_id uuid NOT NULL REFERENCES public.pbx_revisions(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(operator_id,request_id)
);
CREATE TABLE public.pbx_revision_validations (
 id uuid PRIMARY KEY, revision_id uuid NOT NULL REFERENCES public.pbx_revisions(id),
 compiler_version text NOT NULL, policy_version text NOT NULL,
 evaluated_digest text NOT NULL CHECK(evaluated_digest ~ '^[a-f0-9]{64}$'),
 result jsonb NOT NULL CHECK(octet_length(result::text)<=262144),
 created_by uuid NOT NULL REFERENCES public.platform_operators(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX pbx_revision_validation_page ON public.pbx_revision_validations(revision_id,created_at DESC,id);
CREATE TRIGGER pbx_revision_immutable BEFORE UPDATE OR DELETE ON public.pbx_revisions FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_receipt();
CREATE TRIGGER pbx_revision_receipt_immutable BEFORE UPDATE OR DELETE ON public.pbx_revision_receipts FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_receipt();
CREATE TRIGGER pbx_revision_validation_immutable BEFORE UPDATE OR DELETE ON public.pbx_revision_validations FOR EACH ROW EXECUTE FUNCTION public.protect_pbx_receipt();
REVOKE ALL ON public.pbx_revisions,public.pbx_revision_receipts,public.pbx_revision_validations FROM PUBLIC,myims_runtime;
GRANT SELECT,INSERT ON public.pbx_revisions,public.pbx_revision_receipts,public.pbx_revision_validations TO myims_runtime;
COMMIT;
