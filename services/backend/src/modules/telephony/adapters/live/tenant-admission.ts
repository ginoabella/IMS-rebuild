import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import {
  chmodSync,
  mkdirSync,
  chownSync,
  lstatSync,
  unlinkSync,
} from 'node:fs';
import type { LiveExecutionStore } from './execution-store';
import type { ReadSnapshot } from '../../../../infrastructure/database/read-snapshot';
import { PlatformAuthorityRepository } from '../../../platform/adapters/db/authority-read';
import { captureSnapshot } from '../db/revision-snapshot';
import { canonical } from '../../domain/revision-snapshot';
import { tenantRouting } from '../../domain/tenant-routing';
import { runtimeNames } from './materialize';
import { id, object } from '../../domain/peer';
const digest = (v: string) => createHash('sha256').update(v).digest('hex');
/** Native owner only; AGI may request admission, never commands or credentials. */
export class TenantCallAdmission {
  constructor(
    private readonly store: LiveExecutionStore,
    private readonly nodeId: string,
  ) {}
  private async locked<T>(
    action: (snapshot: ReadSnapshot) => Promise<T>,
  ): Promise<T> {
    const client = await this.store.pool.connect();
    let discard = false;
    try {
      await client.query('BEGIN');
      await client.query(
        'SELECT id FROM public.pbx_nodes WHERE id=$1 FOR SHARE',
        [this.nodeId],
      );
      const result = await action(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        discard = true;
      }
      throw error;
    } finally {
      client.release(discard);
    }
  }
  async admit(input: unknown): Promise<boolean> {
    const v = object(input, [
      'revisionId',
      'tenantId',
      'direction',
      'resourceId',
      'endpoint',
      'number',
      'uniqueId',
      'nonce',
      'unambiguous',
    ]);
    const revisionId = id(v.revisionId),
      tenantId = id(v.tenantId),
      resourceId = id(v.resourceId);
    if (
      v.unambiguous !== true ||
      !['inbound', 'outbound'].includes(String(v.direction)) ||
      typeof v.endpoint !== 'string' ||
      !/^[a-z0-9-]{1,160}$/.test(v.endpoint) ||
      typeof v.number !== 'string' ||
      !/^[0-9]{1,15}$/.test(v.number) ||
      typeof v.uniqueId !== 'string' ||
      !/^[a-zA-Z0-9_.-]{1,80}$/.test(v.uniqueId) ||
      typeof v.nonce !== 'string' ||
      !/^(?:[a-f0-9]{64})?$/.test(v.nonce)
    )
      return false;
    const dialled = v.number,
      nonce = v.nonce;
    return this.locked(async (s) => {
      // Canonical node SHARE lock serializes graph mutations. Atomic source capture
      // and final admission predicates use current primary facts under that lock.
      const runtime = (
        await s.query<{
          artifact_id: string;
          runtime_generation: number;
          source_digest: string;
          operator_id: string;
          authentication_version: number;
        }>(
          `SELECT a.id AS artifact_id,r.source_digest,p.routing_generation AS runtime_generation,x.operator_id,x.authentication_version FROM public.pbx_live_runtime p JOIN public.pbx_live_artifacts a ON a.id=p.installed_id AND a.id=p.verified_id JOIN public.pbx_live_operations x ON x.id=a.operation_id JOIN public.pbx_revisions r ON r.id=a.revision_id JOIN public.pbx_ownership o ON o.node_id=p.node_id WHERE p.node_id=$1 AND r.id=$2 AND r.policy_version='tenant-routing-1' AND r.compiler_version='tenant-review-1' AND p.runtime_state='verified' AND p.active_operation_id IS NULL AND p.active_retirement_id IS NULL AND p.executor_seen_at>clock_timestamp()-interval '15 seconds' AND o.expires_at>clock_timestamp() AND o.epoch=p.boundary_epoch AND EXISTS(SELECT 1 FROM public.tenant_runtime_proofs f WHERE f.node_id=p.node_id AND f.artifact_id=a.id AND f.owner_epoch=o.epoch AND f.source_digest=r.source_digest AND f.runtime_generation=p.routing_generation AND f.valid AND f.checked_at>clock_timestamp()-interval '15 seconds')`,
          [this.nodeId, revisionId],
        )
      ).rows[0];
      if (!runtime) return false;
      const actor = await new PlatformAuthorityRepository(
        this.store.database,
      ).readIn(s, runtime.operator_id);
      if (
        actor.kind !== 'eligible' ||
        actor.snapshot.authenticationVersion !== runtime.authentication_version
      )
        return false;
      const snapshot = await captureSnapshot(s, this.nodeId);
      if (digest(canonical(snapshot)) !== runtime.source_digest) return false;
      const routing = tenantRouting(snapshot),
        names = runtimeNames(snapshot, revisionId),
        tenant = routing.target(tenantId);
      if (!routing.valid || !tenant || tenant.voicePreference !== 'enabled')
        return false;
      let sourceId: string;
      if (v.direction === 'outbound') {
        const source = snapshot.extensions.filter(
          (e) => e.endpointKey === v.endpoint,
        );
        if (
          source.length !== 1 ||
          !routing.extension(tenantId, source[0]!.id) ||
          !routing.outbound(tenantId, resourceId) ||
          routing.outboundRule(tenantId, dialled)?.id !== resourceId
        )
          return false;
        sourceId = source[0]!.id;
      } else {
        const r = snapshot.inbound.find((r) => r.id === resourceId);
        if (
          !r ||
          v.endpoint !== names.gateway(r.gatewayId) ||
          !routing.inbound(tenantId, resourceId)
        )
          return false;
        const did = snapshot.dids.find((d) => d.id === r.didId);
        if (!did || did.number !== v.number) return false;
        sourceId = r.gatewayId;
      }
      if (tenant.status === 'active' && nonce === '') return true;
      const test = (
        await s.query<{
          intent_id: string;
          operator_id: string;
          authentication_version: number;
        }>(
          `SELECT p.intent_id,i.operator_id,i.authentication_version FROM public.tenant_route_test_progress p JOIN public.tenant_route_test_intents i ON i.id=p.intent_id JOIN public.tenant_route_test_cases c ON c.id=i.case_id LEFT JOIN public.tenant_verification_grants g ON g.id=i.grant_id LEFT JOIN public.tenant_verification_grant_cases gc ON gc.grant_id=g.id AND gc.case_id=c.id WHERE p.node_id=$1 AND p.state='dispatching' AND p.nonce_hash=$2 AND p.deadline>clock_timestamp() AND i.tenant_id=$3 AND i.revision_id=$4 AND i.artifact_id=$5 AND i.source_digest=$6 AND c.enabled AND c.direction=$7 AND c.route_id=$8 AND c.dialled=$9 AND c.source_id=$10 AND i.runtime_generation=$11 AND (($12='active' AND i.grant_id IS NULL) OR (gc.case_id IS NOT NULL AND g.runtime_generation=i.runtime_generation AND g.expires_at>clock_timestamp() AND g.source_digest=i.source_digest AND g.artifact_id=i.artifact_id AND g.tenant_id=i.tenant_id AND g.operator_id=i.operator_id AND g.authentication_version=i.authentication_version AND NOT EXISTS(SELECT 1 FROM public.tenant_verification_revocations x WHERE x.grant_id=g.id)))`,
          [
            this.nodeId,
            digest(nonce),
            tenantId,
            revisionId,
            runtime.artifact_id,
            runtime.source_digest,
            v.direction,
            resourceId,
            v.number,
            sourceId,
            runtime.runtime_generation,
            tenant.status,
          ],
        )
      ).rows[0];
      if (!test) return false;
      const testActor = await new PlatformAuthorityRepository(
        this.store.database,
      ).readIn(s, test.operator_id);
      if (
        testActor.kind !== 'eligible' ||
        testActor.snapshot.authenticationVersion !== test.authentication_version
      )
        return false;
      // The SIP channel is already active, so native apply's independent quiet check
      // cannot install over it. Compare-and-set consumes only this exact dispatch.
      const admitted = await s.query(
        `UPDATE public.tenant_route_test_progress p SET state='admitted',unique_id=$2,updated_at=clock_timestamp() WHERE p.intent_id=$1 AND p.state='dispatching' AND p.deadline>clock_timestamp()
         AND EXISTS(SELECT 1 FROM public.tenant_route_test_intents i LEFT JOIN public.tenant_verification_grants g ON g.id=i.grant_id JOIN public.pbx_live_runtime r ON r.node_id=i.node_id JOIN public.pbx_ownership o ON o.node_id=r.node_id WHERE i.id=p.intent_id AND ((i.grant_id IS NULL AND $5='active') OR (g.expires_at>clock_timestamp() AND NOT EXISTS(SELECT 1 FROM public.tenant_verification_revocations x WHERE x.grant_id=g.id))) AND r.installed_id=i.artifact_id AND r.verified_id=i.artifact_id AND r.routing_generation=i.runtime_generation AND r.active_operation_id IS NULL AND r.active_retirement_id IS NULL AND r.runtime_state='verified' AND r.boundary_epoch=o.epoch AND o.expires_at>clock_timestamp())
         AND public.tenant_routing_capture(ARRAY[$3::uuid])=$4::jsonb RETURNING intent_id`,
        [
          test.intent_id,
          v.uniqueId,
          tenantId,
          JSON.stringify([tenant]),
          tenant.status,
        ],
      );
      return admitted.rows.length === 1;
    });
  }
}
/** This socket is local to Asterisk; it is never mounted into HTTP/worker/Next. */
export class TenantAdmissionServer {
  private readonly server;
  private active = 0;
  private readonly socket = '/run/myims-tenant/admission.sock';
  constructor(
    admission: TenantCallAdmission,
    private readonly asteriskGroup: number,
  ) {
    this.server = createServer(async (request, response) => {
      response.setHeader('Content-Type', 'application/json');
      if (
        request.method !== 'POST' ||
        request.url !== '/admit' ||
        this.active >= 8
      ) {
        response.writeHead(503).end('{"permitted":false}');
        return;
      }
      this.active++;
      const timer = setTimeout(() => request.destroy(), 2500);
      try {
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of request) {
          size += chunk.length;
          if (size > 2048) throw new Error('Bound');
          chunks.push(chunk);
        }
        const allowed = await admission.admit(
          JSON.parse(Buffer.concat(chunks).toString('utf8')),
        );
        response
          .writeHead(200)
          .end(allowed ? '{"permitted":true}' : '{"permitted":false}');
      } catch {
        response.writeHead(503).end('{"permitted":false}');
      } finally {
        clearTimeout(timer);
        this.active--;
      }
    });
    this.server.headersTimeout = 3000;
    this.server.requestTimeout = 3000;
  }
  async start() {
    mkdirSync('/run/myims-tenant', { recursive: true, mode: 0o750 });
    const stat = lstatSync('/run/myims-tenant');
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== 0)
      throw new Error('Admission unavailable');
    chownSync('/run/myims-tenant', 0, this.asteriskGroup);
    chmodSync('/run/myims-tenant', 0o750);
    try {
      const old = lstatSync(this.socket);
      if (!old.isSocket() || old.uid !== 0)
        throw new Error('Admission unavailable');
      unlinkSync(this.socket);
    } catch (e) {
      if (!(e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT'))
        throw e;
    }
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.socket, resolve);
    });
    chownSync(this.socket, 0, this.asteriskGroup);
    chmodSync(this.socket, 0o660);
  }
  async close() {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }
}
