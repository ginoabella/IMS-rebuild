import { existsSync, readdirSync } from 'node:fs';
/** Fresh/rerun checks compare exact history with deployment-owned source migrations. */
export function expectedMigrationNames() {
  const directory = new URL('../infra/database/migrations/', import.meta.url);
  const names = readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(new URL(`${entry.name}/migration.sql`, directory)),
    )
    .map((entry) => entry.name)
    .sort();
  if (!names.length) throw new Error('Migration sources missing');
  return names;
}
