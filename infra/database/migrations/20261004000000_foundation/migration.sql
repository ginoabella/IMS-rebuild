BEGIN;
CREATE EXTENSION IF NOT EXISTS postgis;
DO $block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'myims_runtime') THEN
    CREATE ROLE myims_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END $block$;
ALTER ROLE myims_runtime NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO myims_runtime;
GRANT SELECT ON TABLE public._prisma_migrations TO myims_runtime;
-- Feature tables and their runtime grants belong to later module-owned migrations.
COMMIT;
