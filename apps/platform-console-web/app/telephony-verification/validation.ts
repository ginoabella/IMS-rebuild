import { obj, uuid } from '../routing/validation';
export { obj, uuid };
const exact = (v: unknown, keys: string[]) =>
  obj(v) && Object.keys(v).every((k) => keys.includes(k));
const timestamp = (v: unknown) =>
  typeof v === 'string' &&
  v.length <= 32 &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v);
const nullableId = (v: unknown) => v === null || uuid(v);
export function verificationRoute(parts: string[], method: string) {
  return method === 'GET'
    ? parts.length === 0
    : method === 'POST' &&
        parts.length === 1 &&
        ['grant', 'revoke', 'test', 'reconcile'].includes(parts[0]!);
}
export function verificationInput(parts: string[], v: unknown) {
  if (!obj(v) || !uuid(v.requestId)) return false;
  if (parts[0] === 'reconcile')
    return exact(v, ['requestId', 'testId']) && uuid(v.testId);
  if (parts[0] === 'grant')
    return (
      exact(v, ['requestId', 'artifactId', 'caseIds', 'lifetimeSeconds']) &&
      uuid(v.artifactId) &&
      (v.lifetimeSeconds === undefined ||
        (typeof v.lifetimeSeconds === 'number' &&
          Number.isInteger(v.lifetimeSeconds) &&
          v.lifetimeSeconds >= 1 &&
          v.lifetimeSeconds <= 1800)) &&
      Array.isArray(v.caseIds) &&
      v.caseIds.length > 0 &&
      v.caseIds.length <= 16 &&
      v.caseIds.every(uuid) &&
      new Set(v.caseIds).size === v.caseIds.length
    );
  if (parts[0] === 'revoke')
    return exact(v, ['requestId', 'grantId']) && uuid(v.grantId);
  return (
    parts[0] === 'test' &&
    exact(v, ['requestId', 'artifactId', 'caseId', 'grantId']) &&
    uuid(v.artifactId) &&
    uuid(v.caseId) &&
    nullableId(v.grantId)
  );
}
export function retirementInput(v: unknown) {
  return (
    obj(v) &&
    exact(v, [
      'requestId',
      'artifactId',
      'replacementId',
      'resourceId',
      'reconcileId',
    ]) &&
    ['requestId', 'artifactId', 'replacementId', 'resourceId'].every((k) =>
      uuid(v[k]),
    ) &&
    (v.reconcileId === undefined || uuid(v.reconcileId))
  );
}
export function verificationOutput(
  parts: string[],
  method: string,
  v: unknown,
): boolean {
  if (!obj(v)) return false;
  if (method === 'POST')
    return (
      exact(v, ['id', 'action', 'expiresAt', 'state', 'replayed']) &&
      uuid(v.id) &&
      v.action === parts[0] &&
      typeof v.replayed === 'boolean' &&
      (v.expiresAt === undefined || timestamp(v.expiresAt)) &&
      (v.state === undefined || v.state === 'queued')
    );
  return (
    exact(v, [
      'readiness',
      'artifactId',
      'revisionId',
      'cases',
      'grants',
      'tests',
    ]) &&
    nullableId(v.artifactId) &&
    nullableId(v.revisionId) &&
    obj(v.readiness) &&
    exact(v.readiness, ['state', 'blockers']) &&
    ['incomplete', 'not_required', 'ready'].includes(
      String(v.readiness.state),
    ) &&
    Array.isArray(v.readiness.blockers) &&
    v.readiness.blockers.length <= 16 &&
    v.readiness.blockers.every(
      (b) => typeof b === 'string' && /^[a-z_]{1,80}$/.test(b),
    ) &&
    Array.isArray(v.cases) &&
    v.cases.length <= 32 &&
    v.cases.every(
      (c) =>
        obj(c) &&
        exact(c, [
          'id',
          'direction',
          'routeId',
          'sourceId',
          'dialled',
          'expectedOutcome',
          'expectedDestinationId',
          'readinessRequired',
          'kind',
        ]) &&
        ['id', 'routeId', 'sourceId'].every((k) => uuid(c[k])) &&
        ['inbound', 'outbound'].includes(String(c.direction)) &&
        typeof c.dialled === 'string' &&
        /^[0-9]{1,15}$/.test(c.dialled) &&
        ['permitted', 'denied'].includes(String(c.expectedOutcome)) &&
        nullableId(c.expectedDestinationId) &&
        typeof c.readinessRequired === 'boolean' &&
        [
          'routing',
          'ambiguous-source',
          'ordinary-draft',
          'expiry',
          'stale-source',
          'unpermitted',
        ].includes(String(c.kind)),
    ) &&
    Array.isArray(v.grants) &&
    v.grants.length <= 10 &&
    v.grants.every(
      (g) =>
        obj(g) &&
        exact(g, ['id', 'artifactId', 'createdAt', 'expiresAt', 'active']) &&
        uuid(g.id) &&
        uuid(g.artifactId) &&
        timestamp(g.createdAt) &&
        timestamp(g.expiresAt) &&
        typeof g.active === 'boolean',
    ) &&
    Array.isArray(v.tests) &&
    v.tests.length <= 25 &&
    v.tests.every(
      (t) =>
        obj(t) &&
        exact(t, [
          'id',
          'caseId',
          'artifactId',
          'revisionId',
          'createdBy',
          'createdAt',
          'state',
          'direction',
          'expectedOutcome',
          'outcome',
          'destinationId',
          'finishedAt',
          'current',
        ]) &&
        ['id', 'caseId', 'artifactId', 'revisionId', 'createdBy'].every((k) =>
          uuid(t[k]),
        ) &&
        timestamp(t.createdAt) &&
        [
          'queued',
          'dispatching',
          'admitted',
          'passed',
          'denied',
          'failed',
          'unknown',
        ].includes(String(t.state)) &&
        ['inbound', 'outbound'].includes(String(t.direction)) &&
        ['permitted', 'denied'].includes(String(t.expectedOutcome)) &&
        (t.outcome === null ||
          ['permitted', 'denied', 'failed', 'unknown'].includes(
            String(t.outcome),
          )) &&
        nullableId(t.destinationId) &&
        (t.finishedAt === null || timestamp(t.finishedAt)) &&
        typeof t.current === 'boolean',
    )
  );
}
export function retirementOutput(method: string, v: unknown): boolean {
  if (!obj(v)) return false;
  if (method === 'POST')
    return (
      exact(v, ['id', 'replayed']) &&
      uuid(v.id) &&
      typeof v.replayed === 'boolean'
    );
  return (
    exact(v, ['items']) &&
    Array.isArray(v.items) &&
    v.items.length <= 25 &&
    v.items.every(
      (i) =>
        obj(i) &&
        exact(i, [
          'id',
          'artifactId',
          'replacementId',
          'resourceId',
          'createdBy',
          'createdAt',
          'state',
          'updatedAt',
        ]) &&
        ['id', 'artifactId', 'replacementId', 'resourceId', 'createdBy'].every(
          (k) => uuid(i[k]),
        ) &&
        timestamp(i.createdAt) &&
        timestamp(i.updatedAt) &&
        ['queued', 'retired', 'rejected', 'unknown'].includes(String(i.state)),
    )
  );
}
