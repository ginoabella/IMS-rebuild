import type {
  PbxNodeDto,
  PbxObservationDto,
  CreatePbxNodeRequest,
  EditPbxNodeRequest,
} from '@myims/contracts';
export const uuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const alias = (v: unknown): v is string =>
  typeof v === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(v);
const integer = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const date = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= 32 && Number.isFinite(Date.parse(v));
function keys(v: unknown, allowed: string[]): v is Record<string, unknown> {
  return (
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.keys(v).every((k) => allowed.includes(k))
  );
}
export const conflicts = [
  'target_conflict',
  'request_conflict',
  'stale_version',
  'intent_expired',
] as const;
export const inputFields = [
  'body',
  'requestId',
  'displayName',
  'management',
  'credentialAlias',
  'expectedVersion',
  'nodeId',
  'limit',
  'after',
] as const;
export const failures = [
  'secret_missing',
  'secret_unavailable',
  'destination_denied',
  'resolution_unavailable',
  'connect_failed',
  'auth_failed',
  'timeout',
  'protocol_failed',
  'snapshot_incomplete',
  'resource_limit',
  'disconnected',
  'ownership_lost',
] as const;
export function observation(v: unknown): v is PbxObservationDto {
  if (keys(v, ['kind']) && v.kind === 'not_available') return true;
  if (
    !keys(v, [
      'kind',
      'desiredVersion',
      'epoch',
      'sequence',
      'lastSuccessAt',
      'ageMs',
      'freshness',
      'connection',
      'reconciliation',
      'ownership',
      'failure',
      'coverage',
      'registrations',
      'registeredEndpoints',
    ])
  )
    return false;
  return (
    v.kind === 'observed' &&
    integer(v.desiredVersion) &&
    v.desiredVersion > 0 &&
    typeof v.epoch === 'string' &&
    /^[0-9]{1,20}$/.test(v.epoch) &&
    integer(v.sequence) &&
    (v.lastSuccessAt === null || date(v.lastSuccessAt)) &&
    (v.ageMs === null || integer(v.ageMs)) &&
    ['current', 'stale', 'unknown', 'historical'].includes(
      String(v.freshness),
    ) &&
    ['reachable', 'disconnected', 'unknown'].includes(String(v.connection)) &&
    ['complete', 'reconciling'].includes(String(v.reconciliation)) &&
    ['current', 'absent'].includes(String(v.ownership)) &&
    (v.failure === null || failures.some((f) => f === v.failure)) &&
    ['pjsip-dynamic-contacts', 'unknown'].includes(String(v.coverage)) &&
    (v.registeredEndpoints === null || integer(v.registeredEndpoints)) &&
    Array.isArray(v.registrations) &&
    v.registrations.length <= 1000 &&
    v.registrations.every(
      (f) =>
        keys(f, ['endpoint', 'registered', 'contacts', 'reachableContacts']) &&
        typeof f.endpoint === 'string' &&
        /^[A-Za-z0-9_.:@+-]{1,128}$/.test(f.endpoint) &&
        typeof f.registered === 'boolean' &&
        integer(f.contacts) &&
        f.contacts <= 4000 &&
        integer(f.reachableContacts) &&
        f.reachableContacts <= f.contacts,
    )
  );
}
export function node(v: unknown): v is PbxNodeDto {
  if (
    !keys(v, [
      'id',
      'installationId',
      'displayName',
      'management',
      'credentialAlias',
      'version',
      'createdAt',
      'updatedAt',
      'createdBy',
      'updatedBy',
      'observation',
    ])
  )
    return false;
  const m = v.management;
  return (
    uuid(v.id) &&
    uuid(v.installationId) &&
    typeof v.displayName === 'string' &&
    v.displayName.length > 0 &&
    v.displayName.length <= 200 &&
    alias(v.credentialAlias) &&
    integer(v.version) &&
    v.version > 0 &&
    date(v.createdAt) &&
    date(v.updatedAt) &&
    uuid(v.createdBy) &&
    uuid(v.updatedBy) &&
    keys(m, ['targetAlias', 'transport', 'port', 'host', 'tlsServerName']) &&
    alias(m.targetAlias) &&
    typeof m.transport === 'string' &&
    /^[a-z0-9-]{1,64}$/.test(m.transport) &&
    integer(m.port) &&
    m.port > 0 &&
    m.port <= 65535 &&
    typeof m.host === 'string' &&
    /^[A-Za-z0-9.:-]{1,253}$/.test(m.host) &&
    typeof m.tlsServerName === 'string' &&
    /^[A-Za-z0-9.-]{1,253}$/.test(m.tlsServerName) &&
    observation(v.observation)
  );
}
export function detail(v: unknown): v is { node: PbxNodeDto } {
  return keys(v, ['node']) && node(v.node);
}
export function list(
  v: unknown,
  limit: number,
): v is { items: PbxNodeDto[]; nextCursor: string | null } {
  return (
    keys(v, ['items', 'nextCursor']) &&
    Array.isArray(v.items) &&
    v.items.length <= limit &&
    v.items.every(node) &&
    (v.nextCursor === null || uuid(v.nextCursor))
  );
}
export function write(
  v: unknown,
  edit: boolean,
): v is CreatePbxNodeRequest | EditPbxNodeRequest {
  if (
    !keys(v, [
      edit ? 'expectedVersion' : 'requestId',
      'displayName',
      'management',
      'credentialAlias',
    ])
  )
    return false;
  const m = v.management;
  return (
    (edit
      ? integer(v.expectedVersion) && v.expectedVersion > 0
      : uuid(v.requestId)) &&
    typeof v.displayName === 'string' &&
    v.displayName.length <= 800 &&
    v.displayName.trim().length > 0 &&
    v.displayName.trim().length <= 200 &&
    keys(m, ['targetAlias', 'transport', 'port']) &&
    typeof m.targetAlias === 'string' &&
    m.targetAlias.length <= 128 &&
    alias(m.targetAlias.trim().toLowerCase()) &&
    typeof m.transport === 'string' &&
    /^[a-z0-9-]{1,64}$/.test(m.transport) &&
    integer(m.port) &&
    m.port > 0 &&
    m.port <= 65535 &&
    typeof v.credentialAlias === 'string' &&
    v.credentialAlias.length <= 128 &&
    alias(v.credentialAlias.trim().toLowerCase())
  );
}
