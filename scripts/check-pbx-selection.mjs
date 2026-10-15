import assert from 'node:assert/strict';
assert.ok(
  process.argv.length === 2 ||
    (process.argv.length === 3 &&
      ['--registry', '--observation', '--browser'].includes(process.argv[2])),
  'Supported PBX selections: --registry, --observation, --browser',
);
if (process.argv[2] !== '--registry')
  throw new Error(
    'Live observation/browser selections require ./dev exec pnpm check:pbx-nodes --observation/--browser trusted provisioning launcher',
  );
process.argv.splice(2, process.argv.length - 2, '--pbx-registry');
await import('./check-session-foundation.mjs');
