import { createHash } from 'node:crypto';
import type { RouteAuthorization } from '@myims/contracts';
import type { SnapshotDatabase } from '../../../infrastructure/database/read-snapshot';
import type { Transaction } from '../../../infrastructure/database/transaction';
import type { TransactionAuthority } from '../../identity/application/transaction-authority';
import {
  principalActor,
  type Principal,
} from '../../identity/application/request-authority';
import type { AuditWrite } from '../../audit/application/audit-write';
import type { PbxTransactions } from './pbx-nodes';
import type { AllocationTenancy } from './allocation-tenancy';
import { RouteBindingRepository } from '../adapters/db/route-binding-repository';
import { PeerRepository } from '../adapters/db/peer-repository';
import { RoutingRepository } from '../adapters/db/routing-repository';
import {
  outboundRules,
  validateOutbound,
} from '../adapters/db/outbound-repository';
import { BindingEvaluator } from './tenant-route-eligibility';
import {
  BindingRejected,
  bindingKind,
  bindingScope,
  evaluatedFacts,
} from '../domain/tenant-route-bindings';
import { PeerRejected, id, object, version, invalid } from '../domain/peer';
import { RoutingRejected } from '../domain/routing';
import { releaseRouteOwnership } from './tenant-route-release';
type Result = { status: number; value: Record<string, unknown> };
export class TenantRouteBindings {
  private readonly store = new RouteBindingRepository();
  constructor(
    private readonly transactions: PbxTransactions,
    private readonly database: SnapshotDatabase,
    private readonly authority: TransactionAuthority,
    private readonly tenancy: AllocationTenancy,
    private readonly audit: AuditWrite,
  ) {}
  private async handle(action: () => Promise<Result>): Promise<Result> {
    try {
      const result = await action();
      if (Buffer.byteLength(JSON.stringify(result.value)) > 65536)
        throw new Error('Bound');
      return result;
    } catch (e) {
      const status =
        e instanceof PeerRejected
          ? e.status
          : e instanceof BindingRejected || e instanceof RoutingRejected
            ? 409
            : 503;
      return {
        status,
        value: {
          statusCode: status,
          message:
            status === 400
              ? 'Review entered fields.'
              : status === 403
                ? 'Access denied'
                : status === 404
                  ? 'Resource not found.'
                  : status === 409
                    ? 'Route binding conflict'
                    : 'Service unavailable',
          ...(e instanceof BindingRejected || e instanceof RoutingRejected
            ? { reason: e.reason, blockers: e.blockers ?? [] }
            : {}),
          ...(e instanceof PeerRejected ? { fieldErrors: e.fieldErrors } : {}),
        },
      };
    }
  }
  private async authorized(tx: Transaction, p: Principal) {
    if (
      p.plane !== 'platform' ||
      !p.grants.includes('platform_operator') ||
      !(await this.authority.validate(tx, p))
    )
      throw new PeerRejected(403);
  }
  private async target(tx: Transaction, tenantId: string, nodeId: string) {
    const tenant = await this.tenancy.read(tx, tenantId, true);
    if (!tenant) throw new PeerRejected(404);
    const node = await new PeerRepository().node(tx, nodeId, true);
    if (!node) throw new PeerRejected(404);
    return { tenant, node };
  }
  private context(p: Principal, tenantId: string, correlationId: string) {
    return {
      actor: principalActor(p),
      target: { type: 'tenant', reference: tenantId, tenantId: null },
      correlationId,
    };
  }
  read(
    p: Principal,
    t: unknown,
    n: unknown,
    selection: boolean,
    query: unknown,
    correlationId: string,
  ) {
    return this.handle(async () => {
      const tenantId = id(t),
        nodeId = id(n),
        q = object(
          query,
          selection
            ? ['kind', 'after', 'limit']
            : ['after', 'limit', 'history'],
        );
      const kind = selection ? bindingKind(q.kind) : null,
        after = q.after === undefined ? null : id(q.after),
        limit = q.limit === undefined ? 25 : Number(q.limit);
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        (q.limit !== undefined && !/^[1-9][0-9]{0,2}$/.test(String(q.limit)))
      )
        invalid('limit');
      if (q.history !== undefined && q.history !== 'true') invalid('history');
      return this.transactions.run(
        this.context(p, tenantId, correlationId),
        async (tx) => {
          await this.authorized(tx, p);
          const { tenant } = await this.target(tx, tenantId, nodeId);
          if (kind) {
            const k = kind === 'permission' ? 'trunks' : kind;
            const rows =
              k === 'dids' || k === 'trunks'
                ? await new PeerRepository().list(
                    tx,
                    k,
                    nodeId,
                    after,
                    limit + 1,
                  )
                : await new RoutingRepository().list(
                    tx,
                    k,
                    nodeId,
                    after,
                    limit + 1,
                  );
            const all = await this.store.all(tx, nodeId);
            const items = rows.slice(0, limit).map((r) => ({
              id: r.id,
              name: r.name,
              version: r.version,
              enabled: 'enabled' in r && r.enabled,
              owner:
                all.find((a) => a.kind === k && a.resourceId === r.id)
                  ?.tenantId ?? null,
              scope:
                all.find((a) => a.kind === k && a.resourceId === r.id)?.scope ??
                null,
            }));
            return {
              status: 200,
              value: {
                items,
                nextCursor: rows.length > limit ? items.at(-1)?.id : null,
                tenant,
                advisory: true,
                callingEligible: false,
              },
            };
          }
          const rows = await this.store.page(
            tx,
            nodeId,
            tenantId,
            after,
            limit + 1,
            q.history === 'true',
          );
          const evaluator = await BindingEvaluator.load(tx, tenantId, nodeId),
            items = [];
          for (const row of rows.slice(0, limit)) {
            const review = await evaluator.review(
              row.kind,
              row.resourceId,
              row.scope,
            );
            if (
              row.state !== 'active' ||
              JSON.stringify(review.evaluated) !== JSON.stringify(row.evaluated)
            ) {
              review.compatible = false;
              review.blockers = review.blockers.slice(0, 9);
              review.blockers.push({
                id: row.id,
                name:
                  row.state === 'revoked'
                    ? 'Authorization revoked'
                    : 'Saved evaluation is stale; preview and save again.',
                kind: 'binding',
              });
            }
            // Stored evaluated facts already identify the reviewed versions; avoid duplicating
            // the complete graph in a bounded list row. POST preview supplies current facts.
            items.push({ ...row, review: { ...review, evaluated: [] } });
          }
          while (
            items.length &&
            Buffer.byteLength(JSON.stringify(items)) > 55000
          )
            items.pop();
          return {
            status: 200,
            value: {
              items,
              nextCursor: rows.length > items.length ? items.at(-1)?.id : null,
              tenant,
              advisory: true,
              callingEligible: false,
            },
          };
        },
      );
    });
  }
  preview(
    p: Principal,
    t: unknown,
    n: unknown,
    input: unknown,
    correlationId: string,
    outbound = false,
  ) {
    return this.handle(async () => {
      const tenantId = id(t),
        nodeId = id(n),
        data = object(
          input,
          outbound ? ['dialled'] : ['kind', 'resourceId', 'scope'],
        );
      const kind = outbound ? null : bindingKind(data.kind),
        resourceId = outbound ? null : id(data.resourceId),
        scope = kind ? bindingScope(data.scope, kind) : 'owned';
      if (
        outbound &&
        (typeof data.dialled !== 'string' ||
          !/^[0-9]{1,15}$/.test(data.dialled))
      )
        invalid('dialled');
      return this.transactions.run(
        this.context(p, tenantId, correlationId),
        async (tx) => {
          await this.authorized(tx, p);
          await this.target(tx, tenantId, nodeId);
          const evaluator = await BindingEvaluator.load(tx, tenantId, nodeId);
          if (kind && resourceId)
            return {
              status: 200,
              value: { ...(await evaluator.review(kind, resourceId, scope)) },
            };
          const dialled = data.dialled as string;
          const bound = evaluator.authorizations.filter(
            (a) => a.kind === 'outbound' && a.tenantId === tenantId,
          );
          const rules = (
            await outboundRules(tx, new RoutingRepository(), nodeId)
          ).filter((r) => bound.some((a) => a.resourceId === r.id));
          const rule = rules
            .filter(
              (r) =>
                dialled.startsWith(r.pattern.digits) &&
                dialled.length >= r.pattern.minLength &&
                dialled.length <= r.pattern.maxLength,
            )
            .sort(
              (a, b) => a.priority - b.priority || a.id.localeCompare(b.id),
            )[0];
          let reason = 'no_match',
            transformed: string | null = null;
          if (rule) {
            reason = !rule.enabled ? 'disabled_rule' : 'incompatible';
            if (rule.enabled) {
              const review = await evaluator.review(
                'outbound',
                rule.id,
                'owned',
              );
              const saved = bound.find((a) => a.resourceId === rule.id)!;
              if (
                review.compatible &&
                JSON.stringify(review.evaluated) ===
                  JSON.stringify(saved.evaluated)
              ) {
                await validateOutbound(
                  tx,
                  new RoutingRepository(),
                  nodeId,
                  rule.installationId,
                  rule.id,
                  rule,
                );
                reason = 'matched';
                transformed = rule.addPrefix + dialled.slice(rule.stripCount);
              }
            }
          }
          return {
            status: 200,
            value: {
              advisory: true,
              callingEligible: false,
              reason,
              rule: rule ?? null,
              transformed,
            },
          };
        },
      );
    });
  }
  write(
    p: Principal,
    t: unknown,
    n: unknown,
    revokeId: unknown,
    input: unknown,
    correlationId: string,
  ) {
    return this.handle(async () => {
      const tenantId = id(t),
        nodeId = id(n),
        revoke = revokeId !== null,
        authorizationId = revoke ? id(revokeId) : null;
      const data = object(input, [
        'requestId',
        'expectedTenantVersion',
        'expectedAuthorityVersion',
        'expectedVersion',
        ...(revoke ? [] : ['kind', 'resourceId', 'scope', 'evaluated']),
      ]);
      const requestId = id(data.requestId),
        tv = version(data.expectedTenantVersion),
        av = version(data.expectedAuthorityVersion),
        expected =
          data.expectedVersion === null && !revoke
            ? null
            : version(data.expectedVersion);
      const kind = revoke ? null : bindingKind(data.kind),
        resourceId = revoke ? null : id(data.resourceId),
        scope = kind ? bindingScope(data.scope, kind) : null,
        evaluated = revoke ? null : evaluatedFacts(data.evaluated);
      const fingerprint = createHash('sha256')
        .update(
          JSON.stringify([
            tenantId,
            nodeId,
            authorizationId,
            tv,
            av,
            expected,
            kind,
            resourceId,
            scope,
            evaluated,
          ]),
        )
        .digest('hex');
      return this.transactions.run(
        this.context(p, tenantId, correlationId),
        async (tx) => {
          await this.authorized(tx, p);
          const receipt = await this.store.receipt(tx, requestId);
          if (receipt) {
            if (receipt.fingerprint !== fingerprint)
              throw new BindingRejected('request_conflict');
            if (receipt.expired) throw new BindingRejected('intent_expired');
            return {
              status: 200,
              value: { ...receipt.result, replayed: true },
            };
          }
          const { tenant, node } = await this.target(tx, tenantId, nodeId);
          if (!['draft', 'active'].includes(tenant.status))
            throw new BindingRejected('tenant_ineligible');
          if (tenant.version !== tv || tenant.authorityVersion !== av)
            throw new BindingRejected('stale_version');
          const all = await this.store.all(tx, nodeId);
          let saved: RouteAuthorization, old: RouteAuthorization | null;
          if (revoke && authorizationId) {
            old = await this.store.detail(tx, authorizationId);
            if (
              !old ||
              old.nodeId !== nodeId ||
              (old.tenantId !== tenantId && old.scope !== 'shared')
            )
              throw new PeerRejected(404);
            if (old.version !== expected)
              throw new BindingRejected('stale_version');
            if (old.state !== 'active')
              throw new BindingRejected('invalid_transition');
            if (['dids', 'groups', 'trunks'].includes(old.kind))
              await releaseRouteOwnership(tx, old);
            saved = await this.store.change(tx, old.id, old.evaluated, true);
          } else {
            if (!kind || !resourceId || !scope || !evaluated)
              throw new PeerRejected(400);
            old =
              all.find(
                (a) =>
                  a.kind === kind &&
                  a.resourceId === resourceId &&
                  (kind !== 'permission' || a.tenantId === tenantId),
              ) ?? null;
            if (
              old &&
              (old.tenantId !== (scope === 'shared' ? null : tenantId) ||
                old.scope !== scope)
            )
              throw new BindingRejected('ownership_conflict');
            if (!old && all.length >= 2048)
              throw new BindingRejected('graph_limit');
            if (old ? old.version !== expected : expected !== null)
              throw new BindingRejected('stale_version');
            const evaluator = await BindingEvaluator.load(tx, tenantId, nodeId),
              review = await evaluator.review(kind, resourceId, scope);
            if (!review.compatible)
              throw new BindingRejected('incompatible', review.blockers);
            if (JSON.stringify(evaluated) !== JSON.stringify(review.evaluated))
              throw new BindingRejected('stale_version');
            saved = old
              ? JSON.stringify(old.evaluated) === JSON.stringify(evaluated)
                ? old
                : await this.store.change(tx, old.id, evaluated, false)
              : await this.store.insert(
                  tx,
                  scope === 'shared' ? null : tenantId,
                  nodeId,
                  node.installationId,
                  kind,
                  resourceId,
                  scope,
                  evaluated,
                );
          }
          if (!old || old.version !== saved.version)
            await this.event(tx, saved, old);
          await this.store.saveReceipt(tx, requestId, fingerprint, [saved]);
          return {
            status: old ? 200 : 201,
            value: { items: [saved], replayed: false },
          };
        },
      );
    });
  }
  private async event(
    tx: Transaction,
    saved: RouteAuthorization,
    old: RouteAuthorization | null,
  ) {
    await this.audit.append(
      tx,
      {
        type: 'telephony.tenant-route.changed',
        version: 1,
        fields: {
          authorizationId: { kind: 'uuid' },
          resourceId: { kind: 'uuid' },
          nodeId: { kind: 'uuid' },
          oldState: { kind: 'enum', values: ['none', 'active'] },
          state: { kind: 'enum', values: ['active', 'revoked'] },
          oldVersion: { kind: 'integer', min: 0, max: 2147483647 },
          version: { kind: 'integer', min: 1, max: 2147483647 },
        },
      },
      {
        authorizationId: saved.id,
        resourceId: saved.resourceId,
        nodeId: saved.nodeId,
        oldState: old?.state ?? 'none',
        state: saved.state,
        oldVersion: old?.version ?? 0,
        version: saved.version,
      },
    );
  }
}
