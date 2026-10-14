import assert from 'node:assert/strict';
assert.ok(
  process.argv.length === 2 ||
    (process.argv.length === 3 &&
      ['--registry', '--observation'].includes(process.argv[2])),
  'Supported PBX selections: --registry, --observation',
);
if (process.argv[2] === '--observation')
  throw new Error(
    'Live observation selection requires ./dev exec pnpm check:pbx-nodes --observation trusted provisioning launcher',
  );
process.argv.splice(2, process.argv.length - 2, '--pbx-registry');
await import('./check-session-foundation.mjs');
