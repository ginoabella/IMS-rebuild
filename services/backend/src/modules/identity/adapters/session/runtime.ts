import type { BackendConfig } from '@myims/config';
import { SnapshotDatabase } from '../../../../infrastructure/database/read-snapshot';
import { SharedSessionLifecycle } from '../../application/session-lifecycle';
import { StaffAuthorityRepository } from '../db/authority-read';
import { PlatformAuthorityRepository } from '../../../platform/adapters/db/authority-read';
import { TenantAdmissionRepository } from '../../../tenancy/adapters/db/admission-read';
import { CanonicalSessionAuthority } from '../db/session-authority';
import { PostgresSessionFences } from '../db/session-fences';
import { RedisSessionRecords } from '../redis/session-records';
// Trusted backend consumers only; b owns HTTP dependency registration.
export async function sessionRuntime(config: BackendConfig) {
  const database = new SnapshotDatabase(config.database.url);
  const fences = new PostgresSessionFences(
    config.database.url,
    config.sessions,
  );
  const records = new RedisSessionRecords(
    config.sessionRedis.url,
    config.sessions,
  );
  const close = async () => {
    records.close();
    await Promise.all([fences.close(), database.close()]);
  };
  try {
    await records.connect();
  } catch {
    await close();
    throw new Error('Session dependencies unavailable');
  }
  return {
    lifecycle: new SharedSessionLifecycle(
      records,
      fences,
      new CanonicalSessionAuthority(
        new StaffAuthorityRepository(database, new TenantAdmissionRepository()),
        new PlatformAuthorityRepository(database),
      ),
      config.sessions,
    ),
    fences,
    close,
  };
}
