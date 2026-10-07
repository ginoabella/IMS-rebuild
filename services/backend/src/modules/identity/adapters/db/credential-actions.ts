import { StaffAuthorityMutations } from './authority-mutations';
import type {
  CredentialTarget,
  CredentialActionStore,
} from '../../application/credential-action-ports';
import type { Transaction } from '../../../../infrastructure/database/transaction';
import type { Principal } from '../../application/request-authority';
import { principalActor } from '../../application/request-authority';
import type {
  CredentialTenancy,
  CredentialProvenance,
  CredentialOperator,
} from '../../application/credential-action-ports';
import { canonicalRoles } from '../../domain/roles';
import { staffAuthority } from '../../domain/authority';
import { credentialCoherence } from './authority-read';
import type {
  CredentialAction,
  CredentialPurpose,
} from '../../domain/credential-action';
import { credentialEvent } from '../../domain/credential-action';
import { AuditRepository } from '../../../audit/adapters/db/audit-repository';
export class CredentialActionRepository implements CredentialActionStore {
  constructor(
    private readonly tenancy: CredentialTenancy,
    private readonly provenance: CredentialProvenance,
    private readonly operators: CredentialOperator,
  ) {}
  async now(tx: Transaction) {
    const result = await tx.query<{ now: Date }>(
      'SELECT clock_timestamp() AS now',
    );
    const now = result.rows[0]?.now;
    if (!now) throw new Error('Missing canonical time');
    return now;
  }
  async linked(tx: Transaction, tenantId: string) {
    return this.provenance.linked(tx, tenantId);
  }
  async managementTarget(tx: Transaction, tenantId: string, actionId: string) {
    return (
      (
        await tx.query<{ tenant_id: string; staff_id: string }>(
          'SELECT tenant_id,staff_id FROM public.credential_actions WHERE tenant_id=$1 AND id=$2',
          [tenantId, actionId],
        )
      ).rows[0] ?? null
    );
  }
  async qualify(
    tx: Transaction,
    p: Principal,
    tenantId: string,
    staffId: string,
    purpose: CredentialPurpose,
  ) {
    // Platform authority is locked before tenancy. All staff paths lock tenancy
    // exclusively before staff; this also serializes the sole-admin predicate.
    if (p.plane === 'platform') {
      const issuer = await this.operators.lockedById(tx, p.operatorId);
      if (
        issuer.kind !== 'eligible' ||
        issuer.snapshot.authenticationVersion !== p.authenticationVersion
      )
        return null;
    } else if (p.tenantId !== tenantId || p.staffId === staffId) return null;
    const tenant = await this.tenancy.lock(tx, tenantId);
    if (!tenant || !['draft', 'active'].includes(tenant.status)) return null;
    if (p.plane === 'tenant') {
      const issuer = (
        await tx.query(
          `SELECT id,tenant_id,roles,status,credential_state,version,authentication_version,${credentialCoherence} AS credential_coherent FROM public.staff_users WHERE tenant_id=$1 AND id=$2 FOR SHARE`,
          [tenantId, p.staffId],
        )
      ).rows[0];
      const eligible = staffAuthority(issuer, tenant);
      if (
        eligible.kind !== 'eligible' ||
        !eligible.snapshot.roles.includes('tenant_admin') ||
        eligible.snapshot.authenticationVersion !== p.authenticationVersion ||
        tenant.authority_version !== p.tenantAuthorityVersion
      )
        return null;
    } else if ((await this.provenance.linked(tx, tenantId)) !== staffId)
      return null;
    const target = (
      await tx.query<CredentialTarget>(
        `SELECT id,tenant_id,roles,status,credential_state,version,authentication_version,${credentialCoherence} AS credential_coherent FROM public.staff_users WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,
        [tenantId, staffId],
      )
    ).rows[0];
    const roles = canonicalRoles(target?.roles);
    if (
      !target ||
      !roles ||
      target.status !== 'active' ||
      target.credential_state !== (purpose === 'setup' ? 'unset' : 'ready') ||
      (purpose === 'reset' && !target.credential_coherent)
    )
      return null;
    if (p.plane === 'platform') {
      if (
        !roles.includes('tenant_admin') ||
        (tenant.status === 'draft' && roles.length !== 1)
      )
        return null;
      if (tenant.status === 'active' && purpose === 'reset') {
        const count = (
          await tx.query<{ count: number }>(
            `SELECT count(*)::integer AS count FROM public.staff_users WHERE tenant_id=$1 AND status='active' AND 'tenant_admin'=ANY(roles) AND ${credentialCoherence}`,
            [tenantId],
          )
        ).rows[0]?.count;
        if (count !== 1) return null;
      }
    }
    return { target, tenant };
  }
  async find(tx: Transaction, key: string, by: 'lookup_hash' | 'id') {
    return (
      (
        await tx.query<CredentialAction>(
          `SELECT * FROM public.credential_actions WHERE ${by}=$1`,
          [key],
        )
      ).rows[0] ?? null
    );
  }
  async pending(tx: Transaction, tenantId: string, staffId: string) {
    return (
      (
        await tx.query<CredentialAction>(
          "SELECT * FROM public.credential_actions WHERE tenant_id=$1 AND staff_id=$2 AND state='pending' FOR UPDATE",
          [tenantId, staffId],
        )
      ).rows[0] ?? null
    );
  }
  async latest(tx: Transaction, tenantId: string, staffId: string) {
    return (
      (
        await tx.query<CredentialAction>(
          'SELECT * FROM public.credential_actions WHERE tenant_id=$1 AND staff_id=$2 ORDER BY issued_at DESC,id DESC LIMIT 1',
          [tenantId, staffId],
        )
      ).rows[0] ?? null
    );
  }
  async insert(tx: Transaction, a: CredentialAction) {
    await tx.query(
      `INSERT INTO public.credential_actions(id,lookup_hash,tenant_id,staff_id,purpose,target_version,target_authentication_version,tenant_authority_version,issuer_plane,issuer_operator_id,issuer_staff_id,issuer_tenant_id,issuer_authentication_version,verification_method,issued_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        a.id,
        a.lookup_hash,
        a.tenant_id,
        a.staff_id,
        a.purpose,
        a.target_version,
        a.target_authentication_version,
        a.tenant_authority_version,
        a.issuer_plane,
        a.issuer_operator_id,
        a.issuer_staff_id,
        a.issuer_tenant_id,
        a.issuer_authentication_version,
        a.verification_method,
        a.issued_at,
        a.expires_at,
      ],
    );
  }
  async terminal(
    tx: Transaction,
    a: CredentialAction,
    state: 'consumed' | 'cancelled',
  ) {
    const result = await tx.query(
      "UPDATE public.credential_actions SET state=$2,terminal_at=clock_timestamp() WHERE id=$1 AND state='pending' RETURNING id",
      [a.id, state],
    );
    if (result.rowCount !== 1) throw new Error('Credential action conflict');
  }
  audit(
    tx: Transaction,
    a: CredentialAction,
    operation: 'issued' | 'reissued' | 'cancelled' | 'consumed',
  ) {
    return new AuditRepository().append(tx, credentialEvent, {
      operation,
      purpose: a.purpose,
      method: a.verification_method,
      actionId: a.id,
      issuerId: a.issuer_operator_id ?? a.issuer_staff_id,
      issuerPlane: a.issuer_plane,
    });
  }
  async replace(tx: Transaction, a: CredentialAction, hash: string) {
    const result = await new StaffAuthorityMutations(this.tenancy).change(
      tx,
      { plane: 'tenant', tenantId: a.tenant_id, staffId: a.staff_id },
      a.target_version,
      {
        kind: 'credential',
        credentialState: 'ready',
        passwordHash: hash,
        credentialChangedAt: await this.now(tx),
      },
    );
    if (result.kind !== 'found')
      throw new Error('Credential replacement unavailable');
  }
  async clean(tx: Transaction, limit: number) {
    const result = await tx.query(
      "DELETE FROM public.credential_actions WHERE id IN (SELECT id FROM public.credential_actions WHERE LEAST(terminal_at,expires_at)+interval '30 days'<=clock_timestamp() ORDER BY LEAST(terminal_at,expires_at),id LIMIT $1 FOR UPDATE SKIP LOCKED) RETURNING id",
      [limit],
    );
    const count = result.rowCount ?? 0;
    await new AuditRepository().append(
      tx,
      {
        type: 'identity.credential-cleanup',
        version: 1,
        fields: { count: { kind: 'integer', min: 0, max: 100 } },
      },
      { count },
    );
    return count;
  }
  issuer(a: CredentialAction): Principal {
    const issuerId = a.issuer_operator_id ?? a.issuer_staff_id;
    if (!issuerId) throw new Error('Invalid capability issuer');
    return a.issuer_plane === 'platform'
      ? {
          plane: 'platform',
          operatorId: issuerId,
          authenticationVersion: a.issuer_authentication_version,
          grants: ['platform_operator'],
        }
      : {
          plane: 'tenant',
          tenantId: a.tenant_id,
          staffId: issuerId,
          authenticationVersion: a.issuer_authentication_version,
          tenantAuthorityVersion: a.tenant_authority_version,
          roles: ['tenant_admin'],
          grants: ['tenant.manage'],
        };
  }
  async valid(tx: Transaction, a: CredentialAction) {
    const qualified = await this.qualify(
      tx,
      this.issuer(a),
      a.tenant_id,
      a.staff_id,
      a.purpose,
    );
    // Re-read only after tenant lock: a competing cancellation/reissue or exchange
    // can commit between the initial lookup and our lock acquisition.
    const current = await this.find(tx, a.id, 'id');
    const now = await this.now(tx);
    return qualified &&
      current?.state === 'pending' &&
      current.expires_at > now &&
      qualified.target.version === a.target_version &&
      qualified.target.authentication_version ===
        a.target_authentication_version &&
      qualified.tenant.authority_version === a.tenant_authority_version
      ? qualified
      : null;
  }
  context(
    p: Principal,
    tenantId: string,
    staffId: string,
    correlationId: string,
  ): import('../../../../infrastructure/execution/context').ExecutionContext {
    return {
      actor: principalActor(p),
      target: { type: 'staff', reference: staffId, tenantId },
      correlationId,
    };
  }
}
