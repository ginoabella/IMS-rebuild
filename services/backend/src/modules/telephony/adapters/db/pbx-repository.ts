import type { PbxNodeDto } from '@myims/contracts';
import type { Transaction } from '../../../../infrastructure/database/transaction';
import type { ReadSnapshot } from '../../../../infrastructure/database/read-snapshot';
import type { DesiredPbx } from '../../application/pbx-input';
import type { PbxRegistry } from '../../application/pbx-ports';
interface Row {
  id: string;
  installation_id: string;
  display_name: string;
  target_alias: string;
  host: string;
  transport: string;
  port: number;
  tls_server_name: string;
  credential_alias: string;
  version: number;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by: string;
}
function dto(row: Row): PbxNodeDto {
  return {
    id: row.id,
    installationId: row.installation_id,
    displayName: row.display_name,
    management: {
      targetAlias: row.target_alias,
      host: row.host,
      transport: row.transport,
      port: row.port,
      tlsServerName: row.tls_server_name,
    },
    credentialAlias: row.credential_alias,
    version: row.version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    observation: { kind: 'not_available' },
  };
}
function values(input: DesiredPbx): unknown[] {
  const p = input.profile;
  return [
    p.installationId,
    input.displayName,
    p.targetAlias,
    p.host,
    p.transport,
    p.port,
    p.tlsServerName,
    input.credentialAlias,
  ];
}
export class PbxRepository implements PbxRegistry {
  async create(tx: Transaction, id: string, input: DesiredPbx) {
    const result = await tx.query<Row>(
      `INSERT INTO public.pbx_nodes(id,installation_id,display_name,target_alias,host,transport,port,tls_server_name,credential_alias,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) ON CONFLICT ON CONSTRAINT pbx_nodes_installation_unique DO NOTHING RETURNING *`,
      [id, ...values(input), tx.context.actor.reference],
    );
    return result.rows[0] ? dto(result.rows[0]) : null;
  }
  async locked(tx: Transaction, id: string) {
    const result = await tx.query<Row>(
      'SELECT * FROM public.pbx_nodes WHERE id=$1 FOR UPDATE',
      [id],
    );
    return result.rows[0] ? dto(result.rows[0]) : null;
  }
  async edit(tx: Transaction, id: string, input: DesiredPbx) {
    // Serialize target changes as well as creates across replicas. The constraint
    // remains the final guard; only this exact target collision is a conflict.
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `pbx-target:${input.profile.installationId}`,
    ]);
    const duplicate = await tx.query(
      'SELECT id FROM public.pbx_nodes WHERE installation_id=$1 AND id<>$2',
      [input.profile.installationId, id],
    );
    if (duplicate.rows.length) return null;
    const result = await tx.query<Row>(
      `UPDATE public.pbx_nodes SET installation_id=$2,display_name=$3,target_alias=$4,host=$5,transport=$6,port=$7,tls_server_name=$8,credential_alias=$9,version=version+1,updated_at=clock_timestamp(),updated_by=$10 WHERE id=$1 RETURNING *`,
      [id, ...values(input), tx.context.actor.reference],
    );
    return result.rows[0] ? dto(result.rows[0]) : null;
  }
  async byId(snapshot: ReadSnapshot, id: string) {
    const result = await snapshot.query<Row>(
      'SELECT * FROM public.pbx_nodes WHERE id=$1',
      [id],
    );
    return result.rows[0] ? dto(result.rows[0]) : null;
  }
  async list(snapshot: ReadSnapshot, limit: number, after: string | null) {
    const result = await snapshot.query<Row>(
      'SELECT * FROM public.pbx_nodes WHERE ($1::uuid IS NULL OR id>$1::uuid) ORDER BY id LIMIT $2',
      [after, limit],
    );
    return result.rows.map(dto);
  }
}
