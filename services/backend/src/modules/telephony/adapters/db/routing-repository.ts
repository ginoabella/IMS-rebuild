import type {
  GroupDto,
  GroupValues,
  ReservationValues,
  RoutingDto,
  RoutingKind,
} from '@myims/contracts';
import type { ReadSnapshot } from '../../../../infrastructure/database/read-snapshot';
import type { Transaction } from '../../../../infrastructure/database/transaction';
import { RoutingRejected, validateGraph } from '../../domain/routing';
import { PeerRepository } from './peer-repository';
const tables = {
  groups: 'public.ring_groups',
  reservations: 'public.number_reservations',
} as const;
const common = `id,node_id AS "nodeId",installation_id AS "installationId",name,version,created_at AS "createdAt",updated_at AS "updatedAt",created_by AS "createdBy",updated_by AS "updatedBy",removed_at AS "removedAt"`;
function select(k: RoutingKind) {
  return `SELECT ${common},${k === 'groups' ? `enabled,number,strategy,timeout,ARRAY(SELECT extension_id FROM public.ring_group_members m WHERE m.group_id=ring_groups.id ORDER BY position) AS "memberIds",CASE WHEN fallback_group_id IS NOT NULL THEN jsonb_build_object('kind','group','id',fallback_group_id) WHEN fallback_extension_id IS NOT NULL THEN jsonb_build_object('kind','extension','id',fallback_extension_id) ELSE jsonb_build_object('kind','hangup') END AS fallback` : `purpose,jsonb_build_object('kind',pattern_kind,'digits',digits,'minLength',min_length,'maxLength',max_length) AS pattern`} FROM ${tables[k]}`;
}
type Row = Omit<RoutingDto, 'createdAt' | 'updatedAt' | 'removedAt'> & {
  createdAt: Date;
  updatedAt: Date;
  removedAt: Date | null;
};
function dto(r: Row): RoutingDto {
  return {
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    removedAt: r.removedAt?.toISOString() ?? null,
  } as RoutingDto;
}
export class RoutingRepository {
  node = new PeerRepository().node;
  async detail(s: ReadSnapshot, k: RoutingKind, nodeId: string, id: string) {
    const r = (
      await s.query<Row>(`${select(k)} WHERE node_id=$1 AND id=$2`, [
        nodeId,
        id,
      ])
    ).rows[0];
    return r ? dto(r) : null;
  }
  async list(
    s: ReadSnapshot,
    k: RoutingKind,
    nodeId: string,
    after: string | null,
    limit: number,
  ) {
    return (
      await s.query<Row>(
        `${select(k)} WHERE node_id=$1 AND removed_at IS NULL AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3`,
        [nodeId, after, limit],
      )
    ).rows.map(dto);
  }
  async receipt(tx: Transaction, requestId: string) {
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `routing:${tx.context.actor.reference}:${requestId}`,
    ]);
    return (
      await tx.query<{
        fingerprint: string;
        result: { resource: RoutingDto };
        expired: boolean;
      }>(
        `SELECT fingerprint,result,created_at<=clock_timestamp()-interval '30 days' AS expired FROM public.routing_receipts WHERE operator_id=$1 AND request_id=$2`,
        [tx.context.actor.reference, requestId],
      )
    ).rows[0];
  }
  async saveReceipt(
    tx: Transaction,
    requestId: string,
    fingerprint: string,
    result: { resource: RoutingDto },
  ) {
    await tx.query(
      'INSERT INTO public.routing_receipts(operator_id,request_id,fingerprint,result) VALUES($1,$2,$3,$4)',
      [tx.context.actor.reference, requestId, fingerprint, result],
    );
  }
  async blockers(s: ReadSnapshot, nodeId: string, id: string) {
    return (
      await s.query<{ id: string; name: string }>(
        `SELECT id,name FROM public.ring_groups WHERE node_id=$1 AND removed_at IS NULL AND (fallback_group_id=$2 OR fallback_extension_id=$2 OR id IN (SELECT group_id FROM public.ring_group_members WHERE extension_id=$2)) ORDER BY id LIMIT 10`,
        [nodeId, id],
      )
    ).rows;
  }
  async validate(
    s: ReadSnapshot,
    k: RoutingKind,
    nodeId: string,
    installationId: string,
    id: string,
    v: GroupValues | ReservationValues,
  ) {
    if (
      (
        await s.query(
          `SELECT id FROM ${tables[k]} WHERE installation_id=$1 AND lower(name)=lower($2) AND id<>$3 AND removed_at IS NULL`,
          [installationId, v.name, id],
        )
      ).rows.length
    )
      throw new RoutingRejected('name_conflict');
    const p =
      'pattern' in v
        ? v.pattern
        : v.number
          ? {
              digits: v.number,
              minLength: v.number.length,
              maxLength: v.number.length,
            }
          : null;
    if (p) {
      const clashes = (
        await s.query<{ id: string; name: string }>(
          `SELECT DISTINCT c.owner_id AS id,CASE c.owner_kind WHEN 'extensions' THEN 'Extension '||e.number WHEN 'ring_groups' THEN g.name ELSE r.name END AS name FROM public.telephony_number_claims c LEFT JOIN public.extensions e ON c.owner_kind='extensions' AND e.id=c.owner_id LEFT JOIN public.ring_groups g ON c.owner_kind='ring_groups' AND g.id=c.owner_id LEFT JOIN public.number_reservations r ON c.owner_kind='number_reservations' AND r.id=c.owner_id WHERE c.installation_id=$1 AND c.owner_id<>$2 AND c.digit_length BETWEEN $4 AND $5 AND c.span && int8range(rpad($3,c.digit_length,'0')::bigint,rpad($3,c.digit_length,'9')::bigint+1,'[)') ORDER BY id LIMIT 10`,
          [installationId, id, p.digits, p.minLength, p.maxLength],
        )
      ).rows;
      if (clashes.length) throw new RoutingRejected('number_conflict', clashes);
    }
    if ('memberIds' in v) {
      const ids = [
        ...v.memberIds,
        ...(v.fallback.kind === 'extension' ? [v.fallback.id] : []),
      ];
      const ext = (
        await s.query<{ id: string }>(
          `SELECT id FROM public.extensions WHERE node_id=$1 AND installation_id=$2 AND id=ANY($3::uuid[])`,
          [nodeId, installationId, ids],
        )
      ).rows;
      if (ids.some((id) => !ext.some((e) => e.id === id)))
        throw new RoutingRejected('invalid_extension');
      const groups = (await this.list(
        s,
        'groups',
        nodeId,
        null,
        513,
      )) as GroupDto[];
      const fallback = v.fallback;
      if (
        fallback.kind === 'group' &&
        !groups.some((g) => g.id === fallback.id)
      )
        throw new RoutingRejected('invalid_group');
      validateGraph([
        ...groups.filter((g) => g.id !== id),
        { id, fallback: v.fallback },
      ]);
    }
  }
  async save(
    tx: Transaction,
    k: RoutingKind,
    nodeId: string,
    installationId: string,
    id: string,
    v: GroupValues | ReservationValues | null,
    old: RoutingDto | null,
    enabled: boolean,
    remove: boolean,
  ) {
    const actor = tx.context.actor.reference;
    if (!old && v) {
      if ('memberIds' in v)
        await tx.query(
          `INSERT INTO public.ring_groups(id,node_id,installation_id,name,strategy,timeout,number,fallback_extension_id,fallback_group_id,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
          [
            id,
            nodeId,
            installationId,
            v.name,
            v.strategy,
            v.timeout,
            v.number,
            v.fallback.kind === 'extension' ? v.fallback.id : null,
            v.fallback.kind === 'group' ? v.fallback.id : null,
            actor,
          ],
        );
      else
        await tx.query(
          `INSERT INTO public.number_reservations(id,node_id,installation_id,name,purpose,pattern_kind,digits,min_length,max_length,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
          [
            id,
            nodeId,
            installationId,
            v.name,
            v.purpose,
            v.pattern.kind,
            v.pattern.digits,
            v.pattern.minLength,
            v.pattern.maxLength,
            actor,
          ],
        );
    } else {
      const args: unknown[] = [id, actor, remove];
      let extra = '';
      if (k === 'groups') {
        args.push(enabled);
        extra = ',enabled=$4';
      }
      if (v && 'memberIds' in v) {
        args.push(
          v.name,
          v.number,
          v.strategy,
          v.timeout,
          v.fallback.kind === 'extension' ? v.fallback.id : null,
          v.fallback.kind === 'group' ? v.fallback.id : null,
        );
        extra +=
          ',name=$5,number=$6,strategy=$7,timeout=$8,fallback_extension_id=$9,fallback_group_id=$10';
      } else if (v && 'pattern' in v) {
        args.push(
          v.name,
          v.purpose,
          v.pattern.kind,
          v.pattern.digits,
          v.pattern.minLength,
          v.pattern.maxLength,
        );
        extra +=
          ',name=$4,purpose=$5,pattern_kind=$6,digits=$7,min_length=$8,max_length=$9';
      }
      await tx.query(
        `UPDATE ${tables[k]} SET version=version+1,updated_by=$2,updated_at=clock_timestamp(),removed_at=CASE WHEN $3 THEN clock_timestamp() ELSE NULL END${extra} WHERE id=$1`,
        args,
      );
    }
    if (v && 'memberIds' in v) {
      await tx.query(
        'DELETE FROM public.ring_group_members WHERE group_id=$1',
        [id],
      );
      for (const [i, ext] of v.memberIds.entries())
        await tx.query(
          'INSERT INTO public.ring_group_members(group_id,node_id,installation_id,extension_id,position) VALUES($1,$2,$3,$4,$5)',
          [id, nodeId, installationId, ext, i + 1],
        );
    }
    return (await this.detail(tx, k, nodeId, id))!;
  }
  async preview(
    s: ReadSnapshot,
    nodeId: string,
    root: GroupValues,
    resourceId: string,
  ) {
    const groups = (await this.list(
      s,
      'groups',
      nodeId,
      null,
      513,
    )) as GroupDto[];
    const resources: {
      id: string;
      version: number;
      kind: 'extension' | 'group';
      available: boolean;
    }[] = [];
    const current = groups.find((g) => g.id === resourceId);
    if (current)
      resources.push({
        id: current.id,
        version: current.version,
        kind: 'group',
        available: current.enabled,
      });
    const extIds = new Set<string>();
    const collect = (g: GroupValues) => {
      for (const id of g.memberIds) extIds.add(id);
      if (g.fallback.kind === 'extension') extIds.add(g.fallback.id);
      else if (g.fallback.kind === 'group') {
        const target = g.fallback.id;
        const next = groups.find((x) => x.id === target);
        if (next && !resources.some((x) => x.id === next.id)) {
          resources.push({
            id: next.id,
            version: next.version,
            kind: 'group',
            available: next.enabled,
          });
          collect(next);
        }
      }
    };
    collect(root);
    const extensions = (
      await s.query<{ id: string; version: number; available: boolean }>(
        `SELECT id,version,(administrative_status='enabled') AS available FROM public.extensions WHERE node_id=$1 AND id=ANY($2::uuid[])`,
        [nodeId, [...extIds]],
      )
    ).rows;
    resources.push(
      ...extensions.map((e) => ({ ...e, kind: 'extension' as const })),
    );
    const attempts =
      root.strategy === 'simultaneous' ? 1 : root.memberIds.length;
    return {
      advisory: true as const,
      callingEligible: false as const,
      attempts,
      maximumRingSeconds: attempts * root.timeout,
      resources,
      warnings: [
        'Unbound desired definition: no tenant ownership or calling eligibility.',
        ...(resources.some((r) => !r.available)
          ? [
              'Disabled resources are present; desired saves do not establish availability.',
            ]
          : []),
      ],
    };
  }
}
