BEGIN;
CREATE TABLE public.credential_actions (
  id uuid PRIMARY KEY,
  lookup_hash text NOT NULL UNIQUE CHECK (lookup_hash ~ '^[a-f0-9]{64}$'),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('setup','reset')),
  target_version integer NOT NULL CHECK (target_version > 0),
  target_authentication_version integer NOT NULL CHECK (target_authentication_version > 0),
  tenant_authority_version integer NOT NULL CHECK (tenant_authority_version > 0),
  issuer_plane text NOT NULL CHECK (issuer_plane IN ('platform','tenant')),
  issuer_operator_id uuid REFERENCES public.platform_operators(id) ON DELETE RESTRICT,
  issuer_staff_id uuid,
  issuer_tenant_id uuid,
  issuer_authentication_version integer NOT NULL CHECK (issuer_authentication_version > 0),
  verification_method text NOT NULL CHECK (verification_method IN ('in_person','known_contact_call')),
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(issued_at)),
  expires_at timestamptz NOT NULL CHECK (isfinite(expires_at) AND expires_at > issued_at),
  CHECK (expires_at <= issued_at + CASE purpose WHEN 'setup' THEN interval '24 hours' ELSE interval '30 minutes' END),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','consumed','cancelled')),
  terminal_at timestamptz,
  FOREIGN KEY (tenant_id,staff_id) REFERENCES public.staff_users(tenant_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (issuer_tenant_id,issuer_staff_id) REFERENCES public.staff_users(tenant_id,id) ON DELETE RESTRICT,
  CHECK ((issuer_plane='platform' AND issuer_operator_id IS NOT NULL AND issuer_staff_id IS NULL AND issuer_tenant_id IS NULL)
      OR (issuer_plane='tenant' AND issuer_operator_id IS NULL AND issuer_staff_id IS NOT NULL AND issuer_tenant_id IS NOT NULL AND issuer_tenant_id=tenant_id AND issuer_staff_id<>staff_id)),
  CHECK ((state='pending' AND terminal_at IS NULL) OR (state<>'pending' AND terminal_at IS NOT NULL AND isfinite(terminal_at) AND terminal_at>=issued_at))
);
CREATE UNIQUE INDEX credential_actions_pending_target ON public.credential_actions(tenant_id,staff_id) WHERE state='pending';
CREATE INDEX credential_actions_target_history ON public.credential_actions(tenant_id,staff_id,issued_at DESC,id);
CREATE INDEX credential_actions_retention ON public.credential_actions((LEAST(terminal_at,expires_at)));
CREATE FUNCTION public.protect_credential_action() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF clock_timestamp() < LEAST(OLD.terminal_at,OLD.expires_at)+interval '30 days' THEN
      RAISE EXCEPTION 'Credential action retention violation';
    END IF;
    RETURN OLD;
  END IF;
  IF (to_jsonb(NEW)-'state'-'terminal_at') IS DISTINCT FROM (to_jsonb(OLD)-'state'-'terminal_at')
    OR OLD.state<>'pending' OR NEW.state='pending' THEN
    RAISE EXCEPTION 'Credential action is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER credential_action_immutable BEFORE UPDATE OR DELETE ON public.credential_actions FOR EACH ROW EXECUTE FUNCTION public.protect_credential_action();
REVOKE ALL ON public.credential_actions FROM PUBLIC,myims_runtime;
GRANT SELECT,DELETE ON public.credential_actions TO myims_runtime;
GRANT INSERT(id,lookup_hash,tenant_id,staff_id,purpose,target_version,target_authentication_version,tenant_authority_version,issuer_plane,issuer_operator_id,issuer_staff_id,issuer_tenant_id,issuer_authentication_version,verification_method,issued_at,expires_at) ON public.credential_actions TO myims_runtime;
GRANT UPDATE(state,terminal_at) ON public.credential_actions TO myims_runtime;
REVOKE ALL ON FUNCTION public.protect_credential_action() FROM PUBLIC;
COMMIT;
