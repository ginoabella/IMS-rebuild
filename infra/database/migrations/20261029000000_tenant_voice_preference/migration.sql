BEGIN;
ALTER TABLE public.tenants ADD COLUMN voice_preference text NOT NULL DEFAULT 'not_configured',
 ADD CONSTRAINT tenant_voice_preference_valid CHECK (voice_preference IN ('not_configured','enabled','disabled'));
GRANT UPDATE(voice_preference) ON public.tenants TO myims_runtime;
ALTER TABLE public.tenant_edit_receipts DROP CONSTRAINT tenant_edit_receipts_section_check,
 ADD CONSTRAINT tenant_edit_receipts_section_check CHECK(section IN ('name','contacts','geography','voice'));
COMMIT;
