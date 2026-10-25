/** Review DTOs deliberately exclude internal compiler inputs and runtime keys. */
export type RevisionResourceKind =
  | 'node'
  | 'capability'
  | 'profiles'
  | 'extensions'
  | 'trunks'
  | 'gateways'
  | 'dids'
  | 'groups'
  | 'reservations'
  | 'inbound'
  | 'outbound'
  | 'credentials';
export interface RevisionResource {
  kind: RevisionResourceKind;
  id: string;
  version: number;
  name: string;
  callingEligible: false;
  credentialReferences: string[];
}
export interface RevisionDiagnostic {
  code: string;
  resourceId: string | null;
  severity: 'error' | 'blocker';
}
export interface RevisionSummary {
  id: string;
  nodeId: string;
  installationId: string;
  sequence: number;
  parentId: string | null;
  baselineId: string | null;
  compilerVersion: string;
  policyVersion: string;
  createdBy: string;
  createdAt: string;
}
export interface RevisionValidation {
  id: string;
  revisionId: string;
  compilerVersion: string;
  policyVersion: string;
  evaluatedDigest: string;
  evaluatedDependencies: {
    kind: RevisionResourceKind;
    id: string;
    version: number;
  }[];
  createdBy: string;
  createdAt: string;
  local: 'passed' | 'failed';
  live: 'unavailable';
  applicable: boolean;
  diagnostics: RevisionDiagnostic[];
}
export interface RevisionDiff {
  baseline: RevisionSummary | null;
  runtime: { kind: 'no_verified_runtime'; drift: 'unknown' };
  changes: {
    kind: RevisionResourceKind;
    id: string;
    name: string;
    change: 'added' | 'removed' | 'edited';
    fields: string[];
    values: { field: string; before: string | null; after: string | null }[];
    credentialReferenceChanged: boolean;
  }[];
}
export interface RevisionDetail {
  revision: RevisionSummary;
  resources: RevisionResource[];
  diagnostics: RevisionDiagnostic[];
  sourceCurrent: boolean;
  validation: RevisionValidation | null;
  diff: RevisionDiff;
}
export interface RevisionList {
  items: RevisionSummary[];
  nextCursor: string | null;
}
