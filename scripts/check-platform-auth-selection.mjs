import assert from 'node:assert/strict';
const selection = process.argv.slice(2);
assert.ok(
  selection.length === 0 ||
    (selection.length === 1 && ['--http', '--browser'].includes(selection[0])),
  'Supported platform authentication selections: --http, --browser',
);
process.argv.splice(
  2,
  process.argv.length - 2,
  selection[0] === '--http'
    ? '--platform-http'
    : selection[0] === '--browser'
      ? '--platform-browser'
      : '--platform-auth',
);
await import('./check-session-foundation.mjs');
