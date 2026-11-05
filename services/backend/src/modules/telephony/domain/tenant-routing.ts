import type {
  RouteAuthorizationKind,
  GroupDestination,
} from '@myims/contracts';
import { canonical, entries, type RevisionSnapshot } from './revision-snapshot';
/** Interpret only canonical captured facts. No labels or numbers establish ownership. */
export function tenantRouting(s: RevisionSnapshot) {
  const captured = s.tenantRouting;
  const facts = new Map(
    entries(s).map((e) => [`${e.kind}:${e.value.id}`, e.value]),
  );
  const authorizations = captured?.authorizations ?? [];
  const tenants = captured?.tenants ?? [];
  const allocations = captured?.allocations ?? [];
  const target = (tenantId: string) => {
    const matches = tenants.filter((t) => t.id === tenantId);
    return matches.length === 1 &&
      ['draft', 'active'].includes(matches[0]!.status)
      ? matches[0]!
      : null;
  };
  const extension = (tenantId: string, id: string) => {
    const claims = allocations.filter((a) => a.extensionId === id);
    const e = s.extensions.find((e) => e.id === id);
    return (
      !!target(tenantId) &&
      !!e &&
      e.administrativeStatus === 'enabled' &&
      claims.length === 1 &&
      claims[0]!.tenantId === tenantId &&
      claims[0]!.state === 'allocated' &&
      claims[0]!.nodeId === s.node.id &&
      claims[0]!.installationId === s.node.installationId
    );
  };
  const fresh = (a: (typeof authorizations)[number]) => {
    const resourceKind = a.kind === 'permission' ? 'trunks' : a.kind;
    const resource = facts.get(`${resourceKind}:${a.resourceId}`);
    if (
      !resource ||
      a.evaluated.length === 0 ||
      a.evaluated.length > 512 ||
      !a.evaluated.some(
        (f) =>
          f.kind === resourceKind &&
          f.id === a.resourceId &&
          f.version === resource.version,
      ) ||
      new Set(a.evaluated.map((f) => `${f.kind}:${f.id}`)).size !==
        a.evaluated.length
    )
      return false;
    return a.evaluated.every((f) => {
      const kind =
        f.kind === 'allocation'
          ? 'allocations'
          : f.kind === 'authorization'
            ? 'authorizations'
            : f.kind;
      return (
        Number.isSafeInteger(f.version) &&
        f.version > 0 &&
        facts.get(`${kind}:${f.id}`)?.version === f.version
      );
    });
  };
  const owner = (
    tenantId: string,
    kind: RouteAuthorizationKind,
    id: string,
    shared = false,
  ) => {
    const matches = authorizations.filter(
      (a) =>
        a.kind === kind &&
        a.resourceId === id &&
        (kind !== 'permission' || a.tenantId === tenantId),
    );
    if (matches.length !== 1) return null;
    const a = matches[0]!;
    return a.nodeId === s.node.id &&
      a.installationId === s.node.installationId &&
      ((a.tenantId === tenantId && a.scope === 'owned') ||
        (shared && a.tenantId === null && a.scope === 'shared')) &&
      fresh(a)
      ? a
      : null;
  };
  const destination = (
    tenantId: string,
    d: GroupDestination,
    seen = new Set<string>(),
  ): boolean => {
    if (d.kind === 'hangup') return true;
    if (d.kind === 'extension') return extension(tenantId, d.id);
    if (seen.has(d.id) || seen.size >= 512 || !owner(tenantId, 'groups', d.id))
      return false;
    seen.add(d.id);
    const g = s.groups.find((g) => g.id === d.id);
    return (
      !!g?.enabled &&
      g.memberIds.every((id) => extension(tenantId, id)) &&
      destination(tenantId, g.fallback, seen)
    );
  };
  const inbound = (tenantId: string, id: string) => {
    const r = s.inbound.find((r) => r.id === id);
    const g = s.gateways.find((g) => g.id === r?.gatewayId);
    const d = s.dids.find((d) => d.id === r?.didId);
    const trunk = g?.trunkId ? s.trunks.find((t) => t.id === g.trunkId) : null;
    return (
      !!target(tenantId) &&
      !!r?.enabled &&
      !!g?.enabled &&
      !!d?.enabled &&
      d.gatewayId === g.id &&
      (!g.trunkId || (!!trunk?.enabled && trunk.direction !== 'outbound')) &&
      !!owner(tenantId, 'inbound', id) &&
      !!owner(tenantId, 'dids', d.id) &&
      destination(tenantId, r.destination)
    );
  };
  const outbound = (tenantId: string, id: string) => {
    const r = s.outbound.find((r) => r.id === id);
    const t = s.trunks.find((t) => t.id === r?.trunkId);
    return (
      !!target(tenantId) &&
      !!r?.enabled &&
      !!t?.enabled &&
      t.direction !== 'inbound' &&
      !!owner(tenantId, 'outbound', id) &&
      !!owner(tenantId, 'trunks', t.id, true) &&
      !!owner(tenantId, 'permission', t.id)
    );
  };
  const outboundRule = (tenantId: string, number: string) => {
    if (!/^[0-9]{1,15}$/.test(number)) return null;
    const matches = (
      p: RevisionSnapshot['reservations'][number]['pattern'],
      value: string,
    ) =>
      value.startsWith(p.digits) &&
      value.length >= p.minLength &&
      value.length <= p.maxLength;
    if (s.reservations.some((r) => matches(r.pattern, number))) return null;
    const ordered = s.outbound
      .filter((r) =>
        authorizations.some(
          (a) =>
            a.kind === 'outbound' &&
            a.resourceId === r.id &&
            a.tenantId === tenantId,
        ),
      )
      .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
    const winner = ordered.find((r) => matches(r.pattern, number));
    if (!winner || !outbound(tenantId, winner.id)) return null;
    const transformed = winner.addPrefix + number.slice(winner.stripCount);
    return !/^[0-9]{1,15}$/.test(transformed) ||
      s.reservations.some((r) => matches(r.pattern, transformed))
      ? null
      : winner;
  };
  const valid =
    !!captured &&
    s.schemaVersion === 'tenant-routing-1' &&
    ['tenants', 'allocations', 'authorizations'].every((kind) => {
      const rows = captured[kind as keyof typeof captured];
      return new Set(rows.map((r) => r.id)).size === rows.length;
    }) &&
    allocations.every((a) => !!tenants.find((t) => t.id === a.tenantId)) &&
    authorizations.every(
      (a) => a.tenantId === null || !!tenants.find((t) => t.id === a.tenantId),
    ) &&
    canonical(s.eligibility) ===
      canonical({
        allocations: 'captured',
        bindings: 'captured',
        sharedTrunkPermissions: 'captured',
      });
  return {
    valid,
    target,
    extension,
    owner,
    destination,
    inbound,
    outbound,
    outboundRule,
  };
}
