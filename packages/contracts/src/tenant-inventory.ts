/** Desired ownership only: no calling or staff-assignment permission. */
export type InventoryClaimState = 'reserved' | 'allocated' | 'released';
export interface InventoryClaim {
  id: string;
  tenantId: string;
  nodeId: string;
  installationId: string;
  extensionId: string;
  state: InventoryClaimState;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}
export interface AllocationTenant {
  id: string;
  status: 'draft' | 'active' | 'suspended' | 'retired';
  version: number;
  authorityVersion: number;
}
export type AllocationSelection =
  | { extensionIds: string[]; range?: never }
  | { range: { start: string; end: string }; extensionIds?: never };
export interface AllocationStock {
  id: string;
  number: string;
  kind: 'sip' | 'webrtc';
  version: number;
  administrativeStatus: 'enabled' | 'disabled';
  claim: InventoryClaim | null;
  credentialPending: boolean;
  assignment: 'none';
  verification: 'not_established';
}
export interface AllocationPreview {
  items: (
    { number: string; missing: true } | (AllocationStock & { missing: false })
  )[];
  canSave: boolean;
  tenant: AllocationTenant;
}
export interface AllocationSave {
  requestId: string;
  expectedTenantVersion: number;
  expectedAuthorityVersion: number;
  state: 'reserved' | 'allocated';
  items: { extensionId: string; expectedVersion: number }[];
}
export interface AllocationChange {
  requestId: string;
  expectedTenantVersion: number;
  expectedAuthorityVersion: number;
  expectedVersion: number;
}
export interface AllocationBlocker {
  id: string;
  name: string;
}
export interface AllocationList {
  tenant: AllocationTenant;
  items: (InventoryClaim & {
    stock: AllocationStock;
    blockers: AllocationBlocker[];
  })[];
  nextCursor: string | null;
  capacity: {
    available: number;
    reserved: number;
    allocated: number;
    disabled: number;
  };
}
export interface AllocationOutcome {
  items: InventoryClaim[];
  replayed: boolean;
}
