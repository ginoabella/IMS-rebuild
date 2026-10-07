import assert from 'node:assert/strict';
const selection = process.argv.slice(2);
assert.ok(
  selection.length === 0 ||
    (selection.length === 1 && ['--lifecycle', '--api'].includes(selection[0])),
  'Supported staff auth selections: --lifecycle, --api',
);
process.argv.splice(
  2,
  process.argv.length - 2,
  selection[0] === '--api' ? '--credential-api' : '--credential-lifecycle',
);
await import('./check-session-foundation.mjs');
