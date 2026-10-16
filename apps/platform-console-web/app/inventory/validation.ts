import { uuid } from '../pbx/validation';
export { uuid };
type Check = (value: unknown) => boolean;
export const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const text: Check = (v) =>
  typeof v === 'string' &&
  v.length <= 320 &&
  Array.from(v).every((c) => c.charCodeAt(0) >= 32);
const integer: Check = (v) => Number.isSafeInteger(v) && Number(v) >= 0;
const positive: Check = (v) => integer(v) && Number(v) > 0;
const bool: Check = (v) => typeof v === 'boolean';
const literal =
  (...values: unknown[]): Check =>
  (v) =>
    values.includes(v);
const nullable =
  (check: Check): Check =>
  (v) =>
    v === null || check(v);
const array =
  (check: Check, max = 100): Check =>
  (v) =>
    Array.isArray(v) && v.length <= max && v.every(check);
export function shape(
  fields: Record<string, Check>,
  optional: string[] = [],
): Check {
  return (v) =>
    obj(v) &&
    Object.keys(v).every((k) => Object.hasOwn(fields, k)) &&
    Object.entries(fields).every(
      ([k, check]) =>
        (optional.includes(k) && !Object.hasOwn(v, k)) || check(v[k]),
    );
}
const kind = literal('sip', 'webrtc');
const settingsChoice = shape({
  codecs: array(literal('opus', 'ulaw', 'alaw'), 3),
  maxContacts: (v) => positive(v) && Number(v) <= 5,
});
const settings = shape(
  {
    codecs: array(literal('opus', 'ulaw', 'alaw'), 3),
    maxContacts: positive,
    removeExisting: literal(false),
    directMedia: literal(false),
    rtpSymmetric: literal(true),
    forceRport: literal(true),
    signaling: literal('udp', 'wss'),
    mediaEncryption: literal('none', 'dtls-srtp'),
    rewriteContact: bool,
    ice: bool,
    avpf: bool,
    rtcpMux: bool,
    useReceivedTransport: bool,
    dtlsVerify: literal('fingerprint'),
    dtlsSetup: literal('actpass'),
  },
  ['dtlsVerify', 'dtlsSetup'],
);
const profile = shape({
  id: uuid,
  nodeId: uuid,
  kind,
  name: text,
  version: positive,
  headVersion: positive,
  settings,
  capabilityRevision: positive,
  createdAt: text,
  createdBy: uuid,
});
const credential = (v: unknown) =>
  shape({ kind: literal('unset') })(v) ||
  shape({ kind: literal('configured'), generationId: uuid })(v);
const observation = (v: unknown) =>
  shape({ kind: literal('not_available') })(v) ||
  shape({
    kind: literal('observed'),
    nodeVersion: positive,
    desiredVersion: positive,
    epoch: (v) => typeof v === 'string' && /^[0-9]+$/.test(v),
    sequence: integer,
    lastSuccessAt: nullable(text),
    ageMs: nullable(integer),
    freshness: literal('current', 'stale', 'unknown', 'historical'),
    connection: literal('reachable', 'disconnected', 'unknown'),
    reconciliation: literal('complete', 'reconciling'),
    ownership: literal('current', 'absent'),
    failure: nullable(
      literal(
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
      ),
    ),
    coverage: literal('unknown', 'pjsip-dynamic-contacts'),
    registration: literal(
      'registered',
      'unregistered',
      'endpoint_absent',
      'unknown',
    ),
    endpointPresent: nullable(bool),
    contacts: nullable(integer),
    reachableContacts: nullable(integer),
  })(v);
const extension = shape({
  id: uuid,
  nodeId: uuid,
  number: text,
  kind,
  profile: shape({ id: uuid, version: positive }),
  availability: literal('available'),
  administrativeStatus: literal('enabled', 'disabled'),
  credentials: credential,
  readiness: shape({ kind: literal('not_established') }),
  observation,
  eligibility: shape({
    eligible: literal(false),
    reasons: array(literal('unallocated', 'disabled'), 2),
  }),
  version: positive,
  createdAt: text,
  updatedAt: text,
  createdBy: uuid,
  updatedBy: uuid,
});
const dependencies = {
  profileId: uuid,
  profileVersion: positive,
  expectedProfileHead: positive,
  expectedNodeVersion: positive,
  expectedCapabilityRevision: positive,
};
const operation = shape({
  operationId: uuid,
  intentId: uuid,
  nodeId: uuid,
  extensionId: uuid,
  action: literal('setup', 'reset'),
  state: literal(
    'queued',
    'retrying',
    'needs_reconciliation',
    'associated',
    'cancelled',
    'conflict',
    'failed',
  ),
  expectedVersion: positive,
  resultingVersion: nullable(positive),
  generationId: uuid,
  generationOrdinal: positive,
  createdAt: text,
  completedAt: nullable(text),
  retryable: bool,
  failure: nullable(
    literal(
      'provider_unavailable',
      'provider_access_denied',
      'material_invalid',
      'material_unavailable',
      'originator_revoked',
      'stale_version',
      'dependency_changed',
      'needs_reconciliation',
      'cleanup_required',
    ),
  ),
});
const status = shape({
  extensionId: uuid,
  desiredVersion: positive,
  credential: (v) =>
    shape({ kind: literal('unset') })(v) ||
    shape({
      kind: literal('configured'),
      generationId: uuid,
      ordinal: positive,
      materialHealth: literal('verified', 'unknown', 'unavailable'),
      verifiedAt: nullable(text),
      retirement: literal('retained_dependency_unknown'),
    })(v),
  activeOperation: nullable(operation),
  readiness: literal('not_established'),
});
export function route(parts: string[], method: string): boolean {
  const [resource = '', id = '', action = '', extra = ''] = parts;
  if (parts.length === 1)
    return (
      ['extensions', 'endpoint-profiles'].includes(resource) &&
      ['GET', 'POST'].includes(method)
    );
  if (resource === 'extensions') {
    if (parts.length === 2 && ['bulk-preview', 'bulk'].includes(id))
      return method === 'POST';
    if (!uuid(id)) return false;
    if (parts.length === 2) return ['GET', 'PATCH'].includes(method);
    if (parts.length === 3)
      return (
        (action === 'status' && method === 'PATCH') ||
        (action === 'credentials' && method === 'GET')
      );
    return (
      parts.length === 4 &&
      ((action === 'credentials' &&
        ['setup', 'reset'].includes(extra) &&
        method === 'POST') ||
        (action === 'credential-operations' && uuid(extra) && method === 'GET'))
    );
  }
  return (
    resource === 'endpoint-profiles' &&
    uuid(id) &&
    action === 'versions' &&
    ((parts.length === 3 && method === 'POST') ||
      (parts.length === 4 &&
        /^[1-9][0-9]{0,8}$/.test(extra) &&
        method === 'GET'))
  );
}
export function input(parts: string[], method: string, v: unknown) {
  const [resource, id, action] = parts;
  if (resource === 'endpoint-profiles')
    return shape(
      {
        requestId: uuid,
        name: text,
        ...(id
          ? { expectedVersion: positive, settings: settingsChoice }
          : {
              template: literal('sip-basic', 'webrtc-basic'),
              settings: settingsChoice,
            }),
        expectedNodeVersion: positive,
        expectedCapabilityRevision: positive,
      },
      id ? [] : ['settings'],
    )(v);
  if (action === 'credentials')
    return shape({
      operationId: uuid,
      expectedVersion: positive,
      expectedGenerationId: nullable(uuid),
    })(v);
  if (method === 'PATCH')
    return action === 'status'
      ? shape({
          expectedVersion: positive,
          administrativeStatus: literal('enabled', 'disabled'),
        })(v)
      : shape({ expectedVersion: positive, ...dependencies })(v);
  if (!id)
    return shape({ requestId: uuid, number: text, kind, ...dependencies })(v);
  const base = {
    ...dependencies,
    kind,
    ...(id === 'bulk' ? { requestId: uuid } : {}),
  };
  return (
    shape({ ...base, numbers: array(text, 50) })(v) ||
    shape({ ...base, range: shape({ start: text, end: text }) })(v)
  );
}
export function output(parts: string[], method: string, v: unknown) {
  const [resource, id, action] = parts;
  if (action === 'credentials')
    return method === 'GET' ? status(v) : operation(v);
  if (action === 'credential-operations') return operation(v);
  if (resource === 'endpoint-profiles')
    return !id && method === 'GET'
      ? shape({
          items: array(profile),
          nextCursor: nullable(uuid),
          nodeVersion: positive,
          capability: nullable(
            shape({
              installationId: uuid,
              revision: positive,
              kinds: array(kind, 2),
              signaling: array(text, 4),
              codecs: array(literal('opus', 'ulaw', 'alaw'), 3),
              media: array(text, 4),
            }),
          ),
        })(v)
      : shape({ profile })(v);
  if (id === 'bulk-preview')
    return shape({
      ...dependencies,
      nodeId: uuid,
      kind,
      numbers: array(text),
      advisory: literal(true),
    })(v);
  if (id === 'bulk')
    return shape({
      operationId: uuid,
      nodeId: uuid,
      profileId: uuid,
      profileVersion: positive,
      items: array(shape({ id: uuid, number: text, version: positive })),
    })(v);
  return !id && method === 'GET'
    ? shape({ items: array(extension), nextCursor: nullable(uuid) })(v)
    : shape({ extension })(v);
}
