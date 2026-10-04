import PgBoss from 'pg-boss';
import type { Client } from 'pg';
export const QUEUE = 'committed-work-v1';
// Runs only while the trusted deployment advisory lock is held.
export async function provisionQueue(client: Client) {
  const boss = new PgBoss({
    db: { executeSql: (sql, values) => client.query(sql, values) },
    migrate: true,
    supervise: false,
    schedule: false,
  });
  boss.on('error', () => {});
  try {
    await boss.start();
    await boss.createQueue(QUEUE);
    await client.query(`
      REVOKE ALL ON SCHEMA pgboss FROM PUBLIC, myims_runtime;
      REVOKE ALL ON ALL TABLES IN SCHEMA pgboss FROM PUBLIC, myims_runtime;
      REVOKE ALL ON ALL FUNCTIONS IN SCHEMA pgboss FROM PUBLIC, myims_runtime;
      GRANT USAGE ON SCHEMA pgboss TO myims_runtime;
      GRANT SELECT ON pgboss.version, pgboss.queue TO myims_runtime;
      GRANT SELECT, INSERT, UPDATE, DELETE ON pgboss.job TO myims_runtime;
    `);
  } finally {
    await boss.stop();
  }
}
