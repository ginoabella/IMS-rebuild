import assert from 'node:assert/strict';
const selection = process.argv.slice(2);
assert.ok(
  selection.length === 0 ||
    (selection.length === 1 &&
      [
        '--api',
        '--browser',
        '--onboarding-api',
        '--onboarding-browser',
      ].includes(selection[0])),
  'Supported draft tenant selections: --api, --browser, --onboarding-api, --onboarding-browser',
);
process.argv.splice(
  2,
  process.argv.length - 2,
  ['--api', '--onboarding-api'].includes(selection[0])
    ? '--draft-tenant'
    : ['--browser', '--onboarding-browser'].includes(selection[0])
      ? '--draft-browser'
      : '--draft-integrated',
);
await import('./check-session-foundation.mjs');
