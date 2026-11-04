import { outbound } from '../routing/validation';
import { obj, uuid } from '../routing/validation';
export { obj, uuid };
export const kinds = [
  'dids',
  'groups',
  'inbound',
  'outbound',
  'trunks',
  'permission',
];
const exact = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).every((k) => keys.includes(k));
const ver = (v: unknown) =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 2147483647;
const scope = (v: Record<string, unknown>) =>
  v.scope === 'owned' || (v.kind === 'trunks' && v.scope === 'shared');
const facts = (v: unknown) =>
  Array.isArray(v) &&
  v.length > 0 &&
  v.length <= 512 &&
  v.every(
    (f) =>
      obj(f) &&
      exact(f, ['kind', 'id', 'version']) &&
      [
        ...kinds,
        'authorization',
        'allocation',
        'extensions',
        'gateways',
      ].includes(String(f.kind)) &&
      uuid(f.id) &&
      ver(f.version),
  ) &&
  new Set(v.map((f) => `${f.kind}:${f.id.toLowerCase()}`)).size === v.length;
const blockers = (v: unknown) =>
  Array.isArray(v) &&
  v.length <= 10 &&
  v.every(
    (b) =>
      obj(b) &&
      exact(b, ['id', 'name', 'kind', 'tenantId']) &&
      uuid(b.id) &&
      (b.tenantId === undefined || b.tenantId === null || uuid(b.tenantId)) &&
      typeof b.name === 'string' &&
      b.name.length <= 320 &&
      [...kinds, 'binding', 'extensions', 'gateways'].includes(String(b.kind)),
  );
function review(v: unknown): boolean {
  return (
    obj(v) &&
    exact(v, [
      'advisory',
      'callingEligible',
      'compatible',
      'currentVersion',
      'evaluated',
      'blockers',
    ]) &&
    v.advisory === true &&
    v.callingEligible === false &&
    typeof v.compatible === 'boolean' &&
    (v.currentVersion === null || ver(v.currentVersion)) &&
    Array.isArray(v.evaluated) &&
    (v.evaluated.length === 0 || facts(v.evaluated)) &&
    blockers(v.blockers)
  );
}
function authorization(v: unknown, t: string, n: string): boolean {
  return (
    obj(v) &&
    exact(v, [
      'id',
      'tenantId',
      'nodeId',
      'installationId',
      'kind',
      'resourceId',
      'scope',
      'state',
      'version',
      'evaluated',
      'createdAt',
      'updatedAt',
      'createdBy',
      'updatedBy',
      'review',
    ]) &&
    ['id', 'installationId', 'resourceId', 'createdBy', 'updatedBy'].every(
      (k) => uuid(v[k]),
    ) &&
    v.nodeId === n.toLowerCase() &&
    (v.tenantId === t.toLowerCase() ||
      (v.tenantId === null && v.kind === 'trunks' && v.scope === 'shared')) &&
    kinds.includes(String(v.kind)) &&
    scope(v) &&
    ['active', 'revoked'].includes(String(v.state)) &&
    ver(v.version) &&
    facts(v.evaluated) &&
    ['createdAt', 'updatedAt'].every(
      (k) =>
        typeof v[k] === 'string' && Number.isFinite(Date.parse(v[k] as string)),
    ) &&
    (!('review' in v) || review(v.review))
  );
}
export function bindingRoute(parts: string[], method: string) {
  return method === 'GET'
    ? parts.length === 0 || (parts.length === 1 && parts[0] === 'selection')
    : method === 'POST' &&
        (parts.length === 0 ||
          (parts.length === 1 &&
            ['preview', 'outbound-preview'].includes(parts[0]!)) ||
          (parts.length === 2 && uuid(parts[0]) && parts[1] === 'revoke'));
}
export function bindingInput(parts: string[], v: unknown): boolean {
  if (!obj(v)) return false;
  if (parts[0] === 'outbound-preview')
    return (
      exact(v, ['dialled']) &&
      typeof v.dialled === 'string' &&
      /^[0-9]{1,15}$/.test(v.dialled)
    );
  if (parts[0] === 'preview')
    return (
      exact(v, ['kind', 'resourceId', 'scope']) &&
      kinds.includes(String(v.kind)) &&
      uuid(v.resourceId) &&
      scope(v)
    );
  if (
    !uuid(v.requestId) ||
    !ver(v.expectedTenantVersion) ||
    !ver(v.expectedAuthorityVersion)
  )
    return false;
  if (parts.length === 2)
    return (
      exact(v, [
        'requestId',
        'expectedVersion',
        'expectedTenantVersion',
        'expectedAuthorityVersion',
      ]) && ver(v.expectedVersion)
    );
  return (
    exact(v, [
      'requestId',
      'expectedVersion',
      'expectedTenantVersion',
      'expectedAuthorityVersion',
      'kind',
      'resourceId',
      'scope',
      'evaluated',
    ]) &&
    (v.expectedVersion === null || ver(v.expectedVersion)) &&
    kinds.includes(String(v.kind)) &&
    uuid(v.resourceId) &&
    scope(v) &&
    facts(v.evaluated)
  );
}
export function bindingOutput(
  parts: string[],
  method: string,
  v: unknown,
  t: string,
  n: string,
): boolean {
  if (!obj(v)) return false;
  if (parts[0] === 'preview') return review(v);
  if (parts[0] === 'outbound-preview') {
    // Reuse the established outbound DTO validator for selected rule shape below.
    return (
      exact(v, [
        'advisory',
        'callingEligible',
        'reason',
        'rule',
        'transformed',
      ]) &&
      v.advisory === true &&
      v.callingEligible === false &&
      ['no_match', 'disabled_rule', 'incompatible', 'matched'].includes(
        String(v.reason),
      ) &&
      (v.rule === null ||
        (outbound(v.rule) &&
          obj(v.rule) &&
          v.rule.nodeId === n.toLowerCase())) &&
      (v.transformed === null ||
        (typeof v.transformed === 'string' &&
          /^[0-9]{1,15}$/.test(v.transformed)))
    );
  }
  if (!Array.isArray(v.items) || v.items.length > 100) return false;
  if (method === 'POST')
    return (
      exact(v, ['items', 'replayed']) &&
      v.items.length === 1 &&
      v.items.every((a) => authorization(a, t, n)) &&
      typeof v.replayed === 'boolean'
    );
  if (
    !exact(v, [
      'items',
      'tenant',
      'nextCursor',
      'advisory',
      'callingEligible',
    ]) ||
    v.advisory !== true ||
    v.callingEligible !== false ||
    !(v.nextCursor === null || uuid(v.nextCursor)) ||
    !obj(v.tenant) ||
    !exact(v.tenant, ['id', 'status', 'version', 'authorityVersion']) ||
    v.tenant.id !== t.toLowerCase() ||
    !['draft', 'active', 'suspended', 'retired'].includes(
      String(v.tenant.status),
    ) ||
    !ver(v.tenant.version) ||
    !ver(v.tenant.authorityVersion)
  )
    return false;
  return parts[0] === 'selection'
    ? v.items.every(
        (i) =>
          obj(i) &&
          exact(i, ['id', 'name', 'version', 'enabled', 'owner', 'scope']) &&
          uuid(i.id) &&
          typeof i.name === 'string' &&
          i.name.length <= 80 &&
          ver(i.version) &&
          typeof i.enabled === 'boolean' &&
          (i.owner === null || uuid(i.owner)) &&
          [null, 'owned', 'shared'].includes(i.scope as string | null),
      )
    : v.items.every(
        (a) => authorization(a, t, n) && obj(a) && review(a.review),
      );
}
