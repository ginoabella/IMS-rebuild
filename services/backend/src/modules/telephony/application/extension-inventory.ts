import {
  RuntimeDependencies,
  RetainedRuntimeDependency,
} from './runtime-dependencies';
import { createHash, randomUUID } from 'node:crypto';
import type {
  EndpointKind,
  EndpointProfileDto,
  EndpointSettings,
  InventoryDependencies,
} from '@myims/contracts';
import type { Transaction } from '../../../infrastructure/database/transaction';
import type {
  SnapshotDatabase,
  ReadSnapshot,
} from '../../../infrastructure/database/read-snapshot';
import type {
  ExecutionContext,
  FieldRule,
} from '../../../infrastructure/execution/context';
import type { AuditWrite } from '../../audit/application/audit-write';
import type { TransactionAuthority } from '../../identity/application/transaction-authority';
import {
  principalActor,
  type Principal,
} from '../../identity/application/request-authority';
import {
  InventoryRejected,
  type InventoryFailure,
  object,
  id,
  version,
  name,
  settings,
  endpointKind,
  numbers,
  dependencyKeys,
  dependencies,
  compatible,
  conflict,
  invalid,
  page,
} from '../domain/inventory';
import type { PbxTransactions } from './pbx-nodes';
import type {
  InventoryStore,
  InventoryNode,
  InventoryOperation,
  InventoryVersionPort,
} from './inventory-ports';
export type InventoryResult =
  | InventoryFailure
  | {
      kind: 'found' | 'created' | 'replayed' | 'edited';
      value: Record<string, unknown>;
    };
function bound(value: Record<string, unknown>, max = 65536) {
  if (Buffer.byteLength(JSON.stringify(value)) > max)
    throw new InventoryRejected({ kind: 'unavailable' });
  return value;
}
export class ExtensionInventory implements InventoryVersionPort {
  constructor(
    private readonly transactions: PbxTransactions,
    private readonly database: SnapshotDatabase,
    private readonly authority: TransactionAuthority,
    private readonly store: InventoryStore,
    private readonly audit: AuditWrite,
  ) {}
  private context(
    p: Principal,
    nodeId: string,
    correlationId: string,
  ): ExecutionContext {
    return {
      actor: principalActor(p),
      target: {
        type: 'extension-inventory',
        reference: nodeId,
        tenantId: null,
      },
      correlationId,
    };
  }
  private async handle(
    action: () => Promise<InventoryResult>,
  ): Promise<InventoryResult> {
    try {
      const result = await action();
      if ('value' in result) bound(result.value);
      return result;
    } catch (error) {
      return error instanceof InventoryRejected
        ? error.outcome
        : { kind: 'unavailable' };
    }
  }
  private async node(s: ReadSnapshot, nodeId: string, lock = false) {
    const node = await this.store.node(s, nodeId, lock);
    if (!node) throw new InventoryRejected({ kind: 'missing' });
    return node;
  }
  private async authorized(tx: Transaction, p: Principal) {
    if (
      p.plane !== 'platform' ||
      !p.grants.includes('platform_operator') ||
      !(await this.authority.validate(tx, p))
    )
      throw new InventoryRejected({ kind: 'denied' });
  }
  private async event(
    tx: Transaction,
    change:
      | 'created'
      | 'bulk-created'
      | 'profile-created'
      | 'profile-versioned'
      | 'adopted'
      | 'enabled'
      | 'disabled',
    nodeId: string,
    profileId: string,
    profileVersion: number,
    ids: string[],
    desiredVersion = 1,
  ) {
    const fields: Record<string, FieldRule> = {
      change: {
        kind: 'enum',
        values: [
          'created',
          'bulk-created',
          'profile-created',
          'profile-versioned',
          'adopted',
          'enabled',
          'disabled',
        ],
      },
      nodeId: { kind: 'uuid' },
      profileId: { kind: 'uuid' },
      profileVersion: { kind: 'integer', min: 1, max: 2147483647 },
      desiredVersion: { kind: 'integer', min: 1, max: 2147483647 },
      count: { kind: 'integer', min: 0, max: 50 },
    };
    const data: Record<string, unknown> = {
      change,
      nodeId,
      profileId,
      profileVersion,
      desiredVersion,
      count: ids.length,
    };
    ids.sort().forEach((extensionId, i) => {
      const key = `extension${i + 1}`;
      fields[key] = { kind: 'uuid' };
      data[key] = extensionId;
    });
    await this.audit.append(
      tx,
      { type: 'telephony.inventory.desired-changed', version: 1, fields },
      data,
    );
  }
  private async intent(
    tx: Transaction,
    operation: InventoryOperation,
    requestId: string,
    canonical: unknown,
    action: () => Promise<Record<string, unknown>>,
  ): Promise<InventoryResult> {
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(canonical))
      .digest('hex');
    const receipt = await this.store.receipt(tx, operation, requestId);
    if (receipt) {
      if (receipt.expired) conflict('intent_expired');
      if (receipt.fingerprint !== fingerprint) conflict('request_conflict');
      return { kind: 'replayed', value: receipt.result };
    }
    const result = bound(await action(), 16384);
    await this.store.saveReceipt(tx, operation, requestId, fingerprint, result);
    return { kind: 'created', value: result };
  }
  private async selected(
    s: ReadSnapshot,
    node: InventoryNode,
    kind: EndpointKind,
    d: InventoryDependencies,
    lock = false,
  ) {
    if (node.version !== d.expectedNodeVersion) conflict('dependency_changed');
    const capability = await this.store.capability(
      s,
      node.installationId,
      lock,
    );
    const profile = await this.store.profile(
      s,
      node.id,
      d.profileId,
      d.profileVersion,
      lock,
    );
    if (!profile) throw new InventoryRejected({ kind: 'missing' });
    if (profile.headVersion !== d.expectedProfileHead)
      conflict('dependency_changed');
    if (profile.kind !== kind) invalid('kind');
    compatible(
      capability,
      kind,
      profile.settings,
      d.expectedCapabilityRevision,
    );
    return profile;
  }
  create(
    p: Principal,
    nodeInput: unknown,
    input: unknown,
    correlationId: string,
    single: boolean,
  ): Promise<InventoryResult> {
    return this.handle(async () => {
      const nodeId = id(nodeInput, 'nodeId');
      const data = object(input, [
        ...dependencyKeys,
        'requestId',
        'kind',
        ...(single ? ['number'] : ['numbers', 'range']),
      ]);
      const requestId = id(data.requestId, 'requestId'),
        kind = endpointKind(data.kind),
        set = numbers(data, single),
        d = dependencies(data);
      return this.transactions.run(
        this.context(p, nodeId, correlationId),
        async (tx) => {
          await this.authorized(tx, p);
          return this.intent(
            tx,
            single ? 'extension-create' : 'bulk-create',
            requestId,
            [nodeId, kind, set, d],
            async () => {
              const node = await this.node(tx, nodeId, true),
                profile = await this.selected(tx, node, kind, d, true);
              const collisions = await this.store.collisions(
                tx,
                nodeId,
                set,
                true,
              );
              if (collisions.length)
                throw new InventoryRejected({
                  kind: 'conflict',
                  reason: 'number_conflict',
                  conflicts: {
                    numbers: collisions.slice(0, 10),
                    total: collisions.length,
                    truncated: collisions.length > 10,
                  },
                });
              const extensions = [];
              for (const n of set)
                extensions.push(
                  await this.store.createExtension(
                    tx,
                    node,
                    randomUUID(),
                    n,
                    kind,
                    profile,
                  ),
                );
              await this.event(
                tx,
                single ? 'created' : 'bulk-created',
                nodeId,
                profile.id,
                profile.version,
                extensions.map((e) => e.id),
              );
              return single
                ? { extension: extensions[0] }
                : {
                    operationId: randomUUID(),
                    nodeId,
                    profileId: profile.id,
                    profileVersion: profile.version,
                    items: extensions.map((e) => ({
                      id: e.id,
                      number: e.number,
                      version: e.version,
                    })),
                  };
            },
          );
        },
      );
    });
  }
  preview(nodeInput: unknown, input: unknown): Promise<InventoryResult> {
    return this.handle(async () => {
      const nodeId = id(nodeInput, 'nodeId'),
        data = object(input, [...dependencyKeys, 'kind', 'numbers', 'range']),
        kind = endpointKind(data.kind),
        set = numbers(data, false),
        d = dependencies(data);
      return this.database.read(async (s) => {
        const node = await this.node(s, nodeId);
        await this.selected(s, node, kind, d);
        const collisions = await this.store.collisions(s, nodeId, set);
        if (collisions.length)
          throw new InventoryRejected({
            kind: 'conflict',
            reason: 'number_conflict',
            conflicts: {
              numbers: collisions.slice(0, 10),
              total: collisions.length,
              truncated: collisions.length > 10,
            },
          });
        return {
          kind: 'found',
          value: { nodeId, kind, numbers: set, ...d, advisory: true },
        };
      });
    });
  }
  profileCreate(
    p: Principal,
    nodeInput: unknown,
    profileInput: unknown,
    input: unknown,
    correlationId: string,
  ): Promise<InventoryResult> {
    return this.handle(async () => {
      const nodeId = id(nodeInput, 'nodeId'),
        editing = profileInput !== null,
        profileId = editing ? id(profileInput, 'profileId') : randomUUID();
      const data = object(input, [
        'requestId',
        'name',
        'settings',
        'expectedNodeVersion',
        'expectedCapabilityRevision',
        ...(editing ? ['expectedVersion'] : ['template']),
      ]);
      const requestId = id(data.requestId, 'requestId'),
        label = name(data.name),
        nodeVersion = version(data.expectedNodeVersion),
        capRevision = version(data.expectedCapabilityRevision),
        expected = editing
          ? version(data.expectedVersion, 'expectedVersion')
          : 0;
      let kind: EndpointKind | null = null,
        chosen: EndpointSettings | null = null;
      if (!editing) {
        if (data.template !== 'sip-basic' && data.template !== 'webrtc-basic')
          invalid('kind');
        kind = data.template === 'sip-basic' ? 'sip' : 'webrtc';
        chosen = settings(kind, data.settings);
      } else if (data.settings === undefined) invalid('settings');
      // Stable ordered choices; do not hash raw object key order.
      const choice = editing ? settings('webrtc', data.settings) : null;
      const canonical = [
        nodeId,
        editing ? profileId : null,
        label,
        kind,
        editing ? [choice?.codecs, choice?.maxContacts] : chosen,
        expected,
        nodeVersion,
        capRevision,
      ];
      return this.transactions.run(
        this.context(p, nodeId, correlationId),
        async (tx) => {
          await this.authorized(tx, p);
          return this.intent(
            tx,
            editing ? 'profile-version' : 'profile-create',
            requestId,
            canonical,
            async () => {
              const node = await this.node(tx, nodeId, true);
              if (node.version !== nodeVersion) conflict('dependency_changed');
              const capability = await this.store.capability(
                tx,
                node.installationId,
                true,
              );
              let old: EndpointProfileDto | null = null;
              if (editing) {
                await this.store.lockProfileVersion(tx, nodeId, profileId);
                old = await this.store.profile(tx, nodeId, profileId, null);
                if (!old) throw new InventoryRejected({ kind: 'missing' });
                if (old.headVersion !== expected) conflict('stale_version');
                kind = old.kind;
                chosen = settings(kind, data.settings);
              }
              if (!kind || !chosen) invalid('settings');
              compatible(capability, kind, chosen, capRevision);
              if (
                old &&
                old.name === label &&
                JSON.stringify(old.settings.codecs) ===
                  JSON.stringify(chosen.codecs) &&
                old.settings.maxContacts === chosen.maxContacts &&
                old.capabilityRevision === capRevision
              )
                return { profile: old };
              const profile = old
                ? await this.store.versionProfile(
                    tx,
                    old,
                    label,
                    chosen,
                    capRevision,
                  )
                : await this.store.createProfile(
                    tx,
                    nodeId,
                    profileId,
                    label,
                    kind,
                    chosen,
                    capRevision,
                  );
              await this.event(
                tx,
                old ? 'profile-versioned' : 'profile-created',
                nodeId,
                profile.id,
                profile.version,
                [],
              );
              return { profile };
            },
          );
        },
      );
    });
  }
  async lockUnallocated(
    tx: Transaction,
    nodeId: string,
    extensionId: string,
    expectedVersion: number,
    allowClaimedStatus = false,
  ) {
    id(nodeId, 'nodeId');
    id(extensionId, 'extensionId');
    version(expectedVersion, 'expectedVersion');
    await this.node(tx, nodeId, true);
    const extension = await this.store.extension(tx, nodeId, extensionId, true);
    if (!extension) throw new InventoryRejected({ kind: 'missing' });
    if (extension.version !== expectedVersion) conflict('stale_version');
    if (
      !allowClaimedStatus &&
      (await this.store.hasCurrentClaim(tx, extensionId))
    )
      conflict('tenant_claimed');
    if (extension.availability !== 'available')
      conflict('inventory_ineligible');
    return extension;
  }
  edit(
    p: Principal,
    nodeInput: unknown,
    extensionInput: unknown,
    input: unknown,
    correlationId: string,
    statusOnly: boolean,
  ): Promise<InventoryResult> {
    return this.handle(async () => {
      const nodeId = id(nodeInput, 'nodeId'),
        extensionId = id(extensionInput, 'extensionId'),
        data = object(
          input,
          statusOnly
            ? ['expectedVersion', 'administrativeStatus']
            : ['expectedVersion', ...dependencyKeys],
        ),
        expected = version(data.expectedVersion, 'expectedVersion');
      if (
        statusOnly &&
        data.administrativeStatus !== 'enabled' &&
        data.administrativeStatus !== 'disabled'
      )
        invalid('body');
      const d = statusOnly ? null : dependencies(data);
      return this.transactions.run(
        this.context(p, nodeId, correlationId),
        async (tx) => {
          await this.authorized(tx, p);
          const node = await this.node(tx, nodeId, true);
          // Lock dependencies before extension for adoption. The immutable kind can
          // be read before taking its mutation lock; it cannot change concurrently.
          let profile: EndpointProfileDto | null = null;
          if (d) {
            const current = await this.store.extension(tx, nodeId, extensionId);
            if (!current) throw new InventoryRejected({ kind: 'missing' });
            profile = await this.selected(tx, node, current.kind, d, true);
          }
          const old = await this.lockUnallocated(
            tx,
            nodeId,
            extensionId,
            expected,
            statusOnly,
          );
          if (profile && profile.id !== old.profile.id) {
            try {
              await new RuntimeDependencies().assertUnreferenced(
                tx,
                nodeId,
                'extensions',
                old.id,
              );
            } catch (e) {
              if (e instanceof RetainedRuntimeDependency)
                throw new InventoryRejected({
                  kind: 'conflict',
                  reason: 'dependency_changed',
                });
              throw e;
            }
          }
          const status = statusOnly
            ? data.administrativeStatus === 'enabled'
              ? 'enabled'
              : 'disabled'
            : old.administrativeStatus;
          if (
            status === old.administrativeStatus &&
            (!profile ||
              (old.profile.id === profile.id &&
                old.profile.version === profile.version))
          )
            return { kind: 'edited', value: { extension: old } };
          const extension = await this.store.editExtension(
            tx,
            old,
            profile,
            status,
          );
          await this.event(
            tx,
            statusOnly ? status : 'adopted',
            nodeId,
            extension.profile.id,
            extension.profile.version,
            [extension.id],
            extension.version,
          );
          return { kind: 'edited', value: { extension } };
        },
      );
    });
  }
  list(
    nodeInput: unknown,
    input: unknown,
    profiles: boolean,
  ): Promise<InventoryResult> {
    return this.handle(async () => {
      const nodeId = id(nodeInput, 'nodeId'),
        { limit, after } = page(input);
      return this.database.read(async (s) => {
        const node = await this.node(s, nodeId);
        const capability = profiles
          ? await this.store.capability(s, node.installationId)
          : null;
        const rows = profiles
          ? await this.store.profiles(s, nodeId, limit + 1, after)
          : await this.store.extensions(s, nodeId, limit + 1, after);
        const items = rows.slice(0, limit);
        const metadata = profiles
          ? { nodeVersion: node.version, capability }
          : {};
        while (
          items.length &&
          Buffer.byteLength(
            JSON.stringify({
              items,
              nextCursor: items[items.length - 1]?.id,
              ...metadata,
            }),
          ) > 65536
        )
          items.pop();
        return {
          kind: 'found',
          value: {
            items,
            nextCursor:
              rows.length > items.length
                ? (items[items.length - 1]?.id ?? null)
                : null,
            ...metadata,
          },
        };
      });
    });
  }
  detail(
    nodeInput: unknown,
    resourceInput: unknown,
    profileVersion: unknown = null,
  ): Promise<InventoryResult> {
    return this.handle(async () => {
      const nodeId = id(nodeInput, 'nodeId'),
        resourceId = id(
          resourceInput,
          profileVersion === null ? 'extensionId' : 'profileId',
        );
      const selectedVersion =
        profileVersion === null
          ? null
          : typeof profileVersion === 'string' &&
              /^[1-9][0-9]{0,9}$/.test(profileVersion)
            ? version(Number(profileVersion), 'version')
            : invalid('version');
      return this.database.read(async (s) => {
        await this.node(s, nodeId);
        const value =
          selectedVersion === null
            ? await this.store.extension(s, nodeId, resourceId)
            : await this.store.profile(s, nodeId, resourceId, selectedVersion);
        if (!value) throw new InventoryRejected({ kind: 'missing' });
        return {
          kind: 'found',
          value:
            selectedVersion === null
              ? { extension: value }
              : { profile: value },
        };
      });
    });
  }
}
