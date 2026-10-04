BEGIN;
-- Outcomes are retained independently of transport job retention. Not a scheduler.
CREATE TABLE public.work_results (
  work_id uuid PRIMARY KEY REFERENCES public.outbox_work(id),
  handler text NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 1000),
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending','succeeded','failed')),
  failure_code text CHECK (failure_code IN ('invalid_work','permanent_failure','retry_exhausted','queue_exhausted')),
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  finished_at timestamptz,
  CHECK ((outcome = 'pending' AND finished_at IS NULL) OR (outcome <> 'pending' AND finished_at IS NOT NULL)),
  CHECK ((outcome = 'failed' AND failure_code IS NOT NULL) OR (outcome <> 'failed' AND failure_code IS NULL))
);
CREATE TABLE public.work_receipts (
  work_id uuid REFERENCES public.outbox_work(id),
  handler text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (work_id, handler)
);
-- Named deterministic sample destination. Acceptance survives caller restart.
CREATE TABLE public.sample_delivery_sink (
  work_id uuid PRIMARY KEY REFERENCES public.outbox_work(id),
  handler text NOT NULL,
  tenant_scope text NOT NULL,
  idempotency_key text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tenant_scope, handler, idempotency_key)
);
REVOKE ALL ON public.work_results, public.work_receipts, public.sample_delivery_sink FROM PUBLIC, myims_runtime;
GRANT SELECT, INSERT, UPDATE ON public.work_results TO myims_runtime;
GRANT SELECT, INSERT ON public.work_receipts, public.sample_delivery_sink TO myims_runtime;
COMMIT;
