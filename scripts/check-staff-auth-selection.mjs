import assert from 'node:assert/strict';
const selection = process.argv.slice(2);
assert.ok(
  selection.length === 0 ||
    (selection.length === 1 &&
      ['--lifecycle', '--api', '--http', '--browser', '--mobile'].includes(
        selection[0],
      )),
  'Supported staff auth selections: --lifecycle, --api, --http, --browser, --mobile',
);
if (selection.length === 0 || selection[0] === '--mobile')
  await import('./check-staff-mobile.mjs');
if (selection[0] === '--mobile') process.exit(0);
process.argv.splice(
  2,
  process.argv.length - 2,
  ...(selection.length === 0
    ? []
    : [
        selection[0] === '--http'
          ? '--staff-http'
          : selection[0] === '--api'
            ? '--credential-api'
            : selection[0] === '--browser'
              ? '--credential-browser'
              : '--credential-lifecycle',
      ]),
);
await import('./check-session-foundation.mjs');
