import assert from 'node:assert/strict';
assert.ok(
  process.argv.length === 2 ||
    (process.argv.length === 3 &&
      ['--inventory', '--credentials', '--credentials-api'].includes(
        process.argv[2],
      )),
  'Supported selections: --inventory, --credentials',
);
process.argv.splice(
  2,
  process.argv.length - 2,
  process.argv[2] === '--credentials-api'
    ? '--endpoint-credentials-api'
    : process.argv[2] === '--credentials'
      ? '--endpoint-credentials'
      : '--extension-inventory',
);
await import('./check-session-foundation.mjs');
