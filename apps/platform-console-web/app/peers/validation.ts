import { obj, shape, uuid } from '../inventory/validation';
export { obj, uuid };
const text = (v: unknown) => typeof v === 'string' && v.length <= 320;
const positive = (v: unknown) =>
  Number.isInteger(v) && Number(v) > 0 && Number(v) <= 2147483647;
const nullable = (check: (v: unknown) => boolean) => (v: unknown) =>
  v === null || check(v);
const literal =
  (...v: unknown[]) =>
  (x: unknown) =>
    v.includes(x);
const array = (check: (v: unknown) => boolean, max: number) => (v: unknown) =>
  Array.isArray(v) && v.length <= max && v.every(check);
const credential = shape({ id: uuid, version: positive });
const registration = shape({
  registrar: text,
  realm: text,
  expiration: literal(3600),
  retryInterval: literal(60),
  forbiddenRetryInterval: literal(10),
});
const settings = shape(
  {
    host: text,
    port: (v) => positive(v) && Number(v) <= 65535,
    transport: literal('udp'),
    media: literal('rtp'),
    codecs: array(literal('ulaw', 'alaw'), 2),
    directMedia: literal(false),
    rtpSymmetric: literal(true),
    forceRport: literal(true),
    authentication: literal('ip-peer', 'outbound-digest'),
    credential,
    registration,
  },
  ['credential', 'registration'],
);
const common = {
  id: uuid,
  nodeId: uuid,
  installationId: uuid,
  name: text,
  enabled: (v: unknown) => typeof v === 'boolean',
  version: positive,
  createdAt: text,
  updatedAt: text,
  createdBy: uuid,
  updatedBy: uuid,
  removedAt: nullable(text),
  credentialStatus: literal('not_required', 'selected'),
};
const trunk = shape({
  ...common,
  direction: literal('inbound', 'outbound', 'both'),
  settings,
});
const gateway = shape({
  ...common,
  kind: literal('sip-provider', 'sip-device'),
  trunkId: nullable(uuid),
  sourceAddresses: array(text, 32),
});
export function route(parts: string[], method: string) {
  return (
    parts[0] === 'peers' &&
    ['trunks', 'gateways'].includes(parts[1] ?? '') &&
    ((parts.length === 4 &&
      parts[1] === 'trunks' &&
      parts[2] === 'credentials' &&
      parts[3] === 'selections' &&
      method === 'GET') ||
      (parts.length === 2 && ['GET', 'POST'].includes(method)) ||
      (parts.length === 3 &&
        uuid(parts[2]) &&
        ['GET', 'PATCH'].includes(method)) ||
      (parts.length === 4 &&
        uuid(parts[2]) &&
        ((parts[3] === 'status' && method === 'PATCH') ||
          (parts[3] === 'remove' && method === 'POST'))))
  );
}
export function input(parts: string[], method: string, v: unknown) {
  if (!obj(v)) return false;
  const fields =
    parts[1] === 'trunks'
      ? ['name', 'direction', 'settings']
      : ['name', 'kind', 'trunkId', 'sourceAddresses'];
  const keys =
    parts[3] === 'remove'
      ? ['expectedVersion']
      : parts[3] === 'status'
        ? ['expectedVersion', 'enabled']
        : parts.length === 2
          ? ['requestId', ...fields]
          : ['expectedVersion', ...fields];
  if (Object.keys(v).some((k) => !keys.includes(k))) return false;
  // Keep invalid safe values available for actionable backend validation.
  return (
    !('settings' in v) ||
    shape(
      {
        host: text,
        port: (x) => typeof x === 'number',
        transport: text,
        media: text,
        codecs: array(text, 2),
        directMedia: (x) => typeof x === 'boolean',
        rtpSymmetric: (x) => typeof x === 'boolean',
        forceRport: (x) => typeof x === 'boolean',
        authentication: text,
        credential,
        registration,
      },
      ['credential', 'registration'],
    )(v.settings)
  );
}
export function output(parts: string[], method: string, v: unknown) {
  if (parts[2] === 'credentials')
    return shape({
      items: array(
        shape({
          id: uuid,
          label: text,
          installationId: uuid,
          purpose: literal('outbound-digest'),
          version: positive,
          available: literal(true, false),
        }),
        100,
      ),
      nextCursor: nullable(text),
    })(v);
  const resource = parts[1] === 'trunks' ? trunk : gateway;
  return parts.length === 2 && method === 'GET'
    ? shape({ items: array(resource, 100), nextCursor: nullable(uuid) })(v)
    : shape({ resource })(v);
}
