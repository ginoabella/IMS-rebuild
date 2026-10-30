import { uuid, obj } from '../routing/validation';
export { uuid, obj };
const exact = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).every((k) => keys.includes(k));
const ver = (v: unknown) =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 2147483647;
const num = (v: unknown) =>
  typeof v === 'string' &&
  v.length <= 32 &&
  /^[1-9][0-9]{3,5}$/.test(v.replace(/^ +| +$/g, '')) &&
  Number(v) <= 899999;
export function allocationRoute(parts: string[], method: string) {
  return method === 'GET'
    ? parts.length === 0 ||
        (parts.length === 1 && (parts[0] === 'stock' || uuid(parts[0])))
    : method === 'POST' &&
        (parts.length === 0 ||
          (parts.length === 1 && parts[0] === 'preview') ||
          (parts.length === 2 &&
            uuid(parts[0]) &&
            ['promote', 'release'].includes(parts[1]!)));
}
export function allocationInput(parts: string[], v: unknown) {
  if (!obj(v)) return false;
  if (parts[0] === 'preview') {
    if (!exact(v, ['selection']) || !obj(v.selection)) return false;
    const s = v.selection;
    if (Array.isArray(s.extensionIds) && s.range === undefined)
      return (
        exact(s, ['extensionIds']) &&
        s.extensionIds.length >= 1 &&
        s.extensionIds.length <= 50 &&
        s.extensionIds.every(uuid) &&
        new Set(s.extensionIds.map((v) => v.toLowerCase())).size ===
          s.extensionIds.length
      );
    return (
      exact(s, ['range']) &&
      obj(s.range) &&
      exact(s.range, ['start', 'end']) &&
      num(s.range.start) &&
      num(s.range.end) &&
      Number(s.range.end) >= Number(s.range.start) &&
      Number(s.range.end) - Number(s.range.start) < 50
    );
  }
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
      'expectedTenantVersion',
      'expectedAuthorityVersion',
      'state',
      'items',
    ]) &&
    ['reserved', 'allocated'].includes(String(v.state)) &&
    Array.isArray(v.items) &&
    v.items.length >= 1 &&
    v.items.length <= 50 &&
    v.items.every(
      (i) =>
        obj(i) &&
        exact(i, ['extensionId', 'expectedVersion']) &&
        uuid(i.extensionId) &&
        ver(i.expectedVersion),
    ) &&
    new Set(v.items.map((i) => i.extensionId.toLowerCase())).size ===
      v.items.length
  );
}
export function claim(v: unknown): boolean {
  return (
    obj(v) &&
    exact(v, [
      'id',
      'tenantId',
      'nodeId',
      'installationId',
      'extensionId',
      'state',
      'version',
      'createdAt',
      'updatedAt',
      'createdBy',
      'updatedBy',
    ]) &&
    [
      'id',
      'tenantId',
      'nodeId',
      'installationId',
      'extensionId',
      'createdBy',
      'updatedBy',
    ].every((k) => uuid(v[k])) &&
    ['reserved', 'allocated', 'released'].includes(String(v.state)) &&
    ver(v.version) &&
    ['createdAt', 'updatedAt'].every(
      (k) =>
        typeof v[k] === 'string' && Number.isFinite(Date.parse(v[k] as string)),
    )
  );
}
function tenant(v: unknown) {
  return (
    obj(v) &&
    exact(v, ['id', 'status', 'version', 'authorityVersion']) &&
    uuid(v.id) &&
    ['draft', 'active', 'suspended', 'retired'].includes(String(v.status)) &&
    ver(v.version) &&
    ver(v.authorityVersion)
  );
}
function stock(v: unknown) {
  return (
    obj(v) &&
    exact(v, [
      'id',
      'number',
      'kind',
      'version',
      'administrativeStatus',
      'claim',
      'credentialPending',
      'assignment',
      'verification',
      'missing',
    ]) &&
    uuid(v.id) &&
    num(v.number) &&
    ['sip', 'webrtc'].includes(String(v.kind)) &&
    ver(v.version) &&
    ['enabled', 'disabled'].includes(String(v.administrativeStatus)) &&
    (v.claim === null || claim(v.claim)) &&
    typeof v.credentialPending === 'boolean' &&
    v.assignment === 'none' &&
    v.verification === 'not_established'
  );
}
export function allocationOutput(
  parts: string[],
  method: string,
  v: unknown,
): boolean {
  if (!obj(v) || !Array.isArray(v.items) || v.items.length > 100) return false;
  if (method === 'POST' && parts[0] !== 'preview')
    return (
      exact(v, ['items', 'replayed']) &&
      v.items.length <= 50 &&
      v.items.every(claim) &&
      typeof v.replayed === 'boolean'
    );
  if (!tenant(v.tenant)) return false;
  if (parts[0] === 'preview')
    return (
      exact(v, ['items', 'canSave', 'tenant']) &&
      v.items.length <= 50 &&
      typeof v.canSave === 'boolean' &&
      v.items.every(
        (i) =>
          obj(i) &&
          (i.missing === true
            ? exact(i, ['number', 'missing']) && num(i.number)
            : i.missing === false && stock(i)),
      )
    );
  if (
    !exact(v, [
      'items',
      'nextCursor',
      'tenant',
      ...(parts[0] === 'stock' ? [] : ['capacity']),
    ])
  )
    return false;
  if (v.nextCursor !== null && !uuid(v.nextCursor)) return false;
  if (parts[0] === 'stock') return v.items.every(stock);
  return (
    obj(v.capacity) &&
    exact(v.capacity, ['available', 'reserved', 'allocated', 'disabled']) &&
    Object.values(v.capacity).every(
      (n) => typeof n === 'number' && Number.isInteger(n) && n >= 0,
    ) &&
    v.items.every((i) => {
      if (!obj(i)) return false;
      const { stock: s, blockers, ...c } = i;
      return (
        claim(c) &&
        stock(s) &&
        Array.isArray(blockers) &&
        blockers.length <= 10 &&
        blockers.every(
          (b) =>
            obj(b) &&
            exact(b, ['id', 'name']) &&
            uuid(b.id) &&
            typeof b.name === 'string' &&
            b.name.length <= 320,
        )
      );
    })
  );
}

/** A valid DTO must also belong to this request's canonical target. */
export function allocationTarget(
  v: unknown,
  tenantId: string,
  nodeId: string,
  parts: string[],
  method: string,
) {
  if (!obj(v) || !Array.isArray(v.items)) return false;
  const t = tenantId.toLowerCase(),
    n = nodeId.toLowerCase();
  if ('tenant' in v && (!obj(v.tenant) || v.tenant.id !== t)) return false;
  if (
    (method === 'POST' && parts[0] !== 'preview') ||
    (method === 'GET' && parts[0] !== 'stock')
  )
    return v.items.every(
      (c) =>
        obj(c) &&
        c.tenantId === t &&
        c.nodeId === n &&
        (!uuid(parts[0]) || c.id === parts[0]!.toLowerCase()),
    );
  return v.items.every(
    (e) =>
      obj(e) &&
      (e.claim === null ||
        e.missing === true ||
        (obj(e.claim) && e.claim.nodeId === n)),
  );
}
