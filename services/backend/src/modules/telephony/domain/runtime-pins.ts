import { entries, type RevisionSnapshot } from './revision-snapshot';
import { tenantRouting } from './tenant-routing';
/** Pin actual typed runtime dependencies; historical policies keep their original conservative pins. */
export function runtimePins(s: RevisionSnapshot) {
  if (s.schemaVersion !== 'tenant-routing-1') return entries(s);
  const routing = tenantRouting(s),
    tenants = s.tenantRouting?.tenants ?? [];
  const extensions = s.extensions.filter(
    (e) => e.administrativeStatus === 'enabled',
  );
  const trunks = s.trunks;
  return entries(s).filter((e) => {
    switch (e.kind) {
      case 'extensions':
        return extensions.some((x) => x.id === e.value.id);
      case 'profiles':
        return extensions.some(
          (x) =>
            x.profileId === e.value.id && x.profileVersion === e.value.version,
        );
      case 'credentials':
        return (
          extensions.some((x) => x.generationId === e.value.id) ||
          trunks.some(
            (t) =>
              t.settings.credential?.id === e.value.id &&
              t.settings.credential.version === e.value.version,
          )
        );
      case 'trunks':
        return trunks.some((t) => t.id === e.value.id);
      case 'groups':
        return tenants.some((t) =>
          routing.destination(t.id, { kind: 'group', id: e.value.id }),
        );
      case 'inbound':
        return tenants.some((t) => routing.inbound(t.id, e.value.id));
      case 'outbound':
        return tenants.some((t) => routing.outbound(t.id, e.value.id));
      case 'allocations':
        return s.tenantRouting!.allocations.some(
          (a) =>
            a.id === e.value.id &&
            extensions.some((x) => x.id === a.extensionId),
        );
      default:
        return true;
    }
  });
}
