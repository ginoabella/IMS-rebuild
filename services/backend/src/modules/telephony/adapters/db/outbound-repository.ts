import type {
  OutboundDto,
  OutboundValues,
  OutboundPreviewDto,
  ReservationDto,
  RoutingDto,
} from '@myims/contracts';
import type { ReadSnapshot } from '../../../../infrastructure/database/read-snapshot';
import type { Transaction } from '../../../../infrastructure/database/transaction';
import type { RoutingRepository } from './routing-repository';
import {
  RoutingRejected,
  intersects,
  transformedDomain,
} from '../../domain/routing';
import { routeIdentity } from '../../domain/route-identity';
import { PeerRepository } from './peer-repository';
export const outboundSelect = `SELECT id,node_id AS "nodeId",installation_id AS "installationId",name,enabled,version,created_at AS "createdAt",updated_at AS "updatedAt",created_by AS "createdBy",updated_by AS "updatedBy",removed_at AS "removedAt",trunk_id AS "trunkId",priority,strip_count AS "stripCount",add_prefix AS "addPrefix",jsonb_build_object('kind',pattern_kind,'digits',digits,'minLength',min_length,'maxLength',max_length) AS pattern FROM public.outbound_rules`;
export async function outboundRules(
  s: ReadSnapshot,
  store: RoutingRepository,
  nodeId: string,
) {
  const rows = (await store.list(
    s,
    'outbound',
    nodeId,
    null,
    513,
  )) as OutboundDto[];
  if (rows.length > 512) throw new RoutingRejected('outbound_limit');
  return rows;
}
export async function validateOutbound(
  s: ReadSnapshot,
  store: RoutingRepository,
  nodeId: string,
  installationId: string,
  id: string,
  v: OutboundValues,
) {
  const trunk = await new PeerRepository().detail(
    s,
    'trunks',
    nodeId,
    v.trunkId,
  );
  if (
    !trunk ||
    trunk.removedAt ||
    trunk.installationId !== installationId ||
    !('direction' in trunk) ||
    trunk.direction === 'inbound'
  )
    throw new RoutingRejected('invalid_trunk');
  const rules = await outboundRules(s, store, nodeId);
  if (rules.length >= 512 && !rules.some((r) => r.id === id))
    throw new RoutingRejected('outbound_limit');
  const conflicts = rules.filter(
    (r) =>
      r.id !== id &&
      r.priority === v.priority &&
      intersects(r.pattern, v.pattern),
  );
  if (conflicts.length)
    throw new RoutingRejected(
      'priority_conflict',
      conflicts
        .slice(0, 10)
        .map((r) => ({ id: r.id, name: r.name, kind: 'outbound' })),
    );
  // Reservation SQL uses exactly the shared claims grammar, independently of route count.
  const domains = [v.pattern, transformedDomain(v)];
  for (const p of domains) {
    const clashes = (
      await s.query<{ id: string; name: string }>(
        `SELECT DISTINCT r.id,r.name FROM public.telephony_number_claims c JOIN public.number_reservations r ON r.id=c.owner_id WHERE c.owner_kind='number_reservations' AND c.installation_id=$1 AND c.digit_length BETWEEN $3 AND $4 AND c.span && int8range(rpad($2,c.digit_length,'0')::bigint,rpad($2,c.digit_length,'9')::bigint+1,'[)') ORDER BY r.id LIMIT 10`,
        [installationId, p.digits, p.minLength, p.maxLength],
      )
    ).rows;
    if (clashes.length) throw new RoutingRejected('reserved_number', clashes);
  }
}
export async function validateOutboundReservation(
  s: ReadSnapshot,
  store: RoutingRepository,
  nodeId: string,
  reservation: Pick<ReservationDto, 'pattern'>,
) {
  const rules = await outboundRules(s, store, nodeId);
  const conflicts = rules.filter(
    (r) =>
      intersects(r.pattern, reservation.pattern) ||
      intersects(transformedDomain(r), reservation.pattern),
  );
  if (conflicts.length)
    throw new RoutingRejected(
      'number_conflict',
      conflicts
        .slice(0, 10)
        .map((r) => ({ id: r.id, name: r.name, kind: 'outbound' })),
    );
}
export async function saveOutbound(
  tx: Transaction,
  store: RoutingRepository,
  nodeId: string,
  installationId: string,
  id: string,
  v: OutboundValues | null,
  old: RoutingDto | null,
  enabled: boolean,
  remove: boolean,
) {
  const actor = tx.context.actor.reference;
  if (!old && v) {
    const k = routeIdentity(installationId, id);
    await tx.query(
      `INSERT INTO public.outbound_rules(id,node_id,installation_id,name,trunk_id,pattern_kind,digits,min_length,max_length,priority,strip_count,add_prefix,source_key,context_hash,watch_identity,attribution_key,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17)`,
      [
        id,
        nodeId,
        installationId,
        v.name,
        v.trunkId,
        v.pattern.kind,
        v.pattern.digits,
        v.pattern.minLength,
        v.pattern.maxLength,
        v.priority,
        v.stripCount,
        v.addPrefix,
        k.sourceKey,
        k.contextHash,
        k.watchIdentity,
        k.attributionKey,
        actor,
      ],
    );
  } else {
    const args: unknown[] = [id, actor, enabled, remove];
    let extra = '';
    if (v) {
      args.push(
        v.name,
        v.trunkId,
        v.pattern.kind,
        v.pattern.digits,
        v.pattern.minLength,
        v.pattern.maxLength,
        v.priority,
        v.stripCount,
        v.addPrefix,
      );
      extra =
        ',name=$5,trunk_id=$6,pattern_kind=$7,digits=$8,min_length=$9,max_length=$10,priority=$11,strip_count=$12,add_prefix=$13';
    }
    await tx.query(
      `UPDATE public.outbound_rules SET updated_by=$2,enabled=$3,version=version+1,updated_at=clock_timestamp(),removed_at=CASE WHEN $4 THEN clock_timestamp() ELSE NULL END${extra} WHERE id=$1`,
      args,
    );
  }
  return (await store.detail(tx, 'outbound', nodeId, id))!;
}
export async function previewOutbound(
  s: ReadSnapshot,
  store: RoutingRepository,
  nodeId: string,
  dialled: string,
): Promise<OutboundPreviewDto> {
  const rules = await outboundRules(s, store, nodeId);
  const matches = rules
    .filter(
      (r) =>
        dialled.startsWith(r.pattern.digits) &&
        dialled.length >= r.pattern.minLength &&
        dialled.length <= r.pattern.maxLength,
    )
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  const result: OutboundPreviewDto = {
    advisory: true,
    callingEligible: false,
    reason: 'no_match',
    rule: null,
    transformed: null,
    resources: rules.map((r) => ({
      id: r.id,
      version: r.version,
      kind: 'rule',
      available: r.enabled,
    })),
    warnings: [
      'Unbound desired route: no tenant ownership or calling permission. Preview has no live effects.',
    ],
  };
  const rule = matches[0];
  if (!rule) return result;
  await validateOutbound(s, store, nodeId, rule.installationId, rule.id, rule);
  const trunk = await new PeerRepository().detail(
    s,
    'trunks',
    nodeId,
    rule.trunkId,
  );
  result.rule = rule;
  result.transformed = rule.addPrefix + dialled.slice(rule.stripCount);
  result.resources.push({
    id: trunk!.id,
    version: trunk!.version,
    kind: 'trunk',
    available: trunk!.enabled,
  });
  result.reason = !rule.enabled
    ? 'disabled_rule'
    : !trunk!.enabled
      ? 'unavailable_trunk'
      : 'matched';
  return result;
}
