import type {
  DidValues,
  GatewayValues,
  PeerDto,
  PeerResource,
  TrunkDto,
  TrunkValues,
} from '@myims/contracts';
import type { ReadSnapshot } from '../../../../infrastructure/database/read-snapshot';
import type { Transaction } from '../../../../infrastructure/database/transaction';
import { PeerRejected } from '../../domain/peer';
const tables = {
  trunks: 'public.sip_trunks',
  gateways: 'public.sip_gateways',
  dids: 'public.sip_dids',
} as const;
const common = `id,node_id AS "nodeId",installation_id AS "installationId",name,enabled,version,created_at AS "createdAt",updated_at AS "updatedAt",created_by AS "createdBy",updated_by AS "updatedBy",removed_at AS "removedAt"`;
function select(kind: PeerResource) {
  return `SELECT ${common},${kind === 'trunks' ? `direction,settings,CASE WHEN settings->>'authentication'='ip-peer' THEN 'not_required' ELSE 'selected' END AS "credentialStatus"` : kind === 'dids' ? `number,gateway_id AS "gatewayId",'not_required'::text AS "credentialStatus"` : `'not_required'::text AS "credentialStatus",kind,trunk_id AS "trunkId",ARRAY(SELECT host(address) FROM public.sip_gateway_sources s WHERE s.gateway_id=sip_gateways.id AND (s.removed_at IS NULL OR s.removed_at=sip_gateways.removed_at) ORDER BY host(address)) AS "sourceAddresses"`} FROM ${tables[kind]}`;
}
type Row = Omit<PeerDto, 'createdAt' | 'updatedAt' | 'removedAt'> & {
  createdAt: Date;
  updatedAt: Date;
  removedAt: Date | null;
};
function dto(r: Row): PeerDto {
  return {
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    removedAt: r.removedAt?.toISOString() ?? null,
  } as PeerDto;
}
export class PeerRepository {
  async node(s: ReadSnapshot, nodeId: string, lock = false) {
    return (
      (
        await s.query<{
          id: string;
          installationId: string;
          targetAlias: string;
        }>(
          `SELECT id,installation_id AS "installationId",target_alias AS "targetAlias" FROM public.pbx_nodes WHERE id=$1${lock ? ' FOR UPDATE' : ''}`,
          [nodeId],
        )
      ).rows[0] ?? null
    );
  }
  async credentials(
    s: ReadSnapshot,
    installationId: string,
    after: string | null,
    limit: number,
  ) {
    return (
      await s.query<import('@myims/contracts').TrunkCredentialSelection>(
        `SELECT c.id,c.label,c.installation_id AS "installationId",c.purpose,v.material_version AS version,(c.available AND v.available) AS available FROM public.sip_credentials c JOIN public.sip_credential_versions v ON v.credential_id=c.id WHERE c.installation_id=$1 AND ($2::text IS NULL OR (c.id,v.material_version)>(split_part($2,':',1)::uuid,split_part($2,':',2)::integer)) ORDER BY c.id,v.material_version LIMIT $3`,
        [installationId, after, limit],
      )
    ).rows;
  }
  async detail(
    s: ReadSnapshot,
    kind: PeerResource,
    nodeId: string,
    id: string,
  ) {
    const row = (
      await s.query<Row>(`${select(kind)} WHERE node_id=$1 AND id=$2`, [
        nodeId,
        id,
      ])
    ).rows[0];
    return row ? dto(row) : null;
  }
  async list(
    s: ReadSnapshot,
    kind: PeerResource,
    nodeId: string,
    after: string | null,
    limit: number,
  ) {
    return (
      await s.query<Row>(
        `${select(kind)} WHERE node_id=$1 AND removed_at IS NULL AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3`,
        [nodeId, after, limit],
      )
    ).rows.map(dto);
  }
  async receipt(tx: Transaction, requestId: string) {
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `sip-peer:${tx.context.actor.reference}:${requestId}`,
    ]);
    return (
      (
        await tx.query<{
          fingerprint: string;
          result: { resource: PeerDto };
          expired: boolean;
        }>(
          `SELECT fingerprint,result,created_at<=clock_timestamp()-interval '30 days' AS expired FROM public.sip_peer_receipts WHERE operator_id=$1 AND request_id=$2`,
          [tx.context.actor.reference, requestId],
        )
      ).rows[0] ?? null
    );
  }
  async saveReceipt(
    tx: Transaction,
    requestId: string,
    fingerprint: string,
    result: { resource: PeerDto },
  ) {
    await tx.query(
      'INSERT INTO public.sip_peer_receipts(operator_id,request_id,fingerprint,result) VALUES($1,$2,$3,$4)',
      [tx.context.actor.reference, requestId, fingerprint, result],
    );
  }
  // All reference owners must acquire the node lock first, before reading dependencies.
  // DID and gateway changes share this lock with trunk changes.
  async blockers(
    s: ReadSnapshot,
    kind: PeerResource,
    id: string,
    providerOnly = false,
  ) {
    return kind === 'trunks'
      ? (
          await s.query<{ id: string; name: string }>(
            "SELECT id,name FROM public.sip_gateways WHERE trunk_id=$1 AND removed_at IS NULL AND (NOT $2::boolean OR kind='sip-provider') ORDER BY id LIMIT 10",
            [id, providerOnly],
          )
        ).rows
      : kind === 'gateways'
        ? (
            await s.query<{ id: string; name: string }>(
              'SELECT id,name FROM public.sip_dids WHERE gateway_id=$1 AND removed_at IS NULL ORDER BY id LIMIT 10',
              [id],
            )
          ).rows
        : [];
  }
  async validate(
    tx: Transaction,
    kind: PeerResource,
    nodeId: string,
    installationId: string,
    id: string,
    v: TrunkValues | GatewayValues | DidValues,
  ) {
    const names = await tx.query(
      `SELECT id FROM ${tables[kind]} WHERE installation_id=$1 AND lower(name)=lower($2) AND removed_at IS NULL AND id<>$3`,
      [installationId, v.name, id],
    );
    if (names.rows.length) throw new PeerRejected(409, 'name_conflict');
    if ('number' in v) {
      const gateway = await this.detail(tx, 'gateways', nodeId, v.gatewayId);
      if (!gateway || gateway.removedAt)
        throw new PeerRejected(409, 'invalid_gateway');
      const duplicate = await tx.query(
        'SELECT id FROM public.sip_dids WHERE installation_id=$1 AND number=$2 AND removed_at IS NULL AND id<>$3',
        [installationId, v.number, id],
      );
      if (duplicate.rows.length) throw new PeerRejected(409, 'number_conflict');
    }
    if ('settings' in v && v.settings.credential) {
      const c = v.settings.credential;
      const found = await tx.query(
        `SELECT c.id FROM public.sip_credentials c JOIN public.sip_credential_versions v ON v.credential_id=c.id WHERE c.id=$1 AND c.installation_id=$2 AND c.purpose='outbound-digest' AND c.available AND v.available AND v.material_version=$3 FOR SHARE OF c,v`,
        [c.id, installationId, c.version],
      );
      if (!found.rows.length) throw new PeerRejected(409, 'invalid_credential');
    }
    if ('sourceAddresses' in v) {
      if (v.trunkId) {
        const trunk = (await this.detail(
          tx,
          'trunks',
          nodeId,
          v.trunkId,
        )) as TrunkDto | null;
        if (
          !trunk ||
          trunk.removedAt ||
          (v.kind === 'sip-provider' && trunk.direction === 'outbound')
        )
          throw new PeerRejected(409, 'invalid_trunk');
      }
      const duplicate = await tx.query(
        'SELECT gateway_id FROM public.sip_gateway_sources WHERE installation_id=$1 AND address=ANY($2::inet[]) AND removed_at IS NULL AND gateway_id<>$3 LIMIT 1',
        [installationId, v.sourceAddresses, id],
      );
      if (duplicate.rows.length) throw new PeerRejected(409, 'source_conflict');
    }
  }
  async create(
    tx: Transaction,
    kind: PeerResource,
    nodeId: string,
    installationId: string,
    id: string,
    v: TrunkValues | GatewayValues | DidValues,
  ) {
    const args = [
      id,
      nodeId,
      installationId,
      v.name,
      tx.context.actor.reference,
    ];
    if ('settings' in v)
      await tx.query(
        `INSERT INTO public.sip_trunks(id,node_id,installation_id,name,created_by,updated_by,direction,settings) VALUES($1,$2,$3,$4,$5,$5,$6,$7)`,
        [...args, v.direction, v.settings],
      );
    else if ('number' in v) {
      await tx.query(
        `INSERT INTO public.sip_dids(id,node_id,installation_id,name,created_by,updated_by,number,gateway_id) VALUES($1,$2,$3,$4,$5,$5,$6,$7)`,
        [...args, v.number, v.gatewayId],
      );
    } else {
      await tx.query(
        `INSERT INTO public.sip_gateways(id,node_id,installation_id,name,created_by,updated_by,kind,trunk_id) VALUES($1,$2,$3,$4,$5,$5,$6,$7)`,
        [...args, v.kind, v.trunkId],
      );
      await this.sources(tx, id, installationId, v.sourceAddresses);
    }
    return (await this.detail(tx, kind, nodeId, id))!;
  }
  private async sources(
    tx: Transaction,
    id: string,
    installationId: string,
    sources: string[],
  ) {
    await tx.query(
      'UPDATE public.sip_gateway_sources SET removed_at=clock_timestamp() WHERE gateway_id=$1 AND removed_at IS NULL',
      [id],
    );
    for (const source of sources)
      await tx.query(
        'INSERT INTO public.sip_gateway_sources(gateway_id,installation_id,address) VALUES($1,$2,$3::inet) ON CONFLICT(gateway_id,address) DO UPDATE SET removed_at=NULL',
        [id, installationId, source],
      );
  }
  async edit(
    tx: Transaction,
    kind: PeerResource,
    old: PeerDto,
    v: TrunkValues | GatewayValues | DidValues | null,
    enabled: boolean,
    remove: boolean,
  ) {
    const args: unknown[] = [
      old.id,
      tx.context.actor.reference,
      enabled,
      remove,
    ];
    let extra = '';
    if (v) {
      args.push(v.name);
      extra = ',name=$5';
      if ('settings' in v) {
        args.push(v.direction, v.settings);
        extra += ',direction=$6,settings=$7';
      } else if ('number' in v) {
        args.push(v.number, v.gatewayId);
        extra += ',number=$6,gateway_id=$7';
      } else {
        args.push(v.kind, v.trunkId);
        extra += ',kind=$6,trunk_id=$7';
      }
    }
    await tx.query(
      `UPDATE ${tables[kind]} SET updated_by=$2,enabled=$3,version=version+1,updated_at=clock_timestamp(),removed_at=CASE WHEN $4 THEN clock_timestamp() ELSE NULL END${extra} WHERE id=$1`,
      args,
    );
    if (kind === 'gateways') {
      if (remove)
        await tx.query(
          'UPDATE public.sip_gateway_sources SET removed_at=(SELECT removed_at FROM public.sip_gateways WHERE id=$1) WHERE gateway_id=$1 AND removed_at IS NULL',
          [old.id],
        );
      else if (v && 'sourceAddresses' in v)
        await this.sources(tx, old.id, old.installationId, v.sourceAddresses);
    }
    return (await this.detail(tx, kind, old.nodeId, old.id))!;
  }
}
