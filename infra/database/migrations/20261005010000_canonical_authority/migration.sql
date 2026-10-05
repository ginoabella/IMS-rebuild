BEGIN;
-- No implicit grants: a deployment with existing staff must supply an explicit,
-- reviewed role migration rather than assigning a privilege to every account.
ALTER TABLE public.staff_users ADD COLUMN roles text[] NOT NULL;
ALTER TABLE public.staff_users ADD CONSTRAINT staff_roles_valid CHECK (
  array_ndims(roles) = 1 AND array_lower(roles,1) = 1
  AND cardinality(roles) BETWEEN 1 AND 4
  AND array_position(roles,NULL) IS NULL
  AND roles <@ ARRAY['tenant_admin','call_taker','dispatcher','responder']::text[]
  AND cardinality(array_positions(roles,'tenant_admin')) <= 1
  AND cardinality(array_positions(roles,'call_taker')) <= 1
  AND cardinality(array_positions(roles,'dispatcher')) <= 1
  AND cardinality(array_positions(roles,'responder')) <= 1
);
GRANT INSERT (roles), UPDATE (roles) ON public.staff_users TO myims_runtime;
-- Operator authority is fixed by the owning store, with no role or tenant column.
COMMIT;
