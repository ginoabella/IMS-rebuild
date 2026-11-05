import type {
  ReadSnapshot,
  SnapshotDatabase,
} from '../../../infrastructure/database/read-snapshot';
import type { TenantVerificationView } from '@myims/contracts';
import { captureSnapshot } from '../adapters/db/revision-snapshot';
import { tenantRouting } from '../domain/tenant-routing';
import {
  currentTenantRuntime,
  type TenantVerification,
} from './tenant-verification';

export interface TenantRoutingEvidenceSnapshot {
  tenantId: string;
  nodeId: string;
  installationId: string;
  readiness: TenantVerificationView['readiness'];
  provenance: {
    artifactId: string;
    revisionId: string;
    sourceDigest: string;
    runtimeGeneration: number;
  } | null;
  verifiedExtensions: {
    extensionId: string;
    extensionVersion: number;
    allocationId: string;
    allocationVersion: number;
    inboundTestId: string;
    outboundTestId: string;
    permissions: { id: string; version: number; trunkId: string }[];
  }[];
}
/** Backend-only read port. Assignment writers must recheck within their locked transaction.
 * A tenant-level ready result does not prove every allocated extension was tested.
 * No lifecycle, assignment or ordinary-call authority is conferred by this projection.
 */
export interface TenantRoutingEvidencePort {
  snapshot(
    tenantId: string,
    nodeId: string,
  ): Promise<TenantRoutingEvidenceSnapshot>;
  read(
    s: ReadSnapshot,
    tenantId: string,
    nodeId: string,
  ): Promise<TenantRoutingEvidenceSnapshot>;
}
export class TenantRoutingEvidence implements TenantRoutingEvidencePort {
  constructor(
    private readonly database: SnapshotDatabase,
    private readonly verification: TenantVerification,
  ) {}
  snapshot(tenantId: string, nodeId: string) {
    return this.database.read((s) => this.read(s, tenantId, nodeId));
  }
  async read(
    s: ReadSnapshot,
    tenantId: string,
    nodeId: string,
  ): Promise<TenantRoutingEvidenceSnapshot> {
    const view = await this.verification.project(s, tenantId, nodeId);
    const runtime = await currentTenantRuntime(s, nodeId);
    const snapshot = await captureSnapshot(s, nodeId);
    const routing = tenantRouting(snapshot);
    const result: TenantRoutingEvidenceSnapshot = {
      tenantId,
      nodeId,
      installationId: snapshot.node.installationId,
      readiness: view.readiness,
      provenance: runtime
        ? {
            artifactId: runtime.artifact_id,
            revisionId: runtime.revision_id,
            sourceDigest: runtime.source_digest,
            runtimeGeneration: runtime.runtime_generation,
          }
        : null,
      verifiedExtensions: [],
    };
    if (view.readiness.state !== 'ready' || !runtime?.current) return result;
    const successful = view.cases.flatMap((c) => {
      const t = view.tests.find((t) => t.caseId === c.id);
      const age = t?.finishedAt
        ? Date.now() - new Date(t.finishedAt).getTime()
        : Infinity;
      return c.expectedOutcome === 'permitted' &&
        t?.current &&
        t.state === 'passed' &&
        t.outcome === 'permitted' &&
        age >= 0 &&
        age < 86400000
        ? [{ c, t }]
        : [];
    });
    for (const claim of snapshot.tenantRouting?.allocations ?? []) {
      if (
        claim.tenantId !== tenantId ||
        !routing.extension(tenantId, claim.extensionId)
      )
        continue;
      const inbound = successful.find(
        ({ c, t }) =>
          c.direction === 'inbound' &&
          t.destinationId === claim.extensionId &&
          routing.inbound(tenantId, c.routeId),
      );
      const outbound = successful.find(
        ({ c }) =>
          c.direction === 'outbound' &&
          c.sourceId === claim.extensionId &&
          routing.outbound(tenantId, c.routeId),
      );
      const extension = snapshot.extensions.find(
        (e) => e.id === claim.extensionId,
      );
      if (!inbound || !outbound || !extension) continue;
      const rule = snapshot.outbound.find((r) => r.id === outbound.c.routeId);
      const permissions = snapshot
        .tenantRouting!.authorizations.filter(
          (a) =>
            a.tenantId === tenantId &&
            a.kind === 'permission' &&
            a.resourceId === rule?.trunkId,
        )
        .map((a) => ({ id: a.id, version: a.version, trunkId: a.resourceId }));
      if (permissions.length !== 1) continue;
      result.verifiedExtensions.push({
        extensionId: extension.id,
        extensionVersion: extension.version,
        allocationId: claim.id,
        allocationVersion: claim.version,
        inboundTestId: inbound.t.id,
        outboundTestId: outbound.t.id,
        permissions,
      });
    }
    return result;
  }
}
