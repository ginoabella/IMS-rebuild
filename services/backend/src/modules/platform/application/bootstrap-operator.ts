import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { Transaction } from '../../../infrastructure/database/transaction';
import { SafeLogger } from '../../../infrastructure/execution/logging';
import { hashPassword } from '../../../infrastructure/password/scrypt';
import { AuditRepository } from '../../audit/adapters/db/audit-repository';
import {
  BootstrapRepository,
  BootstrapConflict,
  bootstrapCommand,
} from '../adapters/db/bootstrap-repository';
import { normalizeUsername } from '../../identity/domain/storage';
import { PasswordInputError } from '../../../infrastructure/password/scrypt';
export class BootstrapUncertain extends Error {
  constructor() {
    super(
      'Bootstrap outcome uncertain; rerun to inspect durable provenance; credentials are never reset',
    );
  }
}
export async function bootstrapOperator(
  pool: Pool,
  username: string,
  password: Buffer,
  correlationId: string,
) {
  if (normalizeUsername(username) !== username) throw new PasswordInputError();
  let hash: string;
  try {
    hash = await hashPassword(password);
  } finally {
    password.fill(0);
  }
  const id = randomUUID();
  const repository = new BootstrapRepository();
  const audit = new AuditRepository();
  let readyToCommit = false;
  try {
    return await Transaction.run(
      pool,
      {
        actor: {
          kind: 'system',
          reference: bootstrapCommand,
          plane: 'system',
          tenantId: null,
          reason: 'initial-operator-provisioning',
        },
        target: { type: 'operator', reference: id, tenantId: null },
        correlationId,
      },
      bootstrapCommand,
      new SafeLogger('deployment', () => {}),
      async (transaction) => {
        await transaction.query("SET LOCAL lock_timeout='10s'");
        const decision = await repository.resolve(transaction, username);
        if (decision === 'existing') return 'already-created' as const;
        await repository.create(transaction, id, username, hash);
        await audit.append(
          transaction,
          {
            type: 'platform.operator.bootstrapped',
            version: 1,
            fields: {
              outcome: { kind: 'enum', values: ['created'] },
              rowVersion: { kind: 'integer', min: 1, max: 1 },
              authenticationVersion: { kind: 'integer', min: 1, max: 1 },
            },
          },
          { outcome: 'created', rowVersion: 1, authenticationVersion: 1 },
        );
        readyToCommit = true;
        return 'created' as const;
      },
    );
  } catch (error) {
    if (error instanceof BootstrapConflict) throw error;
    if (readyToCommit) throw new BootstrapUncertain();
    // Database diagnostics can include credential/identifier parameters.
    // eslint-disable-next-line preserve-caught-error -- Raw SQL diagnostics can contain credential parameters.
    throw new Error(
      'Bootstrap failed; verify trusted database access and schema; rerun safely',
    );
  }
}
