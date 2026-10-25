import type { ReadSnapshot } from '../../../../infrastructure/database/read-snapshot';
import type { RevisionSnapshot } from '../../domain/revision-snapshot';
import {
  SNAPSHOT_LIMIT,
  entries,
  canonical,
} from '../../domain/revision-snapshot';
import { RoutingRejected } from '../../domain/routing';
// Each collection is bounded before aggregation. All subqueries share ONE statement
// snapshot, including profiles, membership, source hosts and credential availability.
const collection = (sql: string) =>
  `(SELECT COALESCE(jsonb_agg(to_jsonb(x)),'[]') FROM (${sql} LIMIT ${SNAPSHOT_LIMIT + 1}) x)`;
const common = `id,version,name,enabled`;
const destination = (prefix: string) =>
  `CASE WHEN ${prefix}_extension_id IS NOT NULL THEN jsonb_build_object('kind','extension','id',${prefix}_extension_id) WHEN ${prefix}_group_id IS NOT NULL THEN jsonb_build_object('kind','group','id',${prefix}_group_id) ELSE '{"kind":"hangup"}'::jsonb END`;
const identity = `jsonb_build_object('sourceKey',source_key,'contextHash',context_hash,'watchIdentity',watch_identity,'attributionKey',attribution_key) AS identity`;
const pattern = `jsonb_build_object('kind',pattern_kind,'digits',digits,'minLength',min_length,'maxLength',max_length) AS pattern`;
const current = `WHERE node_id=$1 AND removed_at IS NULL ORDER BY id`;
export async function captureSnapshot(
  s: ReadSnapshot,
  nodeId: string,
): Promise<RevisionSnapshot> {
  const row = (
    await s.query<{ snapshot: RevisionSnapshot }>(
      `SELECT jsonb_build_object(
 'eligibility',jsonb_build_object('allocations','unavailable','bindings','unavailable','sharedTrunkPermissions','unavailable'),
 'node',(SELECT jsonb_build_object('id',id,'version',version,'installationId',installation_id) FROM public.pbx_nodes WHERE id=$1),
 'capability',(SELECT jsonb_build_object('id',c.installation_id,'version',c.revision,'kinds',c.kinds,'signaling',c.signaling,'codecs',c.codecs,'media',c.media) FROM public.endpoint_capabilities c JOIN public.pbx_nodes n ON n.installation_id=c.installation_id WHERE n.id=$1),
 'profiles',${collection(`SELECT p.profile_id AS id,p.version,p.name,p.kind,p.settings,p.capability_revision AS "capabilityRevision" FROM public.endpoint_profile_versions p JOIN public.endpoint_profiles h ON h.id=p.profile_id WHERE p.node_id=$1 AND (p.version=h.head_version OR EXISTS(SELECT 1 FROM public.extensions e WHERE e.profile_id=p.profile_id AND e.profile_version=p.version)) ORDER BY p.profile_id,p.version`)},
 'extensions',${collection(`SELECT id,version,number,kind,profile_id AS "profileId",profile_version AS "profileVersion",administrative_status AS "administrativeStatus",credential_generation_id AS "generationId",endpoint_key AS "endpointKey",auth_key AS "authKey",aor_key AS "aorKey" FROM public.extensions WHERE node_id=$1 ORDER BY id`)},
 'trunks',${collection(`SELECT ${common},direction,settings FROM public.sip_trunks ${current}`)},
 'gateways',${collection(`SELECT ${common},kind,trunk_id AS "trunkId",ARRAY(SELECT host(address) FROM public.sip_gateway_sources g WHERE g.gateway_id=sip_gateways.id AND g.removed_at IS NULL ORDER BY host(address)) AS "sourceAddresses" FROM public.sip_gateways ${current}`)},
 'dids',${collection(`SELECT ${common},number,gateway_id AS "gatewayId" FROM public.sip_dids ${current}`)},
 'groups',${collection(`SELECT ${common},number,strategy,timeout,ARRAY(SELECT extension_id FROM public.ring_group_members m WHERE m.group_id=ring_groups.id ORDER BY position) AS "memberIds",${destination('fallback')} AS fallback FROM public.ring_groups ${current}`)},
 'reservations',${collection(`SELECT id,version,name,purpose,${pattern} FROM public.number_reservations ${current}`)},
 'inbound',${collection(`SELECT ${common},gateway_id AS "gatewayId",did_id AS "didId",${destination('destination')} AS destination,${identity} FROM public.inbound_rules ${current}`)},
 'outbound',${collection(`SELECT ${common},${pattern},priority,trunk_id AS "trunkId",strip_count AS "stripCount",add_prefix AS "addPrefix",${identity} FROM public.outbound_rules ${current}`)},
 'credentials',${collection(`SELECT o.generation_id AS id,o.ordinal AS version,(o.state='associated' AND o.material_health='verified') AS available,'endpoint'::text AS purpose FROM public.endpoint_credential_operations o JOIN public.extensions e ON e.credential_generation_id=o.generation_id WHERE e.node_id=$1 UNION ALL SELECT c.id,v.material_version AS version,(c.available AND v.available) AS available,c.purpose FROM public.sip_credentials c JOIN public.sip_credential_versions v ON v.credential_id=c.id WHERE EXISTS(SELECT 1 FROM public.sip_trunks t WHERE t.node_id=$1 AND t.removed_at IS NULL AND t.settings->'credential'->>'id'=c.id::text AND (t.settings->'credential'->>'version')::integer=v.material_version) ORDER BY id,version`)}
 ) AS snapshot`,
      [nodeId],
    )
  ).rows[0]?.snapshot;
  if (!row?.node) throw new RoutingRejected('node_missing');
  if (
    entries(row).length > SNAPSHOT_LIMIT ||
    Buffer.byteLength(canonical(row)) > 4 * 1024 * 1024
  )
    throw new RoutingRejected('snapshot_limit');
  return row;
}
