export interface TenantVerificationView {
  readiness: {
    state: 'incomplete' | 'not_required' | 'ready';
    blockers: string[];
  };
  artifactId: string | null;
  revisionId: string | null;
  cases: {
    id: string;
    direction: 'inbound' | 'outbound';
    routeId: string;
    sourceId: string;
    dialled: string;
    expectedOutcome: 'permitted' | 'denied';
    expectedDestinationId: string | null;
    readinessRequired: boolean;
    kind:
      | 'routing'
      | 'ambiguous-source'
      | 'ordinary-draft'
      | 'expiry'
      | 'stale-source'
      | 'unpermitted';
  }[];
  grants: {
    id: string;
    artifactId: string;
    createdAt: string;
    expiresAt: string;
    active: boolean;
  }[];
  tests: {
    id: string;
    caseId: string;
    artifactId: string;
    revisionId: string;
    createdBy: string;
    createdAt: string;
    state: string;
    direction: 'inbound' | 'outbound';
    expectedOutcome: 'permitted' | 'denied';
    outcome: 'permitted' | 'denied' | 'failed' | 'unknown' | null;
    destinationId: string | null;
    finishedAt: string | null;
    current: boolean;
  }[];
}
export interface ArtifactRetirementView {
  items: {
    id: string;
    artifactId: string;
    replacementId: string;
    resourceId: string;
    createdBy: string;
    createdAt: string;
    state: 'queued' | 'retired' | 'rejected' | 'unknown';
    updatedAt: string;
  }[];
}
