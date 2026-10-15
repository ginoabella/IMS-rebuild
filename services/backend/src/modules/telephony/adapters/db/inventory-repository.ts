import type {
  EndpointKind,
  EndpointSettings,
  EndpointProfileDto,
  ExtensionDto,
} from '@myims/contracts';
import type { Transaction } from '../../../../infrastructure/database/transaction';
import type { ReadSnapshot } from '../../../../infrastructure/database/read-snapshot';
import type { EndpointCapability } from '../../domain/inventory';
import { conflict, inventoryEligibility } from '../../domain/inventory';
import type {
  InventoryStore,
  InventoryNode,
  InventoryReceipt,
  InventoryOperation,
} from '../../application/inventory-ports';
interface ProfileRow {
  id: string;
  node_id: string;
  kind: EndpointKind;
  name: string;
  version: number;
  head_version: number;
  settings: EndpointSettings;
  capability_revision: number;
  created_at: Date;
  created_by: string;
}
interface ExtensionRow {
  id: string;
  node_id: string;
  number: string;
  kind: EndpointKind;
  profile_id: string;
  profile_version: number;
  administrative_status: 'enabled' | 'disabled';
  version: number;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by: string;
}
function profileDto(r: ProfileRow): EndpointProfileDto {
  return {
    id: r.id,
    nodeId: r.node_id,
    kind: r.kind,
    name: r.name,
    version: r.version,
    headVersion: r.head_version,
    settings: r.settings,
    capabilityRevision: r.capability_revision,
    createdAt: r.created_at.toISOString(),
    createdBy: r.created_by,
  };
}
function extensionDto(r: ExtensionRow): ExtensionDto {
  return {
    id: r.id,
    nodeId: r.node_id,
    number: r.number,
    kind: r.kind,
    profile: { id: r.profile_id, version: r.profile_version },
    administrativeStatus: r.administrative_status,
    version: r.version,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
    createdBy: r.created_by,
    updatedBy: r.updated_by,
    availability: 'available',
    credentials: { kind: 'unset' },
    readiness: { kind: 'not_established' },
    observation: { kind: 'not_available' },
    eligibility: inventoryEligibility(r.administrative_status),
  };
}
const profileSelect = `SELECT p.id,p.head_version,v.* FROM public.endpoint_profiles p JOIN public.endpoint_profile_versions v ON v.profile_id=p.id`;
export class InventoryRepository implements InventoryStore {
  async node(s: ReadSnapshot, id: string, lock = false) {
    const r = await s.query<InventoryNode>(
      `SELECT id,installation_id AS "installationId",version FROM public.pbx_nodes WHERE id=$1${lock ? ' FOR SHARE' : ''}`,
      [id],
    );
    return r.rows[0] ?? null;
  }
  async capability(s: ReadSnapshot, installationId: string, lock = false) {
    const r = await s.query<EndpointCapability>(
      `SELECT installation_id AS "installationId",revision,kinds,signaling,codecs,media FROM public.endpoint_capabilities WHERE installation_id=$1${lock ? ' FOR SHARE' : ''}`,
      [installationId],
    );
    return r.rows[0] ?? null;
  }
  async profile(
    s: ReadSnapshot,
    nodeId: string,
    id: string,
    version: number | null,
    lock = false,
  ) {
    // Lock head independently of the selected immutable version. Version writers
    // acquire FOR UPDATE before inserts; extension commits use compatible SHARE.
    if (lock)
      await s.query(
        'SELECT id FROM public.endpoint_profiles WHERE node_id=$1 AND id=$2 FOR SHARE',
        [nodeId, id],
      );
    const r = await s.query<ProfileRow>(
      `${profileSelect} WHERE p.node_id=$1 AND p.id=$2 AND v.version=COALESCE($3,p.head_version)`,
      [nodeId, id, version],
    );
    return r.rows[0] ? profileDto(r.rows[0]) : null;
  }
  async lockProfileVersion(tx: Transaction, nodeId: string, id: string) {
    await tx.query(
      'SELECT id FROM public.endpoint_profiles WHERE node_id=$1 AND id=$2 FOR UPDATE',
      [nodeId, id],
    );
  }
  async profiles(
    s: ReadSnapshot,
    nodeId: string,
    limit: number,
    after: string | null,
  ) {
    return (
      await s.query<ProfileRow>(
        `${profileSelect} WHERE p.node_id=$1 AND v.version=p.head_version AND ($2::uuid IS NULL OR p.id>$2) ORDER BY p.id LIMIT $3`,
        [nodeId, after, limit],
      )
    ).rows.map(profileDto);
  }
  private async profileNameLock(
    tx: Transaction,
    nodeId: string,
    name: string,
    id: string,
  ) {
    // Match PostgreSQL's case folding, including Unicode, for coordination.
    await tx.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('profile-name:'||$1||':'||lower($2),0))",
      [nodeId, name],
    );
    const duplicate = await tx.query(
      'SELECT id FROM public.endpoint_profiles WHERE node_id=$1 AND lower(name)=lower($2) AND id<>$3',
      [nodeId, name, id],
    );
    if (duplicate.rows.length) conflict('profile_name_conflict');
  }
  async createProfile(
    tx: Transaction,
    nodeId: string,
    id: string,
    name: string,
    kind: EndpointKind,
    settings: EndpointSettings,
    capabilityRevision: number,
  ) {
    await this.profileNameLock(tx, nodeId, name, id);
    await tx.query(
      'INSERT INTO public.endpoint_profiles(id,node_id,kind,name,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$5)',
      [id, nodeId, kind, name, tx.context.actor.reference],
    );
    await tx.query(
      'INSERT INTO public.endpoint_profile_versions(profile_id,version,node_id,kind,name,settings,capability_revision,created_by) VALUES($1,1,$2,$3,$4,$5,$6,$7)',
      [
        id,
        nodeId,
        kind,
        name,
        settings,
        capabilityRevision,
        tx.context.actor.reference,
      ],
    );
    return (await this.profile(tx, nodeId, id, 1))!;
  }
  async versionProfile(
    tx: Transaction,
    old: EndpointProfileDto,
    name: string,
    settings: EndpointSettings,
    capabilityRevision: number,
  ) {
    await this.profileNameLock(tx, old.nodeId, name, old.id);
    await tx.query(
      'INSERT INTO public.endpoint_profile_versions(profile_id,version,node_id,kind,name,settings,capability_revision,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        old.id,
        old.headVersion + 1,
        old.nodeId,
        old.kind,
        name,
        settings,
        capabilityRevision,
        tx.context.actor.reference,
      ],
    );
    await tx.query(
      'UPDATE public.endpoint_profiles SET name=$2,head_version=head_version+1,updated_at=clock_timestamp(),updated_by=$3 WHERE id=$1',
      [old.id, name, tx.context.actor.reference],
    );
    return (await this.profile(tx, old.nodeId, old.id, old.headVersion + 1))!;
  }
  async extension(s: ReadSnapshot, nodeId: string, id: string, lock = false) {
    const r = await s.query<ExtensionRow>(
      `SELECT * FROM public.extensions WHERE node_id=$1 AND id=$2${lock ? ' FOR UPDATE' : ''}`,
      [nodeId, id],
    );
    return r.rows[0] ? extensionDto(r.rows[0]) : null;
  }
  async extensions(
    s: ReadSnapshot,
    nodeId: string,
    limit: number,
    after: string | null,
  ) {
    return (
      await s.query<ExtensionRow>(
        'SELECT * FROM public.extensions WHERE node_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3',
        [nodeId, after, limit],
      )
    ).rows.map(extensionDto);
  }
  async collisions(
    s: ReadSnapshot,
    nodeId: string,
    numbers: string[],
    lock = false,
  ) {
    if (lock)
      for (const n of numbers)
        await s.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `extension-number:${nodeId}:${n}`,
        ]);
    return (
      await s.query<{ number: string }>(
        'SELECT number FROM public.extensions WHERE node_id=$1 AND number=ANY($2::text[]) ORDER BY number::integer',
        [nodeId, numbers],
      )
    ).rows.map((r) => r.number);
  }
  async createExtension(
    tx: Transaction,
    node: InventoryNode,
    id: string,
    number: string,
    kind: EndpointKind,
    profile: EndpointProfileDto,
  ) {
    const key = `${node.installationId.replaceAll('-', '')}-${id.replaceAll('-', '')}`;
    const r = await tx.query<ExtensionRow>(
      'INSERT INTO public.extensions(id,node_id,installation_id,number,kind,profile_id,profile_version,endpoint_key,auth_key,aor_key,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING *',
      [
        id,
        node.id,
        node.installationId,
        number,
        kind,
        profile.id,
        profile.version,
        `ims-e-${key}`,
        `ims-a-${key}`,
        `ims-r-${key}`,
        tx.context.actor.reference,
      ],
    );
    return extensionDto(r.rows[0]!);
  }
  async editExtension(
    tx: Transaction,
    old: ExtensionDto,
    profile: EndpointProfileDto | null,
    status: ExtensionDto['administrativeStatus'],
  ) {
    const r = await tx.query<ExtensionRow>(
      'UPDATE public.extensions SET profile_id=$2,profile_version=$3,administrative_status=$4,version=version+1,updated_at=clock_timestamp(),updated_by=$5 WHERE id=$1 RETURNING *',
      [
        old.id,
        profile?.id ?? old.profile.id,
        profile?.version ?? old.profile.version,
        status,
        tx.context.actor.reference,
      ],
    );
    return extensionDto(r.rows[0]!);
  }
  async receipt(
    tx: Transaction,
    operation: InventoryOperation,
    requestId: string,
  ) {
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `inventory-intent:${tx.context.actor.reference}:${operation}:${requestId}`,
    ]);
    return (
      (
        await tx.query<InventoryReceipt>(
          "SELECT fingerprint,result,created_at<=clock_timestamp()-interval '30 days' AS expired FROM public.inventory_receipts WHERE operator_id=$1 AND operation=$2 AND request_id=$3",
          [tx.context.actor.reference, operation, requestId],
        )
      ).rows[0] ?? null
    );
  }
  async saveReceipt(
    tx: Transaction,
    operation: InventoryOperation,
    requestId: string,
    fingerprint: string,
    result: Record<string, unknown>,
  ) {
    await tx.query(
      'INSERT INTO public.inventory_receipts(operator_id,operation,request_id,fingerprint,result,correlation_id) VALUES($1,$2,$3,$4,$5,$6)',
      [
        tx.context.actor.reference,
        operation,
        requestId,
        fingerprint,
        result,
        tx.context.correlationId,
      ],
    );
  }
}
