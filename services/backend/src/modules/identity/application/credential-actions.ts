import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Transaction } from '../../../infrastructure/database/transaction';
import { correlationId } from '../../../infrastructure/execution/context';
import {
  hashPassword,
  validatePassword,
} from '../../../infrastructure/password/scrypt';
import type { CredentialActionStore } from './credential-action-ports';
import type { Principal } from './request-authority';
import { uuid, onlyFields } from '../domain/storage';
import {
  actionDto,
  type CredentialAction,
  type CredentialPurpose,
  type VerificationMethod,
} from '../domain/credential-action';
export interface CredentialTransactions {
  run<T>(context: unknown, action: (tx: Transaction) => Promise<T>): Promise<T>;
}
export interface CredentialBudgets {
  consume(
    operation: 'issue' | 'cancel' | 'exchange',
    source: string | null,
    issuer: string | null,
    target: string,
  ): Promise<
    | { kind: 'admitted' }
    | { kind: 'invalid' | 'unavailable' }
    | { kind: 'limited'; retrySeconds: number }
  >;
}
export type CredentialFailure =
  | { kind: 'invalid' | 'denied' | 'missing' | 'conflict' | 'unavailable' }
  | { kind: 'limited'; retrySeconds: number };
const lookup = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export function capabilityInput(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(value)
  );
}
function issueInput(input: unknown, staff: boolean) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const v = input as Record<string, unknown>;
  if (
    !onlyFields(v, [
      'operation',
      'purpose',
      'verificationMethod',
      ...(staff ? ['tenantId', 'staffId'] : []),
    ]) ||
    typeof v.operation !== 'string' ||
    !['issue', 'reissue'].includes(v.operation) ||
    typeof v.purpose !== 'string' ||
    !['setup', 'reset'].includes(v.purpose) ||
    typeof v.verificationMethod !== 'string' ||
    !['in_person', 'known_contact_call'].includes(v.verificationMethod) ||
    (staff && (!uuid(v.tenantId) || !uuid(v.staffId)))
  )
    return null;
  return {
    operation: v.operation as 'issue' | 'reissue',
    purpose: v.purpose as CredentialPurpose,
    method: v.verificationMethod as VerificationMethod,
  };
}
export class CredentialActions {
  constructor(
    private readonly transactions: CredentialTransactions,
    private readonly repository: CredentialActionStore,
    private readonly budgets: CredentialBudgets,
  ) {}
  private issuerKey(p: Principal) {
    return JSON.stringify(
      p.plane === 'platform'
        ? ['platform', p.operatorId]
        : ['tenant', p.tenantId, p.staffId],
    );
  }
  private async target(p: Principal, tenantId: string, staffId?: string) {
    if (!uuid(tenantId)) return null;
    tenantId = tenantId.toLowerCase();
    staffId = staffId?.toLowerCase();
    if (p.plane === 'tenant')
      return p.tenantId === tenantId && uuid(staffId) ? staffId : null;
    // Immutable linkage resolution selects the budget key, never staff state or a
    // guessed username/role. Ordinary target reads occur only after admission.
    return this.transactions.run(
      {
        actor: {
          kind: 'system',
          reference: 'identity.credential-target',
          plane: 'system',
          tenantId: null,
          reason: 'provenance-resolution',
        },
        target: { type: 'tenant', reference: tenantId, tenantId: null },
        correlationId: correlationId(),
      },
      (tx) => this.repository.linked(tx, tenantId),
    );
  }
  async issue(
    p: Principal,
    tenantId: string,
    input: unknown,
    source: string | null,
    staffId?: string,
  ) {
    const parsed = issueInput(input, p.plane === 'tenant');
    if (!parsed || !uuid(tenantId)) return { kind: 'invalid' } as const;
    tenantId = tenantId.toLowerCase();
    staffId = staffId?.toLowerCase();
    try {
      const id = await this.target(p, tenantId, staffId);
      // Missing provenance consumes the same budget path, using a qualified
      // non-existent sentinel; no account lookup or hash work precedes admission.
      const admitted = await this.budgets.consume(
        'issue',
        source,
        this.issuerKey(p),
        JSON.stringify([tenantId, id ?? 'unlinked']),
      );
      if (admitted.kind !== 'admitted') return admitted;
      if (!id) return { kind: 'denied' } as const;
      const token = randomBytes(32).toString('base64url');
      return await this.transactions.run(
        this.repository.context(p, tenantId, id, correlationId()),
        async (tx) => {
          const q = await this.repository.qualify(
            tx,
            p,
            tenantId,
            id,
            parsed.purpose,
          );
          if (!q) return { kind: 'denied' } as const;
          const now = await this.repository.now(tx);
          const pending = await this.repository.pending(tx, tenantId, id);
          if (
            pending &&
            pending.expires_at > now &&
            parsed.operation === 'issue'
          )
            return { kind: 'conflict' } as const;
          if (pending) {
            await this.repository.terminal(tx, pending, 'cancelled');
            await this.repository.audit(tx, pending, 'cancelled');
          }
          const a: CredentialAction = {
            id: randomUUID(),
            lookup_hash: lookup(token),
            tenant_id: tenantId,
            staff_id: id,
            purpose: parsed.purpose,
            target_version: q.target.version,
            target_authentication_version: q.target.authentication_version,
            tenant_authority_version: q.tenant.authority_version,
            issuer_plane: p.plane,
            issuer_operator_id: p.plane === 'platform' ? p.operatorId : null,
            issuer_staff_id: p.plane === 'tenant' ? p.staffId : null,
            issuer_tenant_id: p.plane === 'tenant' ? p.tenantId : null,
            issuer_authentication_version: p.authenticationVersion,
            verification_method: parsed.method,
            issued_at: now,
            expires_at: new Date(
              now.getTime() + (parsed.purpose === 'setup' ? 86400000 : 1800000),
            ),
            state: 'pending',
            terminal_at: null,
          };
          await this.repository.insert(tx, a);
          await this.repository.audit(
            tx,
            a,
            parsed.operation === 'issue' ? 'issued' : 'reissued',
          );
          return {
            kind: 'issued',
            action: actionDto(a, now),
            capability: token,
          } as const;
        },
      );
    } catch {
      return { kind: 'unavailable' } as const;
    }
  }
  async status(
    p: Principal,
    tenantId: string,
    staffId?: string,
    actionId?: string,
  ) {
    if (!uuid(tenantId) || (actionId !== undefined && !uuid(actionId)))
      return { kind: 'invalid' } as const;
    tenantId = tenantId.toLowerCase();
    staffId = staffId?.toLowerCase();
    try {
      const id = await this.target(p, tenantId, staffId);
      if (!id) return { kind: 'denied' } as const;
      return await this.transactions.run(
        this.repository.context(p, tenantId, id, correlationId()),
        async (tx) => {
          const a = actionId
            ? await this.repository.find(tx, actionId, 'id')
            : await this.repository.latest(tx, tenantId, id);
          // Current qualification is required; use current credential state purpose
          // so a committed setup may be reconciled through ready/reset qualification.
          const q =
            (await this.repository.qualify(tx, p, tenantId, id, 'setup')) ??
            (await this.repository.qualify(tx, p, tenantId, id, 'reset'));
          if (!q) return { kind: 'denied' } as const;
          if (a && (a.tenant_id !== tenantId || a.staff_id !== id))
            return { kind: 'missing' } as const;
          return {
            kind: 'found',
            credentialState: q.target.credential_state,
            action: a ? actionDto(a, await this.repository.now(tx)) : null,
          } as const;
        },
      );
    } catch {
      return { kind: 'unavailable' } as const;
    }
  }
  async cancel(
    p: Principal,
    tenantId: string,
    actionId: string,
    source: string | null,
    staffId?: string,
  ) {
    if (!uuid(tenantId) || !uuid(actionId)) return { kind: 'invalid' } as const;
    tenantId = tenantId.toLowerCase();
    staffId = staffId?.toLowerCase();
    try {
      const id = await this.target(p, tenantId, staffId);
      const admitted = await this.budgets.consume(
        'cancel',
        source,
        this.issuerKey(p),
        JSON.stringify([tenantId, id ?? 'unlinked']),
      );
      if (admitted.kind !== 'admitted') return admitted;
      if (!id) return { kind: 'denied' } as const;
      return await this.transactions.run(
        this.repository.context(p, tenantId, id, correlationId()),
        async (tx) => {
          const q =
            (await this.repository.qualify(tx, p, tenantId, id, 'setup')) ??
            (await this.repository.qualify(tx, p, tenantId, id, 'reset'));
          if (!q) return { kind: 'denied' } as const;
          const a = await this.repository.find(tx, actionId, 'id');
          if (!a || a.tenant_id !== tenantId || a.staff_id !== id)
            return { kind: 'missing' } as const;
          if (a.state === 'pending') {
            await this.repository.terminal(tx, a, 'cancelled');
            await this.repository.audit(tx, a, 'cancelled');
          }
          return { kind: 'cancelled' } as const;
        },
      );
    } catch {
      return { kind: 'unavailable' } as const;
    }
  }
  async exchange(input: unknown, source: string | null) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      return { kind: 'invalid' } as const;
    const v = input as Record<string, unknown>;
    if (
      !onlyFields(v, ['capability', 'password']) ||
      typeof v.password !== 'string' ||
      v.password.length > 256 ||
      /[\uD800-\uDFFF]/u.test(v.password)
    )
      return { kind: 'invalid' } as const;
    if (!capabilityInput(v.capability)) return { kind: 'denied' } as const;
    const bytes = Buffer.from(v.password, 'utf8');
    try {
      validatePassword(bytes);
    } catch {
      bytes.fill(0);
      return { kind: 'invalid' } as const;
    }
    const context = {
      actor: {
        kind: 'system',
        reference: 'identity.credential-exchange',
        plane: 'system',
        tenantId: null,
        reason: 'capability-exchange',
      },
      target: {
        type: 'credential-action',
        reference: 'exchange',
        tenantId: null,
      },
      correlationId: correlationId(),
    };
    try {
      const admitted = await this.budgets.consume(
        'exchange',
        source,
        null,
        lookup(v.capability),
      );
      if (admitted.kind !== 'admitted') return admitted;
      const a = await this.transactions.run(context, async (tx) => {
        const action = await this.repository.find(
          tx,
          lookup(v.capability as string),
          'lookup_hash',
        );
        return action && (await this.repository.valid(tx, action))
          ? action
          : null;
      });
      if (!a) return { kind: 'denied' } as const;
      // Expensive hashing is outside locks; commit revalidates every authority fact.
      const hash = await hashPassword(bytes);
      return await this.transactions.run(
        {
          ...context,
          target: {
            type: 'staff',
            reference: a.staff_id,
            tenantId: a.tenant_id,
          },
        },
        async (tx) => {
          if (!(await this.repository.valid(tx, a)))
            return { kind: 'denied' } as const;
          await this.repository.replace(tx, a, hash);
          await this.repository.terminal(tx, a, 'consumed');
          await this.repository.audit(tx, a, 'consumed');
          return { kind: 'completed' } as const;
        },
      );
    } catch {
      return { kind: 'unavailable' } as const;
    } finally {
      bytes.fill(0);
    }
  }
  staffAction(
    p: Principal,
    actionId: string,
    source: string | null,
    cancel: true,
  ): ReturnType<CredentialActions['cancel']>;
  staffAction(
    p: Principal,
    actionId: string,
    source: string | null,
    cancel?: false,
  ): ReturnType<CredentialActions['status']>;
  async staffAction(
    p: Principal,
    actionId: string,
    source: string | null,
    cancel = false,
  ) {
    if (p.plane !== 'tenant' || !uuid(actionId))
      return { kind: 'invalid' } as const;
    try {
      const a = await this.transactions.run(
        this.repository.context(p, p.tenantId, p.staffId, correlationId()),
        // Resolve only immutable qualified IDs for the budget key; mutable action
        // metadata and target state are read after cancel admission.
        (tx) => this.repository.managementTarget(tx, p.tenantId, actionId),
      );
      if (!a) {
        if (cancel) {
          const admitted = await this.budgets.consume(
            'cancel',
            source,
            this.issuerKey(p),
            JSON.stringify([p.tenantId, 'unlinked']),
          );
          if (admitted.kind !== 'admitted') return admitted;
        }
        return { kind: 'missing' } as const;
      }
      return cancel
        ? this.cancel(p, p.tenantId, actionId, source, a.staff_id)
        : this.status(p, p.tenantId, a.staff_id, actionId);
    } catch {
      return { kind: 'unavailable' } as const;
    }
  }
  async cleanup(limit: number) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      return { kind: 'invalid' } as const;
    try {
      return await this.transactions.run(
        {
          actor: {
            kind: 'system',
            reference: 'identity.credential-cleanup',
            plane: 'system',
            tenantId: null,
            reason: 'expired-capabilities',
          },
          target: {
            type: 'credential-action',
            reference: 'cleanup',
            tenantId: null,
          },
          correlationId: correlationId(),
        },
        async (tx) => {
          const count = await this.repository.clean(tx, limit);
          return { kind: 'cleaned', count } as const;
        },
      );
    } catch {
      return { kind: 'unavailable' } as const;
    }
  }
}
