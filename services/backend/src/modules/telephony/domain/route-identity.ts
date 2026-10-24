import { createHash } from 'node:crypto';
import type { GroupDestination, GroupDto } from '@myims/contracts';
import { id } from './peer';
import { tenantCompatible } from './routing';
/** Internal only. Neither phone numbers nor caller-controlled labels participate. */
export function routeIdentity(installationId: string, routeId: string) {
  const hash = createHash('sha256')
    .update(JSON.stringify(['myims-route-v1', id(installationId), id(routeId)]))
    .digest('hex');
  return {
    sourceKey: `route:${hash}`,
    contextHash: hash,
    watchIdentity: `watch:${hash}`,
    attributionKey: `attribution:${hash}`,
  };
}
export interface TrustedRouteBinding {
  installationId: string;
  routeId: string;
  version: number;
  tenantId: string | null;
  gatewayId: string;
  didId: string | null;
  destination: GroupDestination;
  enabled: boolean;
}
export interface TrustedAllocation {
  tenantId: string | null;
  eligible: boolean;
}
/** Fixture-tested compatibility boundary. P4 supplies canonical facts; no HTTP bindings. */
export function inboundTenantCompatible(
  binding: TrustedRouteBinding,
  groups: GroupDto[],
  facts: ReadonlyMap<string, TrustedAllocation>,
): boolean {
  if (
    !binding.tenantId ||
    !binding.enabled ||
    !Number.isInteger(binding.version) ||
    binding.version < 1 ||
    new Set(groups.map((g) => g.id)).size !== groups.length
  )
    return false;
  const owns = (key: string) => {
    const f = facts.get(key);
    return !!f && f.eligible && f.tenantId === binding.tenantId;
  };
  if (
    !owns(binding.gatewayId) ||
    (binding.didId !== null && !owns(binding.didId))
  )
    return false;
  if (binding.destination.kind === 'hangup') return true;
  if (binding.destination.kind === 'extension')
    return owns(binding.destination.id);
  if (groups.some((g) => g.installationId !== binding.installationId))
    return false;
  try {
    return tenantCompatible(
      binding.destination.id,
      binding.tenantId,
      groups,
      facts,
    );
  } catch {
    return false;
  }
}
/** Authenticated trusted consumers only. Duplicate/stale/unbound facts fail closed. */
export function resolveRouteTenant(
  installationId: string,
  attributionKey: string,
  evaluatedVersion: number,
  bindings: readonly TrustedRouteBinding[],
  groups: GroupDto[],
  facts: ReadonlyMap<string, TrustedAllocation>,
): string | null {
  try {
    const matches = bindings.filter(
      (b) =>
        b.installationId === installationId &&
        routeIdentity(b.installationId, b.routeId).attributionKey ===
          attributionKey,
    );
    if (matches.length !== 1) return null;
    const b = matches[0]!;
    return b.version === evaluatedVersion &&
      inboundTenantCompatible(b, groups, facts)
      ? b.tenantId
      : null;
  } catch {
    return null;
  }
}

/** Trusted facts from future P4 binding; explicit permission is required for shared trunks. */
export function outboundTenantCompatible(
  binding: {
    installationId: string;
    routeId: string;
    version: number;
    tenantId: string | null;
    trunkId: string;
    enabled: boolean;
  },
  facts: ReadonlyMap<
    string,
    {
      installationId: string;
      tenantId: string | null;
      eligible: boolean;
      permittedTenantIds: readonly string[];
    }
  >,
): boolean {
  if (
    !binding.tenantId ||
    !binding.enabled ||
    !Number.isInteger(binding.version) ||
    binding.version < 1
  )
    return false;
  const route = facts.get(binding.routeId),
    trunk = facts.get(binding.trunkId);
  return (
    !!route &&
    !!trunk &&
    route.installationId === binding.installationId &&
    trunk.installationId === binding.installationId &&
    route.tenantId === binding.tenantId &&
    route.eligible &&
    trunk.eligible &&
    (trunk.tenantId === null || trunk.tenantId === binding.tenantId) &&
    trunk.permittedTenantIds.includes(binding.tenantId)
  );
}
