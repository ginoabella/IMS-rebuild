import { obj, uuid } from '../routing/validation';
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> =>
  obj(v) && Object.keys(v).every((k) => keys.includes(k));
const date = (v: unknown) =>
  typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v));
const nullableId = (v: unknown) => v === null || uuid(v);
const one = (v: unknown, values: string[]) =>
  typeof v === 'string' && values.includes(v);
export function liveRoute(parts: string[], method: string) {
  if (parts[0] !== 'revisions' || parts[1] !== 'live') return false;
  return method === 'GET'
    ? parts.length === 2 ||
        (parts.length === 4 &&
          ['operations', 'receipts'].includes(parts[2]!) &&
          uuid(parts[3]))
    : method === 'POST' &&
        parts.length === 3 &&
        ['apply', 'recover', 'reconcile'].includes(parts[2]!);
}
export function liveInput(parts: string[], v: unknown) {
  return (
    exact(
      v,
      parts[2] === 'apply'
        ? ['requestId', 'revisionId', 'expectedBaselineId']
        : ['requestId', 'targetId', 'expectedBaselineId'],
    ) &&
    uuid(v.requestId) &&
    uuid(v.expectedBaselineId) &&
    uuid(parts[2] === 'apply' ? v.revisionId : v.targetId)
  );
}
export function liveOperation(v: unknown): boolean {
  return (
    exact(v, [
      'id',
      'nodeId',
      'sequence',
      'kind',
      'revisionId',
      'expectedBaselineId',
      'targetId',
      'createdBy',
      'createdAt',
      'state',
      'validation',
      'installation',
      'verification',
      'recovery',
      'failure',
      'updatedAt',
    ]) &&
    uuid(v.id) &&
    uuid(v.nodeId) &&
    Number.isInteger(v.sequence) &&
    Number(v.sequence) > 0 &&
    Number(v.sequence) <= 2147483647 &&
    one(v.kind, ['apply', 'recover', 'reconcile']) &&
    nullableId(v.revisionId) &&
    uuid(v.expectedBaselineId) &&
    uuid(v.targetId) &&
    uuid(v.createdBy) &&
    date(v.createdAt) &&
    date(v.updatedAt) &&
    one(v.state, [
      'queued',
      'waiting',
      'validating',
      'installing',
      'reloading',
      'verifying',
      'recovering',
      'verified',
      'recovered',
      'validation_failed',
      'failed',
      'unknown',
      'revoked',
    ]) &&
    one(v.validation, ['pending', 'passed', 'failed']) &&
    one(v.installation, ['pending', 'uncertain', 'installed', 'failed']) &&
    one(v.verification, ['pending', 'passed', 'failed', 'unknown']) &&
    one(v.recovery, [
      'not_required',
      'pending',
      'passed',
      'failed',
      'unknown',
    ]) &&
    (v.failure === null ||
      one(v.failure, [
        'activity_busy',
        'activity_unknown',
        'activity_deadline',
        'originator_revoked',
        'stale_dependencies',
        'boundary_unavailable',
        'stale_owner',
        'validation_failed',
        'install_failed',
        'reload_failed',
        'verification_failed',
        'recovery_failed',
        'reconciliation_required',
        'material_invalid',
        'material_missing',
        'material_denied',
        'material_unavailable',
      ]))
  );
}
export function liveOutput(
  parts: string[],
  method: string,
  v: unknown,
): boolean {
  if (method === 'POST' || parts.length === 4)
    return exact(v, ['operation']) && liveOperation(v.operation);
  return (
    exact(v, [
      'nodeId',
      'available',
      'runtime',
      'installedId',
      'verifiedId',
      'knownGoodId',
      'activeOperationId',
      'baselineVerifiedAt',
      'updatedAt',
      'artifacts',
      'operations',
    ]) &&
    uuid(v.nodeId) &&
    typeof v.available === 'boolean' &&
    one(v.runtime, ['unavailable', 'verified', 'unknown', 'failed']) &&
    [v.installedId, v.verifiedId, v.knownGoodId, v.activeOperationId].every(
      nullableId,
    ) &&
    (v.baselineVerifiedAt === null || date(v.baselineVerifiedAt)) &&
    (v.updatedAt === null || date(v.updatedAt)) &&
    Array.isArray(v.operations) &&
    v.operations.length <= 25 &&
    v.operations.every(liveOperation) &&
    Array.isArray(v.artifacts) &&
    v.artifacts.length <= 100 &&
    v.artifacts.every(
      (a) =>
        exact(a, ['id', 'revisionId', 'initialBaseline', 'verifiedAt']) &&
        uuid(a.id) &&
        nullableId(a.revisionId) &&
        typeof a.initialBaseline === 'boolean' &&
        a.initialBaseline === (a.revisionId === null) &&
        date(a.verifiedAt),
    )
  );
}
