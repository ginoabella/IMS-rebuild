import type { CreatePbxNodeRequest } from '@myims/contracts';
export type PbxValues = {
  displayName: string;
  targetAlias: string;
  transport: string;
  port: string;
  credentialAlias: string;
};
export type PbxWork = {
  values: PbxValues;
  attempt: {
    readonly operatorId: string;
    readonly fingerprint: string;
    readonly epoch: number;
    readonly payload: CreatePbxNodeRequest;
  } | null;
  edit: {
    id: string;
    values: PbxValues;
    expectedVersion: number;
    needsReview: boolean;
  } | null;
};
export const emptyPbx = (): PbxWork => ({
  values: {
    displayName: '',
    targetAlias: '',
    transport: 'ami-tls',
    port: '',
    credentialAlias: '',
  },
  attempt: null,
  edit: null,
});
