import type {
  PbxObservationDto,
  PbxObservationFailure,
  PbxRegistrationFact,
} from '@myims/contracts';
import type { ReadSnapshot } from '../../../../infrastructure/database/read-snapshot';
import { developmentObservationSettings } from '../../domain/observation-settings';
export async function passiveObservation(
  snapshot: ReadSnapshot,
  nodeId: string,
  version: number,
): Promise<PbxObservationDto> {
  const r = await snapshot.query<{
    desired_version: number;
    epoch: string;
    sequence: string;
    last_success_at: Date | null;
    connection: 'unknown' | 'reachable' | 'disconnected';
    reconciliation: 'complete' | 'reconciling';
    failure: PbxObservationFailure | null;
    registrations: PbxRegistrationFact[];
    coverage: 'unknown' | 'pjsip-dynamic-contacts';
    owned: boolean;
    age: string | null;
  }>(
    `SELECT o.*, (l.incarnation IS NOT NULL AND l.epoch=o.epoch AND l.desired_version=$2 AND l.expires_at>clock_timestamp()) AS owned,
    CASE WHEN o.last_success_at IS NULL THEN NULL ELSE greatest(0,extract(epoch FROM (clock_timestamp()-o.last_success_at))*1000)::bigint END AS age
    FROM public.pbx_observations o JOIN public.pbx_ownership l USING(node_id) WHERE o.node_id=$1`,
    [nodeId, version],
  );
  const o = r.rows[0];
  if (!o || o.epoch === '0') return { kind: 'not_available' };
  const age = o.age === null ? null : Number(o.age);
  const current =
    o.owned &&
    o.desired_version === version &&
    o.connection === 'reachable' &&
    o.reconciliation === 'complete' &&
    age !== null &&
    age < developmentObservationSettings.freshnessMs;
  return {
    kind: 'observed',
    desiredVersion: o.desired_version,
    epoch: o.epoch,
    sequence: Number(o.sequence),
    lastSuccessAt: o.last_success_at?.toISOString() ?? null,
    ageMs: age,
    freshness:
      age === null
        ? 'unknown'
        : age >= developmentObservationSettings.freshnessMs
          ? 'stale'
          : current
            ? 'current'
            : 'historical',
    connection: o.connection,
    reconciliation: o.reconciliation,
    ownership: o.owned ? 'current' : 'absent',
    failure: o.failure,
    coverage: o.coverage,
    registrations: o.registrations,
    registeredEndpoints:
      o.coverage === 'unknown'
        ? null
        : o.registrations.filter((f) => f.registered).length,
  };
}
