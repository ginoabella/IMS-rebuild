BEGIN;
-- Idempotency belongs to the target scope and work type, not a global key namespace.
ALTER TABLE public.outbox_work DROP CONSTRAINT outbox_work_idempotency_key_key;
CREATE UNIQUE INDEX outbox_work_scoped_key ON public.outbox_work(work_type, COALESCE(tenant_id, ''), idempotency_key);
COMMIT;
