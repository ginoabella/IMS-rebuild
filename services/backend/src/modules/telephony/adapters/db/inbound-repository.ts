import type {
  GroupDto,
  InboundDto,
  InboundValues,
  RoutingDto,
  InboundPreviewDto,
} from '@myims/contracts';
import type { ReadSnapshot } from '../../../../infrastructure/database/read-snapshot';
import type { Transaction } from '../../../../infrastructure/database/transaction';
import type { RoutingRepository } from './routing-repository';
import { RoutingRejected, validateGraph } from '../../domain/routing';
import { routeIdentity } from '../../domain/route-identity';
import { PeerRepository } from './peer-repository';
export const inboundSelect = `SELECT id,node_id AS "nodeId",installation_id AS "installationId",name,enabled,version,created_at AS "createdAt",updated_at AS "updatedAt",created_by AS "createdBy",updated_by AS "updatedBy",removed_at AS "removedAt",gateway_id AS "gatewayId",did_id AS "didId",CASE WHEN destination_group_id IS NOT NULL THEN jsonb_build_object('kind','group','id',destination_group_id) WHEN destination_extension_id IS NOT NULL THEN jsonb_build_object('kind','extension','id',destination_extension_id) ELSE jsonb_build_object('kind','hangup') END AS destination FROM public.inbound_rules`;
export async function validateInbound(
  s: ReadSnapshot,
  store: RoutingRepository,
  nodeId: string,
  installationId: string,
  id: string,
  v: InboundValues,
) {
  const peers = new PeerRepository();
  const gateway = await peers.detail(s, 'gateways', nodeId, v.gatewayId);
  if (
    !gateway ||
    gateway.removedAt ||
    gateway.installationId !== installationId
  )
    throw new RoutingRejected('invalid_gateway');
  if (v.didId) {
    const did = await peers.detail(s, 'dids', nodeId, v.didId);
    if (
      !did ||
      did.removedAt ||
      !('gatewayId' in did) ||
      did.gatewayId !== v.gatewayId ||
      did.installationId !== installationId
    )
      throw new RoutingRejected('invalid_did');
  }
  const clashes = (
    await s.query<{ id: string; name: string }>(
      `SELECT id,name FROM public.inbound_rules WHERE gateway_id=$1 AND did_id IS NOT DISTINCT FROM $2::uuid AND id<>$3 AND removed_at IS NULL ORDER BY id LIMIT 10`,
      [v.gatewayId, v.didId, id],
    )
  ).rows;
  if (clashes.length) throw new RoutingRejected('selector_conflict', clashes);
  if (v.destination.kind === 'extension') {
    if (
      !(
        await s.query(
          'SELECT id FROM public.extensions WHERE id=$1 AND node_id=$2 AND installation_id=$3',
          [v.destination.id, nodeId, installationId],
        )
      ).rows.length
    )
      throw new RoutingRejected('invalid_extension');
  } else if (v.destination.kind === 'group') {
    // Reuse the shared graph bound/cycle check once, then validate every reachable
    // member/fallback in one canonical query rather than reloading the graph per hop.
    const groups = (await store.list(
      s,
      'groups',
      nodeId,
      null,
      513,
    )) as GroupDto[];
    validateGraph(groups);
    const all = new Map(groups.map((g) => [g.id, g]));
    let current = all.get(v.destination.id);
    if (!current) throw new RoutingRejected('invalid_group');
    const extensionIds = new Set<string>();
    while (current) {
      if (current.installationId !== installationId)
        throw new RoutingRejected('invalid_group');
      for (const member of current.memberIds) extensionIds.add(member);
      const fallback: GroupDto['fallback'] = current.fallback;
      if (fallback.kind === 'extension') extensionIds.add(fallback.id);
      if (fallback.kind !== 'group') break;
      current = all.get(fallback.id);
      if (!current) throw new RoutingRejected('invalid_group');
    }
    const extensions = await s.query<{ id: string }>(
      'SELECT id FROM public.extensions WHERE node_id=$1 AND installation_id=$2 AND id=ANY($3::uuid[])',
      [nodeId, installationId, [...extensionIds]],
    );
    if (extensions.rows.length !== extensionIds.size)
      throw new RoutingRejected('invalid_extension');
  }
}
export async function saveInbound(
  tx: Transaction,
  store: RoutingRepository,
  nodeId: string,
  installationId: string,
  id: string,
  v: InboundValues | null,
  old: RoutingDto | null,
  enabled: boolean,
  remove: boolean,
) {
  const actor = tx.context.actor.reference;
  if (!old && v) {
    const keys = routeIdentity(installationId, id);
    await tx.query(
      `INSERT INTO public.inbound_rules(id,node_id,installation_id,name,gateway_id,did_id,destination_extension_id,destination_group_id,source_key,context_hash,watch_identity,attribution_key,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)`,
      [
        id,
        nodeId,
        installationId,
        v.name,
        v.gatewayId,
        v.didId,
        v.destination.kind === 'extension' ? v.destination.id : null,
        v.destination.kind === 'group' ? v.destination.id : null,
        keys.sourceKey,
        keys.contextHash,
        keys.watchIdentity,
        keys.attributionKey,
        actor,
      ],
    );
  } else {
    const args: unknown[] = [id, actor, enabled, remove];
    let extra = '';
    if (v) {
      args.push(
        v.name,
        v.gatewayId,
        v.didId,
        v.destination.kind === 'extension' ? v.destination.id : null,
        v.destination.kind === 'group' ? v.destination.id : null,
      );
      extra =
        ',name=$5,gateway_id=$6,did_id=$7,destination_extension_id=$8,destination_group_id=$9';
    }
    await tx.query(
      `UPDATE public.inbound_rules SET updated_by=$2,enabled=$3,version=version+1,updated_at=clock_timestamp(),removed_at=CASE WHEN $4 THEN clock_timestamp() ELSE NULL END${extra} WHERE id=$1`,
      args,
    );
  }
  return (await store.detail(tx, 'inbound', nodeId, id))!;
}
export async function previewInbound(
  s: ReadSnapshot,
  store: RoutingRepository,
  nodeId: string,
  gatewayId: string,
  dialled: string,
): Promise<InboundPreviewDto> {
  const result: InboundPreviewDto = {
    advisory: true,
    callingEligible: false,
    reason: 'unknown_ingress',
    rule: null,
    precedence: null,
    resources: [],
    warnings: [
      'Unbound desired route: no tenant attribution or calling eligibility. Preview has no live effects.',
    ],
  };
  const peers = new PeerRepository();
  const gateway = await peers.detail(s, 'gateways', nodeId, gatewayId);
  if (!gateway || gateway.removedAt) return result;
  result.resources.push({
    id: gateway.id,
    version: gateway.version,
    kind: 'gateway',
    available: gateway.enabled,
  });
  if ('trunkId' in gateway && gateway.trunkId) {
    const trunk = await peers.detail(s, 'trunks', nodeId, gateway.trunkId);
    if (trunk)
      result.resources.push({
        id: trunk.id,
        version: trunk.version,
        kind: 'trunk',
        available: trunk.enabled && !trunk.removedAt,
      });
  }
  const match = (
    await s.query<{ id: string; exact: boolean }>(
      `SELECT r.id,(r.did_id IS NOT NULL) AS exact FROM public.inbound_rules r LEFT JOIN public.sip_dids d ON d.id=r.did_id WHERE r.node_id=$1 AND r.gateway_id=$2 AND r.removed_at IS NULL AND (r.did_id IS NULL OR (d.number=$3 AND d.removed_at IS NULL)) ORDER BY (r.did_id IS NOT NULL) DESC LIMIT 1`,
      [nodeId, gatewayId, dialled],
    )
  ).rows[0];
  if (!match) {
    result.reason = 'no_match';
    return result;
  }
  const rule = (await store.detail(
    s,
    'inbound',
    nodeId,
    match.id,
  )) as InboundDto;
  await validateInbound(s, store, nodeId, rule.installationId, rule.id, rule);
  result.rule = rule;
  result.precedence = match.exact ? 'exact' : 'catch_all';
  result.reason = rule.enabled ? 'matched' : 'disabled_rule';
  result.resources.push({
    id: rule.id,
    version: rule.version,
    kind: 'rule',
    available: rule.enabled,
  });
  if (rule.didId) {
    const d = await peers.detail(s, 'dids', nodeId, rule.didId);
    if (d)
      result.resources.push({
        id: d.id,
        version: d.version,
        kind: 'did',
        available: d.enabled,
      });
  }
  if (rule.destination.kind === 'group') {
    const g = (await store.detail(
      s,
      'groups',
      nodeId,
      rule.destination.id,
    )) as GroupDto;
    const p = await store.preview(s, nodeId, g, g.id);
    result.resources.push(...p.resources);
  } else if (rule.destination.kind === 'extension') {
    const e = (
      await s.query<{ id: string; version: number; available: boolean }>(
        `SELECT id,version,administrative_status='enabled' AS available FROM public.extensions WHERE id=$1`,
        [rule.destination.id],
      )
    ).rows[0];
    if (e) result.resources.push({ ...e, kind: 'extension' });
  }
  if (result.resources.some((r) => !r.available))
    result.warnings.push(
      'Disabled dependencies or rule: unavailable for eventual apply.',
    );
  return result;
}
