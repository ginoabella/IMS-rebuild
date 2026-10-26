import type {
  EndpointSettings,
  GroupValues,
  InboundValues,
  OutboundValues,
  ReservationValues,
  TrunkValues,
  GatewayValues,
  DidValues,
  RevisionResourceKind,
} from '@myims/contracts';
interface Source {
  id: string;
  version: number;
}
export interface RevisionSnapshot {
  eligibility: {
    allocations: 'unavailable';
    bindings: 'unavailable';
    sharedTrunkPermissions: 'unavailable';
  };
  node: Source & { installationId: string };
  capability:
    | (Source & {
        kinds: string[];
        signaling: string[];
        codecs: string[];
        media: string[];
      })
    | null;
  profiles: (Source & {
    name: string;
    kind: 'sip' | 'webrtc';
    settings: EndpointSettings;
    capabilityRevision: number;
  })[];
  extensions: (Source & {
    number: string;
    kind: 'sip' | 'webrtc';
    profileId: string;
    profileVersion: number;
    administrativeStatus: string;
    generationId: string | null;
    endpointKey: string;
    authKey: string;
    aorKey: string;
  })[];
  trunks: (Source & TrunkValues & { enabled: boolean })[];
  gateways: (Source & GatewayValues & { enabled: boolean })[];
  dids: (Source & DidValues & { enabled: boolean })[];
  groups: (Source & GroupValues & { enabled: boolean })[];
  reservations: (Source & ReservationValues)[];
  inbound: (Source &
    InboundValues & { enabled: boolean; identity: Record<string, string> })[];
  outbound: (Source &
    OutboundValues & { enabled: boolean; identity: Record<string, string> })[];
  credentials: (Source & { available: boolean; purpose: string })[];
}
export const COMPILER_VERSION = 'review-2';
export const POLICY_VERSION = 'deny-unbound-1';
export const SNAPSHOT_LIMIT = 2048;
export type SourceEntry = {
  kind: RevisionResourceKind;
  key: string;
  value: Source & object;
};
export function entries(s: RevisionSnapshot): SourceEntry[] {
  const list: SourceEntry[] = [{ kind: 'node', key: s.node.id, value: s.node }];
  if (s.capability)
    list.push({
      kind: 'capability',
      key: s.capability.id,
      value: s.capability,
    });
  for (const kind of [
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
  ] as const)
    for (const value of s[kind])
      list.push({
        kind,
        key:
          kind === 'profiles' || kind === 'credentials'
            ? `${value.id}:${value.version}`
            : value.id,
        value,
      });
  return list.sort((a, b) =>
    `${a.kind}:${a.key}`.localeCompare(`${b.kind}:${b.key}`, 'en'),
  );
}
/** Stable object-key ordering; array order is semantic (members and codec preferences). */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
