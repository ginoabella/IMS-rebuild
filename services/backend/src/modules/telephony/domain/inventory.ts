import type {
  AudioCodec,
  EndpointCapabilityDto,
  EndpointKind,
  EndpointSettings,
  InventoryApiErrorDto,
  InventoryConflict,
  InventoryDependencies,
} from '@myims/contracts';
import { onlyFields, uuid } from '../../identity/domain/storage';
export type InventoryFailure =
  | {
      kind: 'invalid';
      fieldErrors: NonNullable<InventoryApiErrorDto['fieldErrors']>;
    }
  | { kind: 'denied' | 'unavailable' | 'missing' }
  | {
      kind: 'conflict';
      reason: InventoryConflict;
      conflicts?: NonNullable<InventoryApiErrorDto['conflicts']>;
    };
export class InventoryRejected extends Error {
  constructor(readonly outcome: InventoryFailure) {
    super('Inventory operation rejected');
  }
}
export function invalid(
  field: keyof NonNullable<InventoryApiErrorDto['fieldErrors']>,
): never {
  throw new InventoryRejected({
    kind: 'invalid',
    fieldErrors: { [field]: 'Invalid inventory field' },
  });
}
export function conflict(reason: InventoryConflict): never {
  throw new InventoryRejected({ kind: 'conflict', reason });
}
export function object(
  input: unknown,
  keys: string[],
): Record<string, unknown> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    !onlyFields(input, keys)
  )
    invalid('body');
  return input as Record<string, unknown>;
}
export function id(
  input: unknown,
  field: 'nodeId' | 'profileId' | 'extensionId' | 'requestId' | 'after',
): string {
  if (!uuid(input)) invalid(field);
  return input.toLowerCase();
}
export function version(
  input: unknown,
  field: 'version' | 'expectedVersion' | 'dependencies' = 'dependencies',
): number {
  if (
    typeof input !== 'number' ||
    !Number.isSafeInteger(input) ||
    input < 1 ||
    input > 2147483647
  )
    invalid(field);
  return input;
}
export function number(input: unknown): string {
  if (typeof input !== 'string' || input.length > 32) invalid('number');
  const canonical = input.replace(/^ +| +$/g, '');
  if (!/^[1-9][0-9]{3,5}$/.test(canonical) || Number(canonical) > 899999)
    invalid('number');
  return canonical;
}
export function endpointKind(input: unknown): EndpointKind {
  if (input !== 'sip' && input !== 'webrtc') invalid('kind');
  return input;
}
export function name(input: unknown): string {
  if (typeof input !== 'string' || input.length > 320) invalid('name');
  // Reject controls before trimming, including malformed UTF-16.
  // eslint-disable-next-line no-control-regex -- allowlisted profile labels exclude controls.
  if (/[\u0000-\u001f\u007f-\u009f]/u.test(input)) invalid('name');
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = input.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) invalid('name');
    } else if (code >= 0xdc00 && code <= 0xdfff) invalid('name');
  }
  const result = input.trim();
  if (!result || result.length > 80) invalid('name');
  return result;
}
export function settings(
  kind: EndpointKind,
  input?: unknown,
): EndpointSettings {
  const allowed: AudioCodec[] =
    kind === 'sip' ? ['ulaw', 'alaw'] : ['opus', 'ulaw', 'alaw'];
  const choice =
    input === undefined
      ? { codecs: allowed, maxContacts: kind === 'sip' ? 1 : 5 }
      : object(input, ['codecs', 'maxContacts']);
  if (
    !Array.isArray(choice.codecs) ||
    choice.codecs.length < 1 ||
    choice.codecs.length > allowed.length ||
    new Set(choice.codecs).size !== choice.codecs.length ||
    choice.codecs.some((c) => !allowed.includes(c)) ||
    typeof choice.maxContacts !== 'number' ||
    !Number.isInteger(choice.maxContacts) ||
    choice.maxContacts < 1 ||
    choice.maxContacts > 5
  )
    invalid('settings');
  const common = {
    codecs: choice.codecs as AudioCodec[],
    maxContacts: choice.maxContacts,
    removeExisting: false,
    directMedia: false,
    rtpSymmetric: true,
    forceRport: true,
  } as const;
  return kind === 'sip'
    ? {
        ...common,
        signaling: 'udp',
        mediaEncryption: 'none',
        rewriteContact: true,
        ice: false,
        avpf: false,
        rtcpMux: false,
        useReceivedTransport: false,
      }
    : {
        ...common,
        signaling: 'wss',
        mediaEncryption: 'dtls-srtp',
        rewriteContact: false,
        ice: true,
        avpf: true,
        rtcpMux: true,
        useReceivedTransport: true,
        dtlsVerify: 'fingerprint',
        dtlsSetup: 'actpass',
      };
}
export const dependencyKeys = [
  'profileId',
  'profileVersion',
  'expectedProfileHead',
  'expectedNodeVersion',
  'expectedCapabilityRevision',
];
export function dependencies(
  data: Record<string, unknown>,
): InventoryDependencies {
  return {
    profileId: id(data.profileId, 'profileId'),
    profileVersion: version(data.profileVersion),
    expectedProfileHead: version(data.expectedProfileHead),
    expectedNodeVersion: version(data.expectedNodeVersion),
    expectedCapabilityRevision: version(data.expectedCapabilityRevision),
  };
}
export function numbers(
  data: Record<string, unknown>,
  single: boolean,
): string[] {
  if (single) return [number(data.number)];
  let result: string[];
  if (data.numbers !== undefined && data.range === undefined) {
    if (
      !Array.isArray(data.numbers) ||
      data.numbers.length < 1 ||
      data.numbers.length > 50
    )
      invalid('numbers');
    result = data.numbers.map(number);
  } else if (data.range !== undefined && data.numbers === undefined) {
    const range = object(data.range, ['start', 'end']);
    const start = Number(number(range.start)),
      end = Number(number(range.end));
    if (end < start || end - start >= 50) invalid('numbers');
    result = Array.from({ length: end - start + 1 }, (_, i) =>
      String(start + i),
    );
  } else invalid('numbers');
  if (new Set(result).size !== result.length) invalid('numbers');
  return result.sort((a, b) => Number(a) - Number(b));
}
export type EndpointCapability = EndpointCapabilityDto;
export function compatible(
  capability: EndpointCapability | null,
  kind: EndpointKind,
  profile: EndpointSettings,
  expected: number,
) {
  if (!capability) throw new InventoryRejected({ kind: 'unavailable' });
  if (capability.revision !== expected) conflict('dependency_changed');
  if (
    !capability.kinds.includes(kind) ||
    !capability.signaling.includes(profile.signaling) ||
    !capability.media.includes(profile.mediaEncryption) ||
    profile.codecs.some((c) => !capability.codecs.includes(c))
  )
    invalid('settings');
}
/** Availability never establishes tenant/staff calling eligibility. Runtime registration is deliberately not an input. */
export function inventoryEligibility(status: 'enabled' | 'disabled'): {
  eligible: false;
  reasons: ('unallocated' | 'disabled')[];
} {
  return {
    eligible: false,
    reasons:
      status === 'disabled' ? ['unallocated', 'disabled'] : ['unallocated'],
  };
}
export function page(input: unknown) {
  const data = object(input, ['limit', 'after']);
  const limit =
    data.limit === undefined
      ? 25
      : typeof data.limit === 'string' && /^[1-9][0-9]{0,2}$/.test(data.limit)
        ? Number(data.limit)
        : 0;
  if (limit < 1 || limit > 100) invalid('limit');
  return {
    limit,
    after: data.after === undefined ? null : id(data.after, 'after'),
  };
}
