import assert from 'node:assert/strict';
assert.ok(
  process.argv.length === 2 ||
    (process.argv.length === 3 && process.argv[2] === '--inventory'),
  'Supported selection: --inventory',
);
process.argv.splice(2, process.argv.length - 2, '--extension-inventory');
await import('./check-session-foundation.mjs');
