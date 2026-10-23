import { isIP } from 'node:net';
import type {
  DidValues,
  GatewayValues,
  PeerConflict,
  PeerSettings,
  TrunkValues,
} from '@myims/contracts';
import { uuid } from '../../identity/domain/storage';
export class PeerRejected extends Error {
  constructor(
    readonly status: number,
    readonly reason?: PeerConflict,
    readonly fieldErrors?: Record<string, string>,
    readonly blockers?: { id: string; name: string }[],
  ) {
    super('Peer request rejected');
  }
}
export function invalid(field: string, message = 'Review this field.'): never {
  throw new PeerRejected(400, undefined, { [field]: message });
}
export function object(
  value: unknown,
  keys: string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k))
  )
    invalid('body');
  return value as Record<string, unknown>;
}
export function id(value: unknown, field = 'id'): string {
  if (!uuid(value)) invalid(field);
  return value.toLowerCase();
}
export function version(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value >= 2147483647
  )
    invalid('expectedVersion');
  return value;
}
export function label(value: unknown): string {
  if (
    typeof value !== 'string' ||
    /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/u.test(
      value,
    )
  )
    invalid('name');
  // eslint-disable-next-line no-control-regex -- labels reject control characters before trimming.
  if (/[\u0000-\u001f\u007f-\u009f]/u.test(value)) invalid('name');
  const name = value.trim();
  if (!name || [...name].length > 80) invalid('name');
  return name;
}
export function address(value: unknown): string {
  if (typeof value !== 'string' || !isIP(value) || value.includes('%'))
    invalid('sourceAddresses', 'Enter exact IPv4 or IPv6 host addresses.');
  // WHATWG canonicalization also collapses IPv4-mapped IPv6 into one IPv4 identity.
  let canonical =
    isIP(value) === 6
      ? new URL(`http://[${value}]/`).hostname.slice(1, -1)
      : value;
  const mapped = /^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/.exec(canonical);
  if (mapped) {
    const n = parseInt(mapped[1]!, 16) * 65536 + parseInt(mapped[2]!, 16);
    canonical = [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(
      '.',
    );
  }
  return canonical;
}
export function settings(value: unknown): PeerSettings {
  const s = object(value, [
    'host',
    'port',
    'transport',
    'media',
    'codecs',
    'directMedia',
    'rtpSymmetric',
    'forceRport',
    'authentication',
    'credential',
    'registration',
  ]);
  if (typeof s.host !== 'string' || s.host.length > 253) invalid('settings');
  let host = s.host.toLowerCase();
  if (isIP(host)) {
    if (host.includes('%')) invalid('settings');
    host = address(host);
  } else if (
    !host
      .split('.')
      .every((part) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part)) ||
    /^[0-9.]+$/.test(host)
  )
    invalid(
      'settings',
      'Enter a host or IP, without a URL or configuration text.',
    );
  if (
    typeof s.port !== 'number' ||
    !Number.isInteger(s.port) ||
    s.port < 1 ||
    s.port > 65535 ||
    s.transport !== 'udp' ||
    s.media !== 'rtp' ||
    s.directMedia !== false ||
    s.rtpSymmetric !== true ||
    s.forceRport !== true ||
    !['ip-peer', 'outbound-digest'].includes(String(s.authentication)) ||
    !Array.isArray(s.codecs) ||
    !s.codecs.length ||
    s.codecs.length > 2 ||
    new Set(s.codecs).size !== s.codecs.length ||
    s.codecs.some((c) => c !== 'ulaw' && c !== 'alaw')
  )
    invalid('settings', 'Use UDP/RTP and ulaw and/or alaw.');
  let credential: PeerSettings['credential'];
  let registration: PeerSettings['registration'];
  if (s.authentication === 'ip-peer') {
    if (s.credential !== undefined || s.registration !== undefined)
      invalid('settings', 'IP-peer requires no credential or registration.');
  } else {
    const c = object(s.credential, ['id', 'version']);
    credential = { id: id(c.id, 'settings'), version: version(c.version) };
    if (s.registration !== undefined) {
      const r = object(s.registration, [
        'registrar',
        'realm',
        'expiration',
        'retryInterval',
        'forbiddenRetryInterval',
      ]);
      // Reuse the typed host validator; no URLs, probes or arbitrary SIP text.
      const registrar = settings({
        ...s,
        authentication: 'ip-peer',
        credential: undefined,
        registration: undefined,
        host: r.registrar,
      }).host;
      if (
        typeof r.realm !== 'string' ||
        !/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?$/.test(r.realm) ||
        r.expiration !== 3600 ||
        r.retryInterval !== 60 ||
        r.forbiddenRetryInterval !== 10
      )
        invalid(
          'settings',
          'Registration requires an explicit registrar/realm and 3600/60/10 timers.',
        );
      registration = {
        registrar,
        realm: r.realm,
        expiration: 3600,
        retryInterval: 60,
        forbiddenRetryInterval: 10,
      };
    }
  }
  return {
    host,
    port: s.port,
    transport: 'udp',
    media: 'rtp',
    codecs: [...s.codecs].sort(),
    directMedia: false,
    rtpSymmetric: true,
    forceRport: true,
    authentication: s.authentication as PeerSettings['authentication'],
    ...(credential ? { credential } : {}),
    ...(registration ? { registration } : {}),
  };
}
export function values(
  kind: 'trunks' | 'gateways' | 'dids',
  data: Record<string, unknown>,
): TrunkValues | GatewayValues | DidValues {
  const name = label(data.name);
  if (kind === 'trunks') {
    if (
      data.direction !== 'inbound' &&
      data.direction !== 'outbound' &&
      data.direction !== 'both'
    )
      invalid('direction');
    const connection = settings(data.settings);
    if (data.direction === 'inbound' && connection.authentication !== 'ip-peer')
      invalid(
        'settings',
        'Outbound digest requires outbound or both direction.',
      );
    return { name, direction: data.direction, settings: connection };
  }
  if (kind === 'dids')
    return {
      name,
      number: didNumber(data.number),
      gatewayId: id(data.gatewayId, 'gatewayId'),
    };
  if (data.kind !== 'sip-provider' && data.kind !== 'sip-device')
    invalid('kind');
  const trunkId = data.trunkId === null ? null : id(data.trunkId, 'trunkId');
  if (data.kind === 'sip-provider' && !trunkId)
    invalid('trunkId', 'Provider gateways require an inbound-capable trunk.');
  if (
    !Array.isArray(data.sourceAddresses) ||
    !data.sourceAddresses.length ||
    data.sourceAddresses.length > 32
  )
    invalid('sourceAddresses');
  const sources = data.sourceAddresses.map(address).sort();
  if (new Set(sources).size !== sources.length)
    invalid('sourceAddresses', 'Duplicate source address.');
  return { name, kind: data.kind, trunkId, sourceAddresses: sources };
}

// Gateway ingress references depend on connection settings and direction.
// Outbound auth/version/registration edits do not alter that ingress identity.
export function peerConnection(s: PeerSettings): string {
  return JSON.stringify([
    s.host,
    s.port,
    s.transport,
    s.media,
    s.codecs,
    s.directMedia,
    s.rtpSymmetric,
    s.forceRport,
  ]);
}

export function didNumber(value: unknown): string {
  if (typeof value !== 'string' || value.length > 320) invalid('number');
  const number = value.trim().replace(/[ ()-]/g, '');
  if (!/^\+?[0-9]{1,15}$/.test(number))
    invalid(
      'number',
      'Enter 1–15 ASCII digits with an optional leading +. Spaces, hyphens and parentheses are removed.',
    );
  return number;
}
