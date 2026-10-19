// Trusted Docker acceptance owner. Never imported by HTTP or a runtime worker.
import { spawnSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
const browserFixture = process.argv[2] === '--inventory-browser';
const restrictedFixtureFile =
  '.local/endpoint-fixtures/restricted-installation.json';
const restrictedFixture = existsSync(restrictedFixtureFile)
  ? JSON.parse(readFileSync(restrictedFixtureFile, 'utf8'))
  : null;
if (
  restrictedFixture &&
  (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(
    restrictedFixture.installationId ?? '',
  ) ||
    restrictedFixture.version !== 1)
)
  throw new Error('Invalid restricted fixture installation');
const installationId = browserFixture
  ? JSON.parse(readFileSync('.local/pbx-catalog/catalog.json', 'utf8'))[0]
      .installationId
  : (restrictedFixture?.installationId ?? randomUUID());
const fixtureRun = randomUUID();
const project = process.env.STORAGE_HOST_PROJECT_ROOT;
const custody = `${project}/.local/endpoint-credentials`;
const network = 'myims-rebuild-dev_endpoint-credentials';
const bindings = new Map(),
  captured = [];
const pending = new Set();
let scopeStarted = false,
  provisioningUncertain = false;
let database,
  fixtureResults,
  browserAccessRevoked = false,
  providerNeedsUnseal = false;
export const endpointAccess = { installationId };
function docker(args, input) {
  const r = spawnSync('docker', args, {
    input,
    encoding: 'utf8',
    timeout: 60000,
  });
  if (r.status !== 0) throw new Error('Endpoint fixture deployment failed');
  return r.stdout;
}
function provision(command) {
  return docker([
    'run',
    '--rm',
    '--user',
    '1003:1003',
    '--network',
    network,
    '-v',
    `${custody}:/custody`,
    '-v',
    `${project}/scripts/provision-endpoint-credentials.mjs:/provision.mjs:ro`,
    '-v',
    `${project}/scripts/openbao:/openbao:ro`,
    'node:22.23.3-bookworm-slim',
    'node',
    '/provision.mjs',
    command,
    ...(command === 'unseal' ? [] : [installationId]),
    ...(command === 'provision-fixture' ? [fixtureRun] : []),
  ]);
}
export function provisionEndpointFixture() {
  {
    for (const role of ['worker', 'cleanup'])
      if (
        existsSync(
          `.local/endpoint-credentials/${role}-${installationId}.token`,
        )
      )
        throw new Error(
          'Existing provider access must not be adopted or revoked',
        );
    scopeStarted = true;
    persist();
  }
  try {
    provision(browserFixture ? 'provision-fixture' : 'provision');
  } catch (error) {
    provisioningUncertain = true;
    persist();
    throw error;
  }
}
function args(name, script, role = 'worker', scan = false) {
  const mounts = [];
  for (const p of ['services/backend', 'packages/config', 'packages/contracts'])
    mounts.push('-v', `${project}/${p}:/workspace/${p}:ro`);
  for (const [v, p] of [
    ['0', 'node_modules'],
    ['10', 'services/backend/node_modules'],
    ['6', 'packages/config/node_modules'],
    ['7', 'packages/contracts/node_modules'],
  ])
    mounts.push(
      '-v',
      `myims-rebuild-dev_workspace-deps-${v}:/workspace/${p}:ro`,
    );
  return [
    'create',
    '-i',
    '--name',
    name,
    '--network',
    network,
    '--user',
    '1003:1003',
    '--entrypoint',
    'node',
    '-w',
    '/workspace',
    ...mounts,
    '-v',
    `${project}/scripts/${script}:/fixture.mjs:ro`,
    '-v',
    `${custody}/runtime-db-password:/run/db-password:ro`,
    '-v',
    `${custody}/ca.crt:/run/ca.crt:ro`,
    '-v',
    `${custody}/${role}-${installationId}.token:/run/provider.token:ro`,
    '-e',
    'DATABASE_URL=postgresql://myims_runtime@postgres:5432/myims',
    '-e',
    'DATABASE_PASSWORD_FILE=/run/db-password',
    '-e',
    'ENDPOINT_PROVIDER_URL=https://endpoint-secrets:8200',
    '-e',
    'ENDPOINT_PROVIDER_CA_FILE=/run/ca.crt',
    '-e',
    'ENDPOINT_PROVIDER_TOKEN_FILE=/run/provider.token',
    '-e',
    `ENDPOINT_PROVIDER_INSTALLATION_ID=${installationId}`,
    ...(scan
      ? ['-v', 'myims-rebuild-dev_endpoint-secrets-audit:/provider-audit:ro']
      : []),
    'node:22.23.3-bookworm-slim',
    '/fixture.mjs',
  ];
}
function persist(results) {
  if (results) fixtureResults = results;
  mkdirSync('.local/endpoint-fixtures', { recursive: true, mode: 0o700 });
  writeFileSync(
    `.local/endpoint-fixtures/${installationId}${browserFixture ? `-${fixtureRun}` : ''}.json`,
    JSON.stringify({
      database,
      installationId,
      scopeStarted,
      provisioningUncertain,
      accessRevoked: browserAccessRevoked,
      ...(browserFixture
        ? {
            fixtureRun,
            accessRevoked: browserAccessRevoked,
            scopeStarted,
            provisioningUncertain,
            policies: ['worker', 'cleanup'].map((role) =>
              restrictedFixture
                ? `endpoint-${role}-${installationId}`
                : `endpoint-${role}-${installationId}-${fixtureRun}`,
            ),
          }
        : {}),
      bindings: [...bindings.values()],
      ...(fixtureResults ? { results: fixtureResults } : {}),
    }),
    { mode: 0o600 },
  );
}
export function endpointFixtureRequest(line) {
  const running = runRequest(line);
  pending.add(running);
  running.finally(() => pending.delete(running)).catch(() => {});
  return running;
}
async function runRequest(line) {
  const input = JSON.parse(line.slice('ENDPOINT_FIXTURE_REQUEST '.length));
  if (
    !/^[a-f0-9-]{36}$/.test(input.controlId) ||
    !/^myims_session_[a-f0-9]{12}$/.test(input.database)
  )
    throw new Error('Invalid endpoint fixture request');
  if (database && database !== input.database)
    throw new Error('Cross-database fixture denied');
  database = input.database;
  let result;
  if (input.action === 'provider_stop') {
    docker(['stop', 'myims-rebuild-dev-endpoint-secrets-1']);
    providerNeedsUnseal = true;
    result = { stopped: true };
  } else if (input.action === 'provider_restart') {
    docker(['restart', 'myims-rebuild-dev-endpoint-secrets-1']);
    providerNeedsUnseal = true;
    result = { sealed: true };
  } else if (input.action === 'provider_unseal') {
    provision('unseal');
    providerNeedsUnseal = false;
    result = { unsealed: true };
  } else {
    if (input.tokenExpired) {
      provision('provision-expiring');
      spawnSync('node', ['-e', 'setTimeout(()=>{},2000)']);
    }
    const name = `myims-endpoint-fixture-${input.controlId}`;
    try {
      docker(
        args(
          name,
          'endpoint-credential-fixture.mjs',
          input.tokenExpired
            ? 'worker-expiring'
            : ['cleanup', 'acl-cleanup', 'fixture-destroy'].includes(
                  input.action,
                )
              ? 'cleanup'
              : 'worker',
          input.action === 'scan',
        ),
      );
      docker([
        'network',
        'connect',
        'myims-rebuild-dev_endpoint-database',
        name,
      ]);
      if (input.action === 'scan')
        input.capturedLogs =
          captured.join('') +
          docker(['logs', 'myims-rebuild-dev-endpoint-secrets-1']);
      const r = await new Promise((resolve, reject) => {
        const child = spawn('docker', ['start', '-ai', name], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stdout = '',
          stderr = '',
          partial = '';
        child.stdout.on('data', (bytes) => {
          stdout += bytes;
          partial += bytes;
          let newline;
          while ((newline = partial.indexOf('\n')) >= 0) {
            const line = partial.slice(0, newline);
            partial = partial.slice(newline + 1);
            if (line.includes('"fixture":"endpoint-reservation"')) {
              const v = JSON.parse(line);
              bindings.set(v.binding.operationId, v.binding);
              persist();
            }
          }
        });
        child.stderr.on('data', (bytes) => (stderr += bytes));
        child.on('error', reject);
        const timer = setTimeout(() => child.kill('SIGKILL'), 60000);
        child.on('exit', (code) => {
          clearTimeout(timer);
          resolve({ stdout, stderr, status: code });
        });
        child.stdin.end(JSON.stringify(input));
      });
      captured.push(r.stdout + r.stderr);
      for (const line of r.stdout.split('\n'))
        if (line.includes('"fixture":"endpoint-reservation"')) {
          const reservation = JSON.parse(line);
          bindings.set(reservation.binding.operationId, reservation.binding);
          persist();
        }
      if (
        docker(['inspect', name, '--format', '{{.State.ExitCode}}']).trim() ===
        '74'
      )
        result = { interrupted: true };
      else {
        const last = r.stdout
          .split('\n')
          .find((x) => x.includes('"fixture":"endpoint-credential"'));
        result = last ? JSON.parse(last).result : { failed: true };
      }
    } finally {
      docker(['rm', '-f', name]);
    }
  }
  docker(
    [
      'exec',
      '-i',
      '--user',
      'node',
      'myims-rebuild-dev-workspace-1',
      'node',
      '-e',
      `const fs=require('fs'),p='/tmp/myims-endpoint-responses/${input.controlId}.json';fs.writeFileSync(p+'.tmp',fs.readFileSync(0),{mode:0o600});fs.renameSync(p+'.tmp',p)`,
    ],
    JSON.stringify(result),
  );
}
export async function cleanupEndpointFixture() {
  if (!scopeStarted) return;
  if (provisioningUncertain)
    throw new Error(
      'Provider fixture provisioning uncertain; preserve protected recovery manifest and stop dependent acceptance',
    );
  await Promise.allSettled([...pending]);
  if (providerNeedsUnseal) {
    docker(['start', 'myims-rebuild-dev-endpoint-secrets-1']);
    provision('unseal');
    providerNeedsUnseal = false;
  }
  if (!bindings.size) {
    {
      provision('revoke-fixture');
      browserAccessRevoked = true;
      persist();
      console.log(
        JSON.stringify({
          check: 'inventory-provider-access-cleanup',
          installationId,
          fixtureRun,
          tokensRevoked: true,
          tokenFilesRemoved: true,
          policyMetadata: 'retained_without_tokens',
        }),
      );
    }
    return;
  }
  const name = `myims-endpoint-teardown-${randomUUID()}`;
  try {
    docker(args(name, 'endpoint-credential-fixture-teardown.mjs', 'cleanup'));
    const output = docker(
      ['start', '-ai', name],
      JSON.stringify({ database, bindings: [...bindings.values()] }),
    );
    const result = JSON.parse(
      output
        .split('\n')
        .find((x) => x.includes('"fixture":"endpoint-teardown"')),
    );
    persist(result.results);
    console.log(
      JSON.stringify({
        check: 'endpoint-fixture-teardown',
        generations: bindings.size,
        destroyed: result.results.filter((r) => r.outcome === 'destroyed')
          .length,
        absent: result.results.filter((r) => r.outcome === 'absent').length,
      }),
    );
  } finally {
    docker(['rm', '-f', name]);
    {
      provision('revoke-fixture');
      browserAccessRevoked = true;
      persist();
      console.log(
        JSON.stringify({
          check: 'inventory-provider-access-cleanup',
          installationId,
          fixtureRun,
          tokensRevoked: true,
          tokenFilesRemoved: true,
          policyMetadata: 'retained_without_tokens',
        }),
      );
    }
  }
}
