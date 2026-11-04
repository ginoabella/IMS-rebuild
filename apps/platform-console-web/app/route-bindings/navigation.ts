import type { RouteAuthorizationKind } from '@myims/contracts';
export const labels: Record<RouteAuthorizationKind, string> = {
  dids: 'DID ownership',
  groups: 'Ring group ownership',
  inbound: 'Inbound route binding',
  trunks: 'Trunk ownership or shared classification',
  permission: 'Explicit trunk permission',
  outbound: 'Outbound route binding',
};
export function dependencyLink(
  nodeId: string,
  kind: string,
  id: string,
  tenantId?: string | null,
) {
  return kind === 'binding'
    ? tenantId === null
      ? '/tenants'
      : tenantId
        ? `/tenants/${tenantId}#route-bindings-heading`
        : `#route-binding-${id}`
    : kind === 'extensions'
      ? `/pbx-nodes/${nodeId}/inventory?extension=${id}`
      : ['dids', 'trunks', 'gateways'].includes(kind)
        ? `/pbx-nodes/${nodeId}/peers?kind=${kind}&resource=${id}`
        : `/pbx-nodes/${nodeId}/routing?kind=${kind}&resource=${id}`;
}
