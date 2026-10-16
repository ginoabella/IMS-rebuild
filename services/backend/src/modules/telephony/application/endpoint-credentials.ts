import { createHash, randomUUID } from 'node:crypto';
import type {
  EndpointCredentialConflict,
  EndpointCredentialOperationDto,
  EndpointCredentialStatusDto,
} from '@myims/contracts';
import type { SnapshotDatabase } from '../../../infrastructure/database/read-snapshot';
import type { Transaction } from '../../../infrastructure/database/transaction';
import type { ExecutionContext } from '../../../infrastructure/execution/context';
import type { AuditWrite } from '../../audit/application/audit-write';
import type { OutboxRepository } from '../../../infrastructure/outbox/outbox-repository';
import {
  principalActor,
  type Principal,
} from '../../identity/application/request-authority';
import type { TransactionAuthority } from '../../identity/application/transaction-authority';
import { uuid } from '../../identity/domain/storage';
import { id, object, version, InventoryRejected } from '../domain/inventory';
import type { InventoryVersionPort } from './inventory-ports';
import type { PbxTransactions } from './pbx-nodes';
import type { CredentialStore } from './credential-store';
import { operationDto } from '../domain/credential-operation';
export const credentialWorkContract = {
  type: 'endpoint.credential.prepare',
  version: 1,
  fields: { action: { kind: 'enum' as const, values: ['setup', 'reset'] } },
};
export const credentialAuditContract = {
  type: 'endpoint.credential.associated',
  version: 1,
  fields: {
    action: { kind: 'enum' as const, values: ['setup', 'reset'] },
    operationId: { kind: 'uuid' as const },
    generationId: { kind: 'uuid' as const },
    ordinal: { kind: 'integer' as const, min: 1, max: 2147483647 },
    desiredVersion: { kind: 'integer' as const, min: 1, max: 2147483647 },
  },
};
export class CredentialRejected extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    readonly reason?: EndpointCredentialConflict,
  ) {
    super('Credential request rejected');
  }
}
export type CredentialOutcome<T> =
  | { kind: 'ok'; value: T; pending?: boolean }
  | { kind: 'error'; status: number; reason?: string };
export class EndpointCredentials {
  constructor(
    private readonly transactions: PbxTransactions,
    private readonly database: SnapshotDatabase,
    private readonly authority: TransactionAuthority,
    private readonly inventory: InventoryVersionPort,
    private readonly store: CredentialStore,
    private readonly outbox: OutboxRepository,
    readonly audit: AuditWrite,
  ) {}
  private async handle<T>(
    action: () => Promise<CredentialOutcome<T>>,
  ): Promise<CredentialOutcome<T>> {
    try {
      return await action();
    } catch (e) {
      if (e instanceof CredentialRejected)
        return { kind: 'error', status: e.status, reason: e.reason };
      if (e instanceof InventoryRejected) {
        const o = e.outcome;
        return {
          kind: 'error',
          status:
            o.kind === 'conflict'
              ? 409
              : o.kind === 'invalid'
                ? 400
                : o.kind === 'missing'
                  ? 404
                  : o.kind === 'denied'
                    ? 403
                    : 503,
          ...(o.kind === 'conflict' ? { reason: o.reason } : {}),
        };
      }
      return { kind: 'error', status: 503 };
    }
  }
  async authorized(tx: Transaction, p: Principal) {
    if (
      p.plane !== 'platform' ||
      !p.grants.includes('platform_operator') ||
      !(await this.authority.validate(tx, p))
    )
      throw new CredentialRejected(403);
  }
  accept(
    p: Principal,
    nodeInput: unknown,
    extensionInput: unknown,
    action: 'setup' | 'reset',
    input: unknown,
    correlationId: string,
  ) {
    return this.handle<EndpointCredentialOperationDto>(async () => {
      const node = id(nodeInput, 'nodeId'),
        extension = id(extensionInput, 'extensionId');
      const data = object(input, [
        'operationId',
        'expectedVersion',
        'expectedGenerationId',
      ]);
      if (
        !uuid(data.operationId) ||
        (action === 'setup'
          ? data.expectedGenerationId !== null
          : !uuid(data.expectedGenerationId))
      )
        throw new CredentialRejected(400);
      const request = data.operationId.toLowerCase(),
        expectedVersion = version(data.expectedVersion, 'expectedVersion');
      const expectedGeneration =
        data.expectedGenerationId === null
          ? null
          : (data.expectedGenerationId as string).toLowerCase();
      if (p.plane !== 'platform') throw new CredentialRejected(403);
      const fingerprint = createHash('sha256')
        .update(
          JSON.stringify([
            action,
            node,
            extension,
            expectedVersion,
            expectedGeneration,
          ]),
        )
        .digest('hex');
      const context: ExecutionContext = {
        actor: principalActor(p),
        target: {
          type: 'endpoint-credential-operation',
          reference: randomUUID(),
          tenantId: null,
        },
        correlationId,
      };
      return this.transactions.run(context, async (tx) => {
        await this.authorized(tx, p);
        const prior = await this.store.receipt(
          tx,
          p.operatorId,
          action,
          request,
        );
        if (prior) {
          if (prior.fingerprint !== fingerprint)
            throw new CredentialRejected(409, 'request_conflict');
          if (prior.expired)
            throw new CredentialRejected(409, 'intent_expired');
          return {
            kind: 'ok',
            value: operationDto(prior),
            pending: prior.terminal_at === null,
          };
        }
        await this.inventory.lockUnallocated(
          tx,
          node,
          extension,
          expectedVersion,
        );
        const current = (await this.store.current(tx, node, extension))!;
        if (await this.store.active(tx, extension))
          throw new CredentialRejected(409, 'credential_operation_pending');
        if (
          current.credential_generation_id !== expectedGeneration ||
          (action === 'reset' && current.credential_generation_id === null)
        )
          throw new CredentialRejected(409, 'credential_state_conflict');
        const dependencies = await this.store.dependencies(
          tx,
          node,
          current.installation_id,
        );
        if (!dependencies?.compatible)
          throw new CredentialRejected(409, 'dependency_changed');
        const row = await this.store.reserve(tx, {
          id: context.target.reference,
          request,
          operator: p.operatorId,
          authenticationVersion: p.authenticationVersion,
          action,
          node,
          extension,
          installation: current.installation_id,
          expectedVersion,
          expectedGeneration,
          nodeVersion: dependencies.nodeVersion,
          capabilityRevision: dependencies.capabilityRevision,
          generation: randomUUID(),
          fingerprint,
          correlation: correlationId,
        });
        const workId = await this.outbox.insert(
          tx,
          credentialWorkContract,
          row.id,
          { action },
        );
        await tx.query(
          'UPDATE public.endpoint_credential_operations SET work_id=$2 WHERE id=$1',
          [row.id, workId],
        );
        return { kind: 'ok', value: operationDto(row), pending: true };
      });
    });
  }
  status(
    p: Principal,
    nodeInput: unknown,
    extensionInput: unknown,
    operationInput?: unknown,
  ) {
    return this.handle<
      EndpointCredentialStatusDto | EndpointCredentialOperationDto
    >(async () => {
      if (p.plane !== 'platform') throw new CredentialRejected(403);
      const node = id(nodeInput, 'nodeId'),
        extension = id(extensionInput, 'extensionId');
      if (operationInput !== undefined && !uuid(operationInput))
        throw new CredentialRejected(400);
      return this.database.read(async (s) => {
        const current = await this.store.current(s, node, extension);
        if (!current) throw new CredentialRejected(404);
        if (typeof operationInput === 'string') {
          const row = await this.store.operation(
            s,
            operationInput.toLowerCase(),
          );
          if (
            !row ||
            row.node_id !== node ||
            row.extension_id !== extension ||
            row.operator_id !== p.operatorId
          )
            throw new CredentialRejected(404);
          if (row.expired) throw new CredentialRejected(409, 'intent_expired');
          return { kind: 'ok', value: operationDto(row) };
        }
        const active = await this.store.active(s, extension);
        const generation = current.credential_generation_id
          ? await this.store.generation(
              s,
              extension,
              current.credential_generation_id,
            )
          : null;
        if (current.credential_generation_id && !generation)
          throw new Error('Incoherent desired association');
        return {
          kind: 'ok',
          value: {
            extensionId: extension,
            desiredVersion: current.version,
            credential: generation
              ? {
                  kind: 'configured',
                  generationId: generation.generation_id,
                  ordinal: generation.ordinal,
                  materialHealth: generation.material_health,
                  verifiedAt: generation.verified_at?.toISOString() ?? null,
                  retirement: 'retained_dependency_unknown',
                }
              : { kind: 'unset' },
            activeOperation:
              active?.operator_id === p.operatorId
                ? operationDto(active)
                : null,
            readiness: 'not_established',
          },
        };
      });
    });
  }
}
