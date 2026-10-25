import { uuid, obj } from '../routing/validation';
export { uuid };
export function route(parts: string[], method: string) {
  return (
    parts[0] === 'revisions' &&
    (method === 'GET'
      ? parts.length === 1 ||
        (parts.length === 2 && uuid(parts[1])) ||
        (parts.length === 3 && parts[1] === 'receipts' && uuid(parts[2]))
      : method === 'POST' &&
        (parts.length === 1 ||
          (parts.length === 3 && uuid(parts[1]) && parts[2] === 'validate')))
  );
}
const exact = (v: unknown, keys: string[]) =>
  obj(v) && Object.keys(v).every((k) => keys.includes(k));
const text = (v: unknown) => typeof v === 'string' && v.length <= 320;
const integer = (v: unknown) =>
  typeof v === 'number' && Number.isInteger(v) && v > 0;
const nullableId = (v: unknown) => v === null || uuid(v);
const kinds = [
  'node',
  'capability',
  'profiles',
  'extensions',
  'trunks',
  'gateways',
  'dids',
  'groups',
  'reservations',
  'inbound',
  'outbound',
  'credentials',
];
export function summary(v: unknown): boolean {
  return (
    exact(v, [
      'id',
      'nodeId',
      'installationId',
      'sequence',
      'parentId',
      'baselineId',
      'compilerVersion',
      'policyVersion',
      'createdBy',
      'createdAt',
    ]) &&
    obj(v) &&
    uuid(v.id) &&
    uuid(v.nodeId) &&
    uuid(v.installationId) &&
    integer(v.sequence) &&
    nullableId(v.parentId) &&
    nullableId(v.baselineId) &&
    text(v.compilerVersion) &&
    text(v.policyVersion) &&
    uuid(v.createdBy) &&
    text(v.createdAt)
  );
}
function diagnostics(v: unknown) {
  return (
    Array.isArray(v) &&
    v.length <= 513 &&
    v.every(
      (d) =>
        exact(d, ['code', 'resourceId', 'severity']) &&
        obj(d) &&
        typeof d.code === 'string' &&
        /^[a-zA-Z0-9_-]{1,80}$/.test(d.code) &&
        nullableId(d.resourceId) &&
        ['error', 'blocker'].includes(String(d.severity)),
    )
  );
}
function validation(v: unknown): boolean {
  return (
    exact(v, [
      'id',
      'revisionId',
      'compilerVersion',
      'policyVersion',
      'evaluatedDigest',
      'evaluatedDependencies',
      'createdBy',
      'createdAt',
      'local',
      'live',
      'applicable',
      'diagnostics',
    ]) &&
    obj(v) &&
    uuid(v.id) &&
    uuid(v.revisionId) &&
    text(v.compilerVersion) &&
    text(v.policyVersion) &&
    typeof v.evaluatedDigest === 'string' &&
    /^[a-f0-9]{64}$/.test(v.evaluatedDigest) &&
    Array.isArray(v.evaluatedDependencies) &&
    v.evaluatedDependencies.length <= 2048 &&
    v.evaluatedDependencies.every(
      (d) =>
        obj(d) &&
        exact(d, ['kind', 'id', 'version']) &&
        kinds.includes(String(d.kind)) &&
        uuid(d.id) &&
        integer(d.version),
    ) &&
    uuid(v.createdBy) &&
    text(v.createdAt) &&
    ['passed', 'failed'].includes(String(v.local)) &&
    v.live === 'unavailable' &&
    typeof v.applicable === 'boolean' &&
    diagnostics(v.diagnostics)
  );
}
export function input(parts: string[], v: unknown) {
  if (parts.length === 3) return exact(v, []) && obj(v);
  return (
    exact(v, ['requestId', 'baselineId']) &&
    obj(v) &&
    uuid(v.requestId) &&
    (v.baselineId === undefined || nullableId(v.baselineId))
  );
}
export function output(parts: string[], method: string, v: unknown): boolean {
  if (!obj(v)) return false;
  if (method === 'POST')
    return parts.length === 1
      ? exact(v, ['revision']) && summary(v.revision)
      : exact(v, ['validation']) && validation(v.validation);
  if (parts[1] === 'receipts')
    return exact(v, ['revision']) && summary(v.revision);
  if (parts.length === 1)
    return (
      exact(v, ['items', 'nextCursor']) &&
      Array.isArray(v.items) &&
      v.items.length <= 100 &&
      v.items.every(summary) &&
      (v.nextCursor === null ||
        (typeof v.nextCursor === 'string' &&
          /^[1-9][0-9]{0,9}$/.test(v.nextCursor)))
    );
  return (
    exact(v, [
      'revision',
      'resources',
      'diagnostics',
      'sourceCurrent',
      'validation',
      'diff',
    ]) &&
    summary(v.revision) &&
    typeof v.sourceCurrent === 'boolean' &&
    (v.validation === null || validation(v.validation)) &&
    diagnostics(v.diagnostics) &&
    Array.isArray(v.resources) &&
    v.resources.length <= 2048 &&
    v.resources.every(
      (r) =>
        exact(r, [
          'kind',
          'id',
          'version',
          'name',
          'callingEligible',
          'credentialReferences',
        ]) &&
        obj(r) &&
        kinds.includes(String(r.kind)) &&
        uuid(r.id) &&
        integer(r.version) &&
        text(r.name) &&
        r.callingEligible === false &&
        Array.isArray(r.credentialReferences) &&
        r.credentialReferences.length <= 1 &&
        r.credentialReferences.every(
          (c) =>
            typeof c === 'string' &&
            /^(endpoint:[a-f0-9-]{36}|trunk:[a-f0-9-]{36}:[1-9][0-9]*)$/.test(
              c,
            ),
        ),
    ) &&
    obj(v.diff) &&
    exact(v.diff, ['baseline', 'runtime', 'changes']) &&
    (v.diff.baseline === null || summary(v.diff.baseline)) &&
    obj(v.diff.runtime) &&
    exact(v.diff.runtime, ['kind', 'drift']) &&
    v.diff.runtime.kind === 'no_verified_runtime' &&
    v.diff.runtime.drift === 'unknown' &&
    Array.isArray(v.diff.changes) &&
    v.diff.changes.length <= 4096 &&
    v.diff.changes.every(
      (c) =>
        obj(c) &&
        exact(c, [
          'kind',
          'id',
          'name',
          'change',
          'fields',
          'values',
          'credentialReferenceChanged',
        ]) &&
        kinds.includes(String(c.kind)) &&
        uuid(c.id) &&
        text(c.name) &&
        ['added', 'removed', 'edited'].includes(String(c.change)) &&
        typeof c.credentialReferenceChanged === 'boolean' &&
        Array.isArray(c.values) &&
        c.values.length <= 40 &&
        c.values.every(
          (v) =>
            obj(v) &&
            exact(v, ['field', 'before', 'after']) &&
            typeof v.field === 'string' &&
            /^[a-zA-Z]{1,40}$/.test(v.field) &&
            [v.before, v.after].every(
              (x) => x === null || (typeof x === 'string' && x.length <= 2048),
            ),
        ) &&
        Array.isArray(c.fields) &&
        c.fields.length <= 40 &&
        c.fields.every(
          (f) => typeof f === 'string' && /^[a-zA-Z]{1,40}$/.test(f),
        ),
    )
  );
}
