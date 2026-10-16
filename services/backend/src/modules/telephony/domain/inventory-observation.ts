import type {
  ExtensionObservationDto,
  PbxObservationDto,
} from '@myims/contracts';
/** Pure composition: a shared node snapshot is read once in the caller's snapshot. */
export function composeExtensionObservation(
  node: { id: string; installationId: string; version: number },
  row: {
    id: string;
    node_id: string;
    installation_id: string;
    endpoint_key: string;
    auth_key: string;
    aor_key: string;
  },
  observation: PbxObservationDto,
): ExtensionObservationDto {
  if (observation.kind === 'not_available') return observation;
  const suffix = `${node.installationId.replaceAll('-', '').toLowerCase()}-${row.id.replaceAll('-', '').toLowerCase()}`;
  const identity =
    row.node_id === node.id &&
    row.installation_id === node.installationId &&
    row.endpoint_key === `ims-e-${suffix}` &&
    row.auth_key === `ims-a-${suffix}` &&
    row.aor_key === `ims-r-${suffix}`;
  const {
    registrations,
    registeredEndpoints: _count,
    ...metadata
  } = observation;
  void _count;
  const covered =
    identity &&
    observation.desiredVersion === node.version &&
    observation.freshness === 'current' &&
    observation.ownership === 'current' &&
    observation.connection === 'reachable' &&
    observation.reconciliation === 'complete' &&
    observation.coverage === 'pjsip-dynamic-contacts';
  const fact = covered
    ? registrations.find((f) => f.endpoint === row.endpoint_key)
    : undefined;
  return {
    ...metadata,
    nodeVersion: node.version,
    registration: !covered
      ? 'unknown'
      : !fact
        ? 'endpoint_absent'
        : fact.registered
          ? 'registered'
          : 'unregistered',
    endpointPresent: covered ? !!fact : null,
    contacts: fact?.contacts ?? null,
    reachableContacts: fact?.reachableContacts ?? null,
  };
}
