import type { Transaction } from '../../../../infrastructure/database/transaction';
import { supportedHash } from '../../../../infrastructure/password/scrypt';
import { authorityVersion } from '../../../tenancy/domain/admission';
export const bootstrapCommand = 'deployment.bootstrap-operator';
export class BootstrapConflict extends Error {
  constructor() {
    super(
      'Bootstrap conflict; inspect durable provenance; recovery is a separate operation',
    );
  }
}
export class BootstrapRepository {
  async resolve(
    transaction: Transaction,
    username: string,
  ): Promise<'create' | 'existing'> {
    await transaction.query('SELECT pg_advisory_xact_lock($1)', [846258114]);
    const { rows } = await transaction.query(
      `SELECT p.command_reference,o.normalized_username,o.status,o.credential_state,
       o.password_hash,isfinite(o.credential_changed_at) AS finite,o.version,o.authentication_version
       FROM public.operator_bootstrap_provenance p JOIN public.platform_operators o ON o.id=p.operator_id
       WHERE p.singleton=true FOR UPDATE OF p,o`,
    );
    if (rows.length) {
      const row = rows[0];
      if (
        !row ||
        rows.length !== 1 ||
        row.command_reference !== bootstrapCommand ||
        row.normalized_username !== username ||
        row.status !== 'active' ||
        row.credential_state !== 'ready' ||
        row.finite !== true ||
        !supportedHash(row.password_hash) ||
        !authorityVersion(row.version) ||
        !authorityVersion(row.authentication_version)
      )
        throw new BootstrapConflict();
      return 'existing';
    }
    // A corrupt/orphaned provenance must never be treated as an empty foundation.
    const provenance = await transaction.query(
      'SELECT singleton FROM public.operator_bootstrap_provenance',
    );
    const account = await transaction.query(
      'SELECT id FROM public.platform_operators WHERE normalized_username=$1',
      [username],
    );
    if (provenance.rowCount || account.rowCount) throw new BootstrapConflict();
    return 'create';
  }
  async create(
    transaction: Transaction,
    id: string,
    username: string,
    hash: string,
  ): Promise<void> {
    await transaction.query(
      `INSERT INTO public.platform_operators
       (id,normalized_username,status,credential_state,password_hash,credential_changed_at,version,authentication_version)
       VALUES ($1,$2,'active','ready',$3,clock_timestamp(),1,1)`,
      [id, username, hash],
    );
    await transaction.query(
      'INSERT INTO public.operator_bootstrap_provenance (singleton,operator_id,command_reference) VALUES (true,$1,$2)',
      [id, bootstrapCommand],
    );
  }
}
