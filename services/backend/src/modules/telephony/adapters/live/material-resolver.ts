import type { Pool } from 'pg';
import type { RevisionSnapshot } from '../../domain/revision-snapshot';
import type { LiveMaterial } from './materialize';
import {
  ExactLiveMaterialConsumer,
  LiveMaterialFailure,
} from './exact-material';
/** Telephony consumer only. Joins retained metadata to exact protected GETs. */
export class LiveMaterialResolver {
  constructor(
    private readonly pool: Pool,
    private readonly consumer: ExactLiveMaterialConsumer,
  ) {}
  async resolve(
    snapshot: RevisionSnapshot,
    signal?: AbortSignal,
  ): Promise<LiveMaterial> {
    const material: LiveMaterial = { endpoints: new Map(), trunks: new Map() };
    const deadline = performance.now() + 60000;
    const check = () => {
      if (signal?.aborted || performance.now() > deadline)
        throw new LiveMaterialFailure('material_unavailable');
    };
    for (const endpoint of snapshot.extensions) {
      check();
      if (endpoint.administrativeStatus !== 'enabled') continue;
      if (!endpoint.generationId)
        throw new LiveMaterialFailure('material_missing');
      const row = (
        await this.pool.query<{ operationId: string }>(
          `SELECT id AS "operationId" FROM public.endpoint_credential_operations WHERE installation_id=$1 AND extension_id=$2 AND generation_id=$3 AND state='associated' AND material_health='verified'`,
          [snapshot.node.installationId, endpoint.id, endpoint.generationId],
        )
      ).rows[0];
      if (!row) throw new LiveMaterialFailure('material_missing');
      const value = await this.consumer.endpoint({
        installationId: snapshot.node.installationId,
        extensionId: endpoint.id,
        generationId: endpoint.generationId,
        operationId: row.operationId,
      });
      material.endpoints.set(endpoint.generationId, value);
    }
    for (const trunk of snapshot.trunks) {
      check();
      const reference = trunk.settings.credential;
      if (!reference) continue;
      const key = `${reference.id}:${reference.version}`;
      if (material.trunks.has(key)) continue;
      const row = (
        await this.pool.query<{ operationId: string }>(
          `SELECT i.operation_id AS "operationId" FROM public.sip_credential_imports i JOIN public.sip_credentials c ON c.id=i.credential_id JOIN public.sip_credential_versions v ON v.credential_id=c.id AND v.material_version=i.expected_version+1 WHERE c.installation_id=$1 AND c.id=$2 AND v.material_version=$3 AND i.state='confirmed' AND c.available AND v.available AND c.purpose='outbound-digest'`,
          [snapshot.node.installationId, reference.id, reference.version],
        )
      ).rows[0];
      if (!row) throw new LiveMaterialFailure('material_missing');
      material.trunks.set(
        key,
        await this.consumer.trunk({
          installationId: snapshot.node.installationId,
          credentialId: reference.id,
          version: reference.version,
          operationId: row.operationId,
          realm: trunk.settings.registration?.realm ?? null,
        }),
      );
    }
    check();
    return material;
  }
}
