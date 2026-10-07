import assert from 'node:assert/strict';
const selection = process.argv.slice(2);
assert.ok(
  selection.length === 0 ||
    (selection.length === 1 && ['--api', '--browser'].includes(selection[0])),
  'Supported draft tenant selections: --api, --browser',
);
process.argv.splice(
  2,
  process.argv.length - 2,
  selection[0] === '--api'
    ? '--draft-tenant'
    : selection[0] === '--browser'
      ? '--draft-browser'
      : '--draft-integrated',
);
await import('./check-session-foundation.mjs');
