import assert from 'node:assert/strict';
assert.ok(
  process.argv.length === 2 ||
    (process.argv.length === 3 && process.argv[2] === '--registry'),
  'Supported PBX selection: --registry',
);
process.argv.splice(2, process.argv.length - 2, '--pbx-registry');
await import('./check-session-foundation.mjs');
