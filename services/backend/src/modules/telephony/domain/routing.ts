import type {
  InboundValues,
  OutboundValues,
  GroupValues,
  NumberPattern,
  ReservationValues,
  RoutingKind,
  GroupDto,
} from '@myims/contracts';
import { id, invalid, label, object, PeerRejected } from './peer';
export { id, invalid, object, version } from './peer';
export class RoutingRejected extends Error {
  constructor(
    readonly reason: string,
    readonly blockers?: {
      id: string;
      name: string;
      kind?: 'groups' | 'inbound' | 'outbound';
    }[],
  ) {
    super(reason);
  }
}
export function pattern(value: unknown): NumberPattern {
  const p = object(value, ['kind', 'digits', 'minLength', 'maxLength']);
  if (
    (p.kind !== 'exact' && p.kind !== 'prefix') ||
    typeof p.digits !== 'string' ||
    p.digits.length < 1 ||
    p.digits.length > 15 ||
    /[^0-9]/.test(p.digits) ||
    typeof p.minLength !== 'number' ||
    typeof p.maxLength !== 'number' ||
    !Number.isInteger(p.minLength) ||
    !Number.isInteger(p.maxLength) ||
    p.minLength < p.digits.length ||
    p.maxLength < p.minLength ||
    p.maxLength > 15 ||
    (p.kind === 'exact' &&
      (p.minLength !== p.digits.length || p.maxLength !== p.digits.length))
  )
    invalid(
      'pattern',
      'Use exact ASCII digits or a digit prefix with total lengths 1–15.',
    );
  return {
    kind: p.kind,
    digits: p.digits,
    minLength: p.minLength,
    maxLength: p.maxLength,
  };
}
export function intersects(a: NumberPattern, b: NumberPattern): boolean {
  return (
    Math.max(a.minLength, b.minLength) <= Math.min(a.maxLength, b.maxLength) &&
    (a.digits.startsWith(b.digits) || b.digits.startsWith(a.digits))
  );
}
export function groupValues(data: Record<string, unknown>): GroupValues {
  const name = label(data.name);
  let number: string | null = null;
  if (data.number !== undefined && data.number !== null) {
    if (
      typeof data.number !== 'string' ||
      !/^[1-9][0-9]{3,5}$/.test(data.number) ||
      Number(data.number) > 899999
    )
      invalid('number', 'Use a canonical number 1000–899999, or leave empty.');
    number = data.number;
  }
  if (
    !Array.isArray(data.memberIds) ||
    data.memberIds.length < 1 ||
    data.memberIds.length > 32
  )
    invalid('memberIds', 'Select 1–32 distinct inventory extensions.');
  const memberIds = data.memberIds.map((v) => id(v, 'memberIds'));
  if (new Set(memberIds).size !== memberIds.length)
    invalid('memberIds', 'Members must be distinct.');
  const strategy = data.strategy ?? 'simultaneous';
  if (strategy !== 'simultaneous' && strategy !== 'sequential')
    invalid('strategy');
  const timeout = data.timeout ?? 20;
  if (
    typeof timeout !== 'number' ||
    !Number.isInteger(timeout) ||
    timeout < 5 ||
    timeout > 120
  )
    invalid('timeout', 'Use 5–120 seconds per attempt.');
  const f = object(data.fallback, ['kind', 'id']);
  if (f.kind === 'hangup') {
    if ('id' in f) invalid('fallback');
    return {
      name,
      number,
      memberIds,
      strategy,
      timeout,
      fallback: { kind: 'hangup' },
    };
  }
  if (f.kind !== 'extension' && f.kind !== 'group') invalid('fallback');
  return {
    name,
    number,
    memberIds,
    strategy,
    timeout,
    fallback: { kind: f.kind, id: id(f.id, 'fallback') },
  };
}
export function reservationValues(
  data: Record<string, unknown>,
): ReservationValues {
  let purpose: string;
  try {
    purpose = label(data.purpose);
  } catch (e) {
    if (e instanceof PeerRejected) invalid('purpose');
    throw e;
  }
  return {
    name: label(data.name),
    purpose,
    pattern: pattern(data.pattern),
  };
}
export function inboundValues(data: Record<string, unknown>): InboundValues {
  const d = object(data.destination, ['kind', 'id']);
  if (d.kind !== 'hangup' && d.kind !== 'extension' && d.kind !== 'group')
    invalid('destination');
  if (d.kind === 'hangup' && 'id' in d) invalid('destination');
  return {
    name: label(data.name),
    gatewayId: id(data.gatewayId, 'gatewayId'),
    didId: data.didId === null ? null : id(data.didId, 'didId'),
    destination:
      d.kind === 'hangup'
        ? { kind: 'hangup' }
        : { kind: d.kind, id: id(d.id, 'destination') },
  };
}
export function routingValues(
  kind: RoutingKind,
  data: Record<string, unknown>,
) {
  return kind === 'outbound'
    ? outboundValues(data)
    : kind === 'inbound'
      ? inboundValues(data)
      : kind === 'groups'
        ? groupValues(data)
        : reservationValues(data);
}
export function validateGraph(groups: Pick<GroupDto, 'id' | 'fallback'>[]) {
  if (groups.length > 512) throw new RoutingRejected('graph_limit');
  const all = new Map(groups.map((g) => [g.id, g]));
  for (const start of groups) {
    const seen = new Set<string>();
    let current: typeof start | undefined = start;
    while (current) {
      if (seen.has(current.id))
        invalid(
          'fallback',
          'Fallback would create a direct or indirect cycle.',
        );
      seen.add(current.id);
      current =
        current.fallback.kind === 'group'
          ? all.get(current.fallback.id)
          : undefined;
    }
  }
}
/** Trusted allocation facts only; this is not an allocation or API binding feature. */
export function tenantCompatible(
  root: string,
  tenantId: string,
  groups: GroupDto[],
  facts: ReadonlyMap<string, { tenantId: string | null; eligible: boolean }>,
): boolean {
  validateGraph(groups);
  const all = new Map(groups.map((g) => [g.id, g]));
  const seen = new Set<string>();
  const visit = (key: string): boolean => {
    if (seen.has(key)) return false;
    seen.add(key);
    const g = all.get(key);
    if (!g || !g.enabled || g.removedAt) return false;
    const extension = (id: string) => {
      const f = facts.get(id);
      return !!f && f.tenantId === tenantId && f.eligible;
    };
    return (
      g.memberIds.every(extension) &&
      (g.fallback.kind === 'hangup' ||
        (g.fallback.kind === 'extension'
          ? extension(g.fallback.id)
          : visit(g.fallback.id)))
    );
  };
  return visit(root);
}

export function outboundValues(data: Record<string, unknown>): OutboundValues {
  const v = {
    name: label(data.name),
    pattern: pattern(data.pattern),
    trunkId: id(data.trunkId, 'trunkId'),
    priority: data.priority,
    stripCount: data.stripCount ?? 0,
    addPrefix: data.addPrefix ?? '',
  };
  if (
    typeof v.priority !== 'number' ||
    !Number.isInteger(v.priority) ||
    v.priority < 0 ||
    v.priority > 2147483647
  )
    invalid('priority', 'Use an integer priority 0–2147483647; lower wins.');
  if (
    typeof v.stripCount !== 'number' ||
    !Number.isInteger(v.stripCount) ||
    v.stripCount < 0 ||
    v.stripCount > v.pattern.minLength
  )
    invalid(
      'stripCount',
      'Strip count cannot exceed the shortest matching number.',
    );
  if (
    typeof v.addPrefix !== 'string' ||
    v.addPrefix.length > 15 ||
    /[^0-9]/.test(v.addPrefix)
  )
    invalid('addPrefix', 'Use at most 15 ASCII digits.');
  if (
    v.pattern.minLength - v.stripCount + v.addPrefix.length < 1 ||
    v.pattern.maxLength - v.stripCount + v.addPrefix.length > 15
  )
    invalid('stripCount', 'Every transformed number must contain 1–15 digits.');
  return v as OutboundValues;
}
/** Exact image of a bounded prefix domain under strip/add, including empty fixed prefix. */
export function transformedDomain(v: OutboundValues): NumberPattern {
  return {
    kind: v.pattern.kind,
    digits: v.addPrefix + v.pattern.digits.slice(v.stripCount),
    minLength: v.pattern.minLength - v.stripCount + v.addPrefix.length,
    maxLength: v.pattern.maxLength - v.stripCount + v.addPrefix.length,
  };
}
