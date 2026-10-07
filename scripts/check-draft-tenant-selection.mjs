import assert from 'node:assert/strict';
const selection = process.argv.slice(2);
assert.ok(
  selection.length === 0 ||
    (selection.length === 1 && selection[0] === '--api'),
  'Supported draft tenant selection: --api',
);
process.argv.splice(2, process.argv.length - 2, '--draft-tenant');
await import('./check-session-foundation.mjs');
