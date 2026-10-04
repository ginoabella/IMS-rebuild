BEGIN;
CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$'),
  schema_version smallint NOT NULL CHECK (schema_version > 0),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_kind text NOT NULL CHECK (actor_kind IN ('platform_operator','tenant_staff','system')),
  actor_reference text NOT NULL CHECK (actor_reference ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$'),
  identity_plane text NOT NULL,
  actor_tenant_id text,
  system_reason text,
  target_type text NOT NULL CHECK (target_type ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$'),
  target_reference text NOT NULL CHECK (target_reference ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$'),
  tenant_id text CHECK (tenant_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$'),
  correlation_id text NOT NULL CHECK (correlation_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$'),
  CHECK (
    (actor_kind = 'platform_operator' AND identity_plane = 'platform' AND actor_tenant_id IS NULL AND system_reason IS NULL)
    OR (actor_kind = 'tenant_staff' AND identity_plane = 'tenant' AND actor_tenant_id IS NOT NULL
        AND actor_tenant_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$'
        AND tenant_id IS NOT NULL AND actor_tenant_id = tenant_id AND system_reason IS NULL)
    OR (actor_kind = 'system' AND identity_plane = 'system' AND actor_tenant_id IS NULL AND system_reason IS NOT NULL
        AND system_reason ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$')
  ),
  metadata jsonb NOT NULL CHECK (jsonb_typeof(metadata) = 'object' AND octet_length(metadata::text) <= 4096)
);
CREATE INDEX audit_events_target ON public.audit_events (target_type, target_reference, recorded_at, id);
CREATE INDEX audit_events_tenant ON public.audit_events (tenant_id, recorded_at, id);
CREATE INDEX audit_events_correlation ON public.audit_events (correlation_id);
CREATE TABLE public.outbox_work (
  id uuid PRIMARY KEY,
  work_type text NOT NULL CHECK (work_type ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$'),
  schema_version smallint NOT NULL CHECK (schema_version > 0),
  idempotency_key text NOT NULL UNIQUE CHECK (idempotency_key ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_kind text NOT NULL CHECK (actor_kind IN ('platform_operator','tenant_staff','system')),
  actor_reference text NOT NULL CHECK (actor_reference ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$'),
  identity_plane text NOT NULL,
  actor_tenant_id text,
  system_reason text,
  target_type text NOT NULL CHECK (target_type ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$'),
  target_reference text NOT NULL CHECK (target_reference ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$'),
  tenant_id text CHECK (tenant_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$'),
  correlation_id text NOT NULL CHECK (correlation_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$'),
  CHECK (
    (actor_kind = 'platform_operator' AND identity_plane = 'platform' AND actor_tenant_id IS NULL AND system_reason IS NULL)
    OR (actor_kind = 'tenant_staff' AND identity_plane = 'tenant' AND actor_tenant_id IS NOT NULL
        AND actor_tenant_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$'
        AND tenant_id IS NOT NULL AND actor_tenant_id = tenant_id AND system_reason IS NULL)
    OR (actor_kind = 'system' AND identity_plane = 'system' AND actor_tenant_id IS NULL AND system_reason IS NOT NULL
        AND system_reason ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$')
  ),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 4096),
  handoff_status text NOT NULL DEFAULT 'pending' CHECK (handoff_status IN ('pending', 'accepted')),
  accepted_at timestamptz,
  CHECK ((handoff_status = 'pending' AND accepted_at IS NULL) OR (handoff_status = 'accepted' AND accepted_at IS NOT NULL))
);
CREATE INDEX outbox_work_pending ON public.outbox_work (created_at, id) WHERE handoff_status = 'pending';
CREATE INDEX outbox_work_correlation ON public.outbox_work (correlation_id);
-- Defense in depth: grants are the runtime boundary; deployment owns maintenance.
CREATE FUNCTION public.reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN RAISE EXCEPTION 'Audit history is append-only' USING ERRCODE = '42501'; END;
$body$;
REVOKE ALL ON FUNCTION public.reject_audit_mutation() FROM PUBLIC;
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON public.audit_events
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_audit_mutation();
REVOKE ALL ON public.audit_events, public.outbox_work FROM PUBLIC, myims_runtime;
GRANT SELECT ON public.audit_events, public.outbox_work TO myims_runtime;
-- Exclude database-recorded timestamps and initial handoff defaults from INSERT grants.
GRANT INSERT (id,event_type,schema_version,actor_kind,actor_reference,identity_plane,actor_tenant_id,system_reason,target_type,target_reference,tenant_id,correlation_id,metadata)
ON public.audit_events TO myims_runtime;
GRANT INSERT (id,work_type,schema_version,idempotency_key,actor_kind,actor_reference,identity_plane,actor_tenant_id,system_reason,target_type,target_reference,tenant_id,correlation_id,payload)
ON public.outbox_work TO myims_runtime;
-- P1-U5b can mutate only handoff status; immutable intent and attribution are retained.
GRANT UPDATE (handoff_status, accepted_at) ON public.outbox_work TO myims_runtime;
COMMIT;
