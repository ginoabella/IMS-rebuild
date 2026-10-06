import { Admission } from '../../application/admission';
import { RedisDistributedLimiter } from '../redis/limiter';
import { TrustedSource } from '../http/trusted-source';
import type { BackendConfig } from '@myims/config';
import { SnapshotDatabase } from '../../../../infrastructure/database/read-snapshot';
import { SharedSessionLifecycle } from '../../application/session-lifecycle';
import { StaffAuthorityRepository } from '../db/authority-read';
import { PlatformAuthorityRepository } from '../../../platform/adapters/db/authority-read';
import { TenantAdmissionRepository } from '../../../tenancy/adapters/db/admission-read';
import { CanonicalSessionAuthority } from '../db/session-authority';
import { PostgresSessionFences } from '../db/session-fences';
import { RedisSessionRecords } from '../redis/session-records';
import { TransactionAuthority } from '../../application/transaction-authority';
import { RequestAuthority } from '../../application/request-authority';
export async function sessionRuntime(
  config: BackendConfig,
  requireReady = true,
) {
  const database = new SnapshotDatabase(config.database.url);
  const fences = new PostgresSessionFences(
    config.database.url,
    config.sessions,
  );
  const records = new RedisSessionRecords(
    config.sessionRedis.url,
    config.sessions,
  );
  const limiter = new RedisDistributedLimiter(
    config.sessionRedis.url,
    config.sessions,
    config.limiter,
  );
  const close = async () => {
    limiter.close();
    records.close();
    await Promise.all([fences.close(), database.close()]);
  };
  const tenants = new TenantAdmissionRepository();
  const staff = new StaffAuthorityRepository(database, tenants, tenants);
  const platform = new PlatformAuthorityRepository(database);
  // Await bounded connection/capacity validation before exposing the lifecycle.
  // HTTP still starts on failure so public health remains available.
  try {
    await Promise.all([records.connect(), limiter.connect()]);
  } catch {
    records.close();
    limiter.close();
    if (requireReady) {
      await close();
      throw new Error('Session dependencies unavailable');
    }
  }
  const lifecycle = new SharedSessionLifecycle(
    records,
    fences,
    new CanonicalSessionAuthority(staff, platform),
    config.sessions,
  );
  return {
    lifecycle,
    admission: new Admission(limiter),
    source: new TrustedSource(config.limiter.trustedProxies),
    authority: new RequestAuthority(lifecycle, staff, platform),
    transactionAuthority: new TransactionAuthority(staff, platform),
    fences,
    close,
  };
}
