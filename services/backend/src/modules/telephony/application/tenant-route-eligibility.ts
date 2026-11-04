import type {
  GroupDto,
  InboundDto,
  OutboundDto,
  PeerDto,
  RouteAuthorization,
  RouteAuthorizationKind,
  EvaluatedRouteFact,
  RouteBindingReview,
} from '@myims/contracts';
import type {
  ReadSnapshot,
  SnapshotDatabase,
} from '../../../infrastructure/database/read-snapshot';
import { PeerRepository } from '../adapters/db/peer-repository';
import { RoutingRepository } from '../adapters/db/routing-repository';
import { RouteBindingRepository } from '../adapters/db/route-binding-repository';
import { BindingRejected, sortFacts } from '../domain/tenant-route-bindings';
import type { AllocationTenancy } from './allocation-tenancy';
import type { AllocationTenant, InventoryClaim } from '@myims/contracts';
import { AllocationRepository } from '../adapters/db/allocation-repository';
export interface TenantRouteSnapshot {
  advisory: true;
  callingEligible: false;
  tenant: AllocationTenant;
  nodeId: string;
  installationId: string;
  allocations: InventoryClaim[];
  authorizations: {
    authorization: RouteAuthorization;
    review: RouteBindingReview;
  }[];
  resources: {
    kind: string;
    resource: PeerDto | GroupDto | InboundDto | OutboundDto;
  }[];
}
/** Backend-only primary snapshot. read() also composes with c's locked capture transaction. */
export interface TenantRouteEligibilityPort {
  snapshot(tenantId: string, nodeId: string): Promise<TenantRouteSnapshot>;
  read(
    s: ReadSnapshot,
    tenantId: string,
    nodeId: string,
  ): Promise<TenantRouteSnapshot>;
}
export class TenantRouteEligibility implements TenantRouteEligibilityPort {
  constructor(
    private readonly database: SnapshotDatabase,
    private readonly tenancy: AllocationTenancy,
  ) {}
  snapshot(tenantId: string, nodeId: string) {
    return this.database.read((s) => this.read(s, tenantId, nodeId));
  }
  async read(
    s: ReadSnapshot,
    tenantId: string,
    nodeId: string,
  ): Promise<TenantRouteSnapshot> {
    const tenant = await this.tenancy.read(s, tenantId);
    if (!tenant) throw new BindingRejected('incompatible');
    const evaluator = await BindingEvaluator.load(s, tenantId, nodeId);
    const allocations = await new AllocationRepository().list(
      s,
      tenantId,
      nodeId,
      null,
      2049,
      false,
    );
    if (allocations.length > 2048) throw new BindingRejected('graph_limit');
    const authorizations: TenantRouteSnapshot['authorizations'] = [],
      resources: TenantRouteSnapshot['resources'] = [];
    const seen = new Set<string>();
    for (const authorization of evaluator.authorizations.filter(
      (a) => a.tenantId === tenantId || a.scope === 'shared',
    )) {
      const review = await evaluator.review(
        authorization.kind,
        authorization.resourceId,
        authorization.scope,
      );
      if (
        !['draft', 'active'].includes(tenant.status) ||
        JSON.stringify(review.evaluated) !==
          JSON.stringify(authorization.evaluated)
      ) {
        review.compatible = false;
        review.blockers = review.blockers.slice(0, 9);
        review.blockers.push({
          id: authorization.id,
          name: 'Tenant is ineligible or saved evaluation is stale.',
          kind: 'binding',
        });
      }
      for (const fact of review.evaluated) {
        if (
          [
            'dids',
            'groups',
            'inbound',
            'outbound',
            'trunks',
            'gateways',
          ].includes(fact.kind) &&
          !seen.has(`${fact.kind}:${fact.id}`)
        ) {
          seen.add(`${fact.kind}:${fact.id}`);
          const kind = fact.kind as
            Exclude<RouteAuthorizationKind, 'permission'> | 'gateways';
          // Include disabled facts verbatim; compatibility above remains denied.
          const resource =
            kind === 'groups' || kind === 'inbound' || kind === 'outbound'
              ? await evaluator.routing.detail(s, kind, nodeId, fact.id)
              : await evaluator.peers.detail(s, kind, nodeId, fact.id);
          if (resource && 'enabled' in resource)
            resources.push({ kind, resource });
        }
      }
      authorizations.push({ authorization, review });
    }
    return {
      advisory: true,
      callingEligible: false,
      tenant,
      nodeId,
      installationId: evaluator.installationId,
      allocations,
      authorizations,
      resources,
    };
  }
}
export class BindingEvaluator {
  readonly peers = new PeerRepository();
  readonly routing = new RoutingRepository();
  private facts = new Map<string, EvaluatedRouteFact>();
  private constructor(
    readonly s: ReadSnapshot,
    readonly tenantId: string,
    readonly nodeId: string,
    readonly installationId: string,
    readonly authorizations: RouteAuthorization[],
  ) {}
  static async load(s: ReadSnapshot, tenantId: string, nodeId: string) {
    const node = await new PeerRepository().node(s, nodeId);
    if (!node) throw new BindingRejected('incompatible');
    return new BindingEvaluator(
      s,
      tenantId,
      nodeId,
      node.installationId,
      await new RouteBindingRepository().all(s, nodeId),
    );
  }
  private add(kind: string, id: string, version: number) {
    this.facts.set(`${kind}:${id}`, { kind, id, version });
    if (this.facts.size > 512) throw new BindingRejected('graph_limit');
  }
  private deny(
    id: string,
    kind: string,
    name = 'Missing, disabled, foreign or incompatible resource',
  ): never {
    throw new BindingRejected('incompatible', [{ id, name, kind }]);
  }
  async resource(
    kind: Exclude<RouteAuthorizationKind, 'permission'> | 'gateways',
    id: string,
  ) {
    const r =
      kind === 'groups' || kind === 'inbound' || kind === 'outbound'
        ? await this.routing.detail(this.s, kind, this.nodeId, id)
        : await this.peers.detail(this.s, kind, this.nodeId, id);
    if (r && r.installationId === this.installationId)
      this.add(kind, id, r.version);
    if (
      !r ||
      r.removedAt ||
      !('enabled' in r) ||
      !r.enabled ||
      r.installationId !== this.installationId
    )
      this.deny(id, kind);
    this.add(kind, id, r.version);
    return r as PeerDto | GroupDto | InboundDto | OutboundDto;
  }
  owner(kind: RouteAuthorizationKind, id: string, shared = false) {
    const matches = this.authorizations.filter(
      (a) => a.kind === kind && a.resourceId === id,
    );
    if (matches.length !== 1)
      this.deny(id, kind, 'Explicit current ownership/classification required');
    const a = matches[0]!;
    if (!(
      a.tenantId === this.tenantId ||
      (shared && a.scope === 'shared' && a.tenantId === null)
    ))
      this.deny(id, kind, 'Resource belongs to another tenant');
    this.add('authorization', a.id, a.version);
    return a;
  }
  private async fresh(a: RouteAuthorization) {
    for (const fact of a.evaluated) {
      let actual: number | undefined;
      if (fact.kind === 'authorization')
        actual = this.authorizations.find((a) => a.id === fact.id)?.version;
      else if (fact.kind === 'allocation')
        actual = (
          await this.s.query<{ version: number }>(
            `SELECT version FROM public.tenant_inventory_claims WHERE id=$1 AND state='allocated' AND tenant_id=$2 AND node_id=$3`,
            [fact.id, this.tenantId, this.nodeId],
          )
        ).rows[0]?.version;
      else if (fact.kind === 'extensions')
        actual = (
          await this.s.query<{ version: number }>(
            `SELECT version FROM public.extensions WHERE id=$1 AND node_id=$2 AND installation_id=$3 AND administrative_status='enabled'`,
            [fact.id, this.nodeId, this.installationId],
          )
        ).rows[0]?.version;
      else
        actual = (
          await this.resource(
            fact.kind as
              Exclude<RouteAuthorizationKind, 'permission'> | 'gateways',
            fact.id,
          )
        ).version;
      if (actual !== fact.version)
        this.deny(
          a.id,
          'binding',
          'Dependent ownership/evaluation is stale; review it first',
        );
      this.add(fact.kind, fact.id, fact.version);
    }
  }
  private async owned(
    kind: RouteAuthorizationKind,
    id: string,
    shared = false,
  ) {
    const a = this.owner(kind, id, shared);
    await this.fresh(a);
    return a;
  }
  private async extension(id: string) {
    const r = (
      await this.s.query<{
        version: number;
        claimId: string;
        claimVersion: number;
      }>(
        `SELECT e.version,c.id AS "claimId",c.version AS "claimVersion" FROM public.extensions e JOIN public.tenant_inventory_claims c ON c.extension_id=e.id AND c.state='allocated' AND c.tenant_id=$2 WHERE e.id=$1 AND e.node_id=$3 AND e.installation_id=$4 AND e.administrative_status='enabled'`,
        [id, this.tenantId, this.nodeId, this.installationId],
      )
    ).rows[0];
    if (!r)
      this.deny(
        id,
        'extensions',
        'Enabled allocated extension for this tenant required',
      );
    this.add('extensions', id, r.version);
    this.add('allocation', r.claimId, r.claimVersion);
  }
  private async groups(root: string, requireRootOwner: boolean) {
    const seen = new Set<string>();
    let current: string | null = root;
    while (current) {
      if (seen.has(current) || seen.size >= 512)
        this.deny(current, 'groups', 'Missing or cyclic fallback graph');
      seen.add(current);
      const g = (await this.resource('groups', current)) as GroupDto;
      if (requireRootOwner || current !== root)
        await this.owned('groups', current);
      for (const member of g.memberIds) await this.extension(member);
      if (g.fallback.kind === 'extension') await this.extension(g.fallback.id);
      current = g.fallback.kind === 'group' ? g.fallback.id : null;
    }
  }
  async review(
    kind: RouteAuthorizationKind,
    resourceId: string,
    scope: 'owned' | 'shared',
  ): Promise<RouteBindingReview> {
    this.facts = new Map();
    const currentVersion =
      this.authorizations.find(
        (a) =>
          a.kind === kind &&
          a.resourceId === resourceId &&
          (kind !== 'permission' || a.tenantId === this.tenantId),
      )?.version ?? null;
    try {
      const existing = this.authorizations.filter(
        (a) =>
          a.kind === kind &&
          a.resourceId === resourceId &&
          (kind !== 'permission' || a.tenantId === this.tenantId),
      );
      if (
        existing.some(
          (a) =>
            a.tenantId !== (scope === 'shared' ? null : this.tenantId) ||
            a.scope !== scope,
        )
      )
        throw new BindingRejected('ownership_conflict', [
          {
            id: resourceId,
            name: 'Existing ownership/classification conflicts',
            kind,
          },
        ]);
      const resource = await this.resource(
        kind === 'permission' ? 'trunks' : kind,
        resourceId,
      );
      if (kind === 'dids') {
        if (!('gatewayId' in resource)) this.deny(resourceId, kind);
        await this.gateway(resource.gatewayId);
      } else if (kind === 'groups') await this.groups(resourceId, false);
      else if (kind === 'inbound') {
        const rule = resource as InboundDto;
        if (!rule.didId)
          this.deny(
            resourceId,
            kind,
            'Gateway catch-all is platform-only; select an exact DID rule',
          );
        await this.gateway(rule.gatewayId);
        const did = await this.resource('dids', rule.didId);
        if (!('gatewayId' in did) || did.gatewayId !== rule.gatewayId)
          this.deny(rule.didId, 'dids');
        await this.owned('dids', rule.didId);
        if (rule.destination.kind === 'extension')
          await this.extension(rule.destination.id);
        if (rule.destination.kind === 'group')
          await this.groups(rule.destination.id, true);
      } else if (
        kind === 'trunks' ||
        kind === 'permission' ||
        kind === 'outbound'
      ) {
        const trunk =
          kind === 'outbound'
            ? await this.resource('trunks', (resource as OutboundDto).trunkId)
            : resource;
        if (!('direction' in trunk) || trunk.direction === 'inbound')
          this.deny(trunk.id, 'trunks');
        if (kind !== 'trunks') await this.owned('trunks', trunk.id, true);
        if (kind === 'outbound') {
          const grants = this.authorizations.filter(
            (a) =>
              a.kind === 'permission' &&
              a.resourceId === trunk.id &&
              a.tenantId === this.tenantId,
          );
          if (grants.length !== 1)
            this.deny(
              trunk.id,
              'trunks',
              'Explicit tenant trunk permission required',
            );
          this.add('authorization', grants[0]!.id, grants[0]!.version);
          await this.fresh(grants[0]!);
        }
      }
      return {
        advisory: true,
        callingEligible: false,
        compatible: true,
        currentVersion,
        evaluated: sortFacts([...this.facts.values()]),
        blockers: [],
      };
    } catch (e) {
      if (!(e instanceof BindingRejected)) throw e;
      return {
        advisory: true,
        callingEligible: false,
        compatible: false,
        currentVersion,
        evaluated: sortFacts([...this.facts.values()]),
        blockers: e.blockers.length
          ? e.blockers
          : [{ id: resourceId, name: e.reason, kind }],
      };
    }
  }
  private async gateway(id: string) {
    const gateway = await this.resource('gateways', id);
    if (!('trunkId' in gateway)) this.deny(id, 'gateways');
    if (gateway.trunkId) {
      const trunk = await this.resource('trunks', gateway.trunkId);
      if (!('direction' in trunk) || trunk.direction === 'outbound')
        this.deny(trunk.id, 'trunks');
    }
  }
}
