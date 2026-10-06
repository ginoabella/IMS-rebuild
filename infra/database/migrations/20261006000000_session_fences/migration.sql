-- Identity-owned recovery authority, never an expiring session payload store.
CREATE TABLE public.session_fences (
  id uuid PRIMARY KEY,
  generation integer NOT NULL CHECK (generation BETWEEN 1 AND 2147483647),
  revoked boolean NOT NULL,
  absolute_expires_at bigint NOT NULL CHECK (absolute_expires_at > 0)
);
CREATE INDEX session_fences_retention ON public.session_fences (absolute_expires_at, id);
CREATE FUNCTION public.protect_session_fence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.absolute_expires_at > floor(extract(epoch FROM clock_timestamp()) * 1000) THEN
      RAISE EXCEPTION 'Session retention incomplete' USING ERRCODE='23514';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.generation <> 1 OR NEW.revoked OR NEW.absolute_expires_at <= floor(extract(epoch FROM clock_timestamp()) * 1000)
      OR NEW.absolute_expires_at > floor(extract(epoch FROM clock_timestamp()) * 1000) + 604800000 THEN
      RAISE EXCEPTION 'Invalid session fence creation' USING ERRCODE='23514';
    END IF;
  ELSE
    IF NEW.id <> OLD.id OR NEW.absolute_expires_at <> OLD.absolute_expires_at
      OR (OLD.revoked AND NOT NEW.revoked) OR NEW.generation < OLD.generation
      OR NEW.generation::bigint > OLD.generation::bigint + 1
      OR (OLD.revoked AND NEW.generation <> OLD.generation) THEN
      RAISE EXCEPTION 'Invalid session fence transition' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER session_fence_protection BEFORE INSERT OR UPDATE OR DELETE ON public.session_fences
  FOR EACH ROW EXECUTE FUNCTION public.protect_session_fence();
REVOKE ALL ON public.session_fences FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_session_fence() FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_fences TO myims_runtime;
-- No TRUNCATE, trigger/owner privilege, metadata rollback or early deletion.
