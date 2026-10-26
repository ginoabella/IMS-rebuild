/** Safe progress only; no commands, paths, runtime keys or material provenance hashes. */
export type PbxLiveState =
  | 'queued'
  | 'waiting'
  | 'validating'
  | 'installing'
  | 'reloading'
  | 'verifying'
  | 'recovering'
  | 'verified'
  | 'recovered'
  | 'validation_failed'
  | 'failed'
  | 'unknown'
  | 'revoked';
export interface PbxLiveOperation {
  id: string;
  nodeId: string;
  sequence: number;
  kind: 'apply' | 'recover' | 'reconcile';
  revisionId: string | null;
  expectedBaselineId: string;
  targetId: string;
  createdBy: string;
  createdAt: string;
  state: PbxLiveState;
  validation: 'pending' | 'passed' | 'failed';
  installation: 'pending' | 'uncertain' | 'installed' | 'failed';
  verification: 'pending' | 'passed' | 'failed' | 'unknown';
  recovery: 'not_required' | 'pending' | 'passed' | 'failed' | 'unknown';
  failure: string | null;
  updatedAt: string;
}
export interface PbxLiveStatus {
  nodeId: string;
  available: boolean;
  runtime: 'unavailable' | 'verified' | 'unknown' | 'failed';
  installedId: string | null;
  verifiedId: string | null;
  knownGoodId: string | null;
  activeOperationId: string | null;
  baselineVerifiedAt: string | null;
  updatedAt: string | null;
  artifacts: {
    id: string;
    revisionId: string | null;
    initialBaseline: boolean;
    verifiedAt: string;
  }[];
  operations: PbxLiveOperation[];
}
