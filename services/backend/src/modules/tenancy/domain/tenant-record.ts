export type TenantStatus = 'draft' | 'active' | 'suspended' | 'retired';
export interface TenantRecord {
  id: string;
  normalized_code: string;
  display_name: string;
  status: TenantStatus;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  version: number;
  authority_version: number;
  created_at: Date;
  updated_at: Date;
}
