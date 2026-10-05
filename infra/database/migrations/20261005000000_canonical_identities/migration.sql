BEGIN;
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY,
  normalized_code text COLLATE "C" NOT NULL UNIQUE
    CHECK (length(normalized_code) BETWEEN 1 AND 64 AND normalized_code ~ '^[a-z0-9][a-z0-9_.-]*$'),
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 200 AND length(display_name) <= 200),
  status text NOT NULL CHECK (status IN ('draft','active','suspended','retired')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  authority_version integer NOT NULL DEFAULT 1 CHECK (authority_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.staff_users (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  normalized_username text COLLATE "C" NOT NULL
    CHECK (length(normalized_username) BETWEEN 1 AND 128 AND normalized_username ~ '^[a-z0-9][a-z0-9_.-]*$'),
  status text NOT NULL CHECK (status IN ('active','disabled')),
  credential_state text NOT NULL CHECK (credential_state IN ('unset','ready')),
  password_hash text CHECK (octet_length(password_hash) BETWEEN 1 AND 4096),
  credential_changed_at timestamptz,
  CHECK ((credential_state = 'unset' AND password_hash IS NULL AND credential_changed_at IS NULL)
    OR (credential_state = 'ready' AND password_hash IS NOT NULL AND credential_changed_at IS NOT NULL)),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  authentication_version integer NOT NULL DEFAULT 1 CHECK (authentication_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tenant_id, normalized_username)
);
CREATE TABLE public.platform_operators (
  id uuid PRIMARY KEY,
  normalized_username text COLLATE "C" NOT NULL UNIQUE
    CHECK (length(normalized_username) BETWEEN 1 AND 128 AND normalized_username ~ '^[a-z0-9][a-z0-9_.-]*$'),
  status text NOT NULL CHECK (status IN ('active','disabled')),
  credential_state text NOT NULL CHECK (credential_state IN ('unset','ready')),
  password_hash text CHECK (octet_length(password_hash) BETWEEN 1 AND 4096),
  credential_changed_at timestamptz,
  CHECK ((credential_state = 'unset' AND password_hash IS NULL AND credential_changed_at IS NULL)
    OR (credential_state = 'ready' AND password_hash IS NOT NULL AND credential_changed_at IS NOT NULL)),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  authentication_version integer NOT NULL DEFAULT 1 CHECK (authentication_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- One durable initial-bootstrap identity; c defines execution and rerun behavior.
CREATE TABLE public.operator_bootstrap_provenance (
  singleton boolean PRIMARY KEY CHECK (singleton),
  operator_id uuid NOT NULL UNIQUE REFERENCES public.platform_operators(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  command_reference text NOT NULL CHECK (command_reference ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION public.protect_identity_ownership() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Immutable identity' USING ERRCODE = '23514';
  END IF;
  IF NEW.version < OLD.version THEN
    RAISE EXCEPTION 'Identity version regression' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'tenants' THEN
    IF NEW.authority_version < OLD.authority_version THEN
      RAISE EXCEPTION 'Identity version regression' USING ERRCODE = '23514';
    END IF;
    IF NEW.normalized_code IS DISTINCT FROM OLD.normalized_code THEN
      RAISE EXCEPTION 'Immutable identity' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.authentication_version < OLD.authentication_version THEN
      RAISE EXCEPTION 'Identity version regression' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'staff_users' THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'Immutable identity' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$body$;
REVOKE ALL ON FUNCTION public.protect_identity_ownership() FROM PUBLIC;
CREATE TRIGGER tenants_ownership BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.protect_identity_ownership();
CREATE TRIGGER staff_ownership BEFORE UPDATE ON public.staff_users FOR EACH ROW EXECUTE FUNCTION public.protect_identity_ownership();
CREATE TRIGGER operators_ownership BEFORE UPDATE ON public.platform_operators FOR EACH ROW EXECUTE FUNCTION public.protect_identity_ownership();
REVOKE ALL ON public.tenants, public.staff_users, public.platform_operators, public.operator_bootstrap_provenance FROM PUBLIC, myims_runtime;
GRANT SELECT ON public.tenants, public.staff_users, public.platform_operators TO myims_runtime;
GRANT INSERT (id,normalized_code,display_name,status) ON public.tenants TO myims_runtime;
GRANT INSERT (id,tenant_id,normalized_username,status,credential_state,password_hash,credential_changed_at) ON public.staff_users TO myims_runtime;
GRANT UPDATE (display_name,status,version,authority_version,updated_at) ON public.tenants TO myims_runtime;
GRANT UPDATE (normalized_username,status,credential_state,password_hash,credential_changed_at,version,authentication_version,updated_at) ON public.staff_users, public.platform_operators TO myims_runtime;
COMMIT;
