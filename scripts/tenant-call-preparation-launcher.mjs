// Trusted Docker lifecycle launcher. No additional service or public port.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { manifest, uuid } from './tenant-call-preparation-store.mjs';
const [action, file, ...args] = process.argv.slice(2);
const project = process.env.STORAGE_HOST_PROJECT_ROOT ?? process.cwd();
const image =
  'node:22.23.3-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c';
let stage = 'invalid_manifest';
let workerContainer = null;
function docker(argv, options = {}) {
  const r = spawnSync('docker', argv, {
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 1048576,
    ...options,
  });
  if (r.status !== 0)
    throw new Error('Controlled preparation Docker operation unavailable');
  return r.stdout;
}
try {
  const bytes = readFileSync(file);
  if (bytes.length > 8192) throw new Error();
  const p = manifest(JSON.parse(bytes));
  if (['observe-start', 'observe-status', 'observe-stop'].includes(action)) {
    stage = 'passive_observation_unavailable';
    if (args.length !== 1 || !uuid(args[0])) throw new Error();
    process.stdout.write(
      docker(
        [
          'exec',
          '-i',
          '--user',
          '0',
          'myims-rebuild-dev-asterisk-1',
          'node',
          '--input-type=module',
          '-',
          '--observe-native',
          JSON.stringify({
            action: action.slice(8),
            nodeId: p.nodeId,
            installationId: p.installationId,
            observationId: args[0],
          }),
        ],
        {
          input: readFileSync(
            new URL('./tenant-call-preparation-observe.mjs', import.meta.url),
            'utf8',
          ),
        },
      ),
    );
  } else if (action === 'worker-access') {
    stage = 'provider_worker_access_unavailable';
    if (args.length) throw new Error();
    process.stdout.write(
      docker([
        'run',
        '--rm',
        '--user',
        '0',
        '--network',
        'myims-rebuild-dev_endpoint-credentials',
        '--mount',
        `type=bind,src=${process.env.MYIMS_CUSTODIAN_PASSWORD_FILE ?? '/home/gino/.openbao-custodian/password'},dst=/human/password,readonly`,
        '--mount',
        `type=bind,src=${project}/.local/endpoint-credentials/ca.crt,dst=/trust/ca.crt,readonly`,
        '--mount',
        `type=bind,src=${project}/.local/endpoint-credentials,dst=/output`,
        '--mount',
        `type=bind,src=${project}/scripts/openbao,dst=/scripts,readonly`,
        image,
        'node',
        '/scripts/preparation-worker-access.mjs',
        p.installationId,
      ]),
    );
  } else if (action === 'credentials') {
    stage = 'credential_operation_unresolved';
    if (args.length) throw new Error();
    const name = 'myims-controlled-credentials-' + p.requestId;
    workerContainer = name;
    const workerState = () => {
      const present = docker([
        'ps',
        '-aq',
        '--filter',
        'name=^/' + name + '$',
      ]).trim();
      if (!present) return null;
      const value = JSON.parse(
        docker([
          'inspect',
          '--format',
          '{"state":{{json .State.Status}},"labels":{{json .Config.Labels}}}',
          name,
        ]),
      );
      if (
        value.labels?.['myims.controlled-preparation'] !== p.requestId ||
        value.labels?.['myims.installation'] !== p.installationId
      )
        throw new Error();
      return value.state;
    };
    const previous = workerState();
    if (previous) {
      if (!['exited', 'created', 'dead'].includes(previous)) {
        stage = 'credential_worker_in_progress';
        throw new Error();
      }
      docker(['rm', name]);
    }
    let created = false;
    let cleanupBlocked = false;
    try {
      const mounts = [];
      for (const path of [
        'services/backend',
        'packages/config',
        'packages/contracts',
      ])
        mounts.push(
          '--mount',
          `type=bind,src=${project}/${path},dst=/workspace/${path},readonly`,
        );
      for (const [suffix, path] of [
        ['0', 'node_modules'],
        ['10', 'services/backend/node_modules'],
        ['6', 'packages/config/node_modules'],
        ['7', 'packages/contracts/node_modules'],
      ])
        mounts.push(
          '--mount',
          `type=volume,src=myims-rebuild-dev_workspace-deps-${suffix},dst=/workspace/${path},readonly`,
        );
      for (const [source, target] of [
        ['runtime-db-password', 'db.password'],
        ['ca.crt', 'ca.crt'],
        [`worker-${p.installationId}.token`, 'worker.token'],
      ])
        mounts.push(
          '--mount',
          `type=bind,src=${project}/.local/endpoint-credentials/${source},dst=/run/endpoint/${target},readonly`,
        );
      docker([
        'create',
        '--name',
        name,
        '--label',
        `myims.controlled-preparation=${p.requestId}`,
        '--label',
        `myims.installation=${p.installationId}`,
        '--user',
        '1003:1003',
        '--network',
        'myims-rebuild-dev_endpoint-credentials',
        '--read-only',
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges',
        '--memory',
        '512m',
        ...mounts,
        '--mount',
        `type=bind,src=${project}/scripts/tenant-call-preparation-worker.mjs,dst=/worker.mjs,readonly`,
        '-e',
        'DATABASE_URL=postgresql://myims_runtime@postgres:5432/myims',
        '-e',
        'DATABASE_PASSWORD_FILE=/run/endpoint/db.password',
        '-e',
        'ENDPOINT_PROVIDER_URL=https://endpoint-secrets:8200',
        '-e',
        'ENDPOINT_PROVIDER_CA_FILE=/run/endpoint/ca.crt',
        '-e',
        'ENDPOINT_PROVIDER_TOKEN_FILE=/run/endpoint/worker.token',
        '-e',
        `ENDPOINT_PROVIDER_INSTALLATION_ID=${p.installationId}`,
        image,
        'node',
        '/worker.mjs',
        p.requestId,
      ]);
      created = true;
      docker([
        'network',
        'connect',
        'myims-rebuild-dev_endpoint-database',
        name,
      ]);
      process.stdout.write(docker(['start', '-a', name]));
    } finally {
      if (created) {
        try {
          const state = workerState();
          if (state) {
            if (!['exited', 'created', 'dead'].includes(state)) {
              stage = 'credential_worker_in_progress';
              cleanupBlocked = true;
            } else docker(['rm', name]);
          }
        } catch {
          stage = 'credential_worker_cleanup_unresolved';
          cleanupBlocked = true;
        }
      }
    }
    if (cleanupBlocked) throw new Error();
  } else {
    if (
      ![
        'preview',
        'prepare',
        'reconcile',
        'status',
        'start',
        'restart',
        'stop',
        'disable',
      ].includes(action)
    )
      throw new Error();
    if (
      ['preview', 'prepare', 'reconcile', 'start', 'restart'].includes(action)
    ) {
      stage = 'retained_profile_or_custody_unavailable';
      const native = spawnSync(
        process.execPath,
        ['scripts/pbx-profile.mjs', 'status', p.nodeId, p.installationId],
        { encoding: 'utf8', timeout: 60000, maxBuffer: 1048576 },
      );
      if (native.status !== 0) throw new Error();
      const proof = JSON.parse(native.stdout);
      const materialProbeRequired = proof.blockers.includes(
        'exact_provider_material_probe_required',
      );
      if (materialProbeRequired) {
        const status = JSON.parse(
          docker([
            'exec',
            '--user',
            'node',
            'myims-rebuild-dev-workspace-1',
            'node',
            '/workspace/scripts/tenant-call-preparation.mjs',
            'status',
            file,
          ]),
        );
        if (!status.custody?.current) throw new Error();
      }
      if (
        proof.blockers.some(
          (code) => code !== 'exact_provider_material_probe_required',
        ) ||
        proof.profileUpgradeRequired ||
        !proof.exactProtectedAndLoadedRuntimeMatch ||
        proof.unmanagedDigest !== p.expectedProfileDigest
      )
        throw new Error();
      const sockets = JSON.parse(
        docker([
          'exec',
          '--user',
          '0',
          'myims-rebuild-dev-asterisk-1',
          'node',
          '--input-type=module',
          '-e',
          'import {readFileSync,lstatSync} from "node:fs";import {createHash} from "node:crypto";const path="/usr/local/lib/myims/tenant-routing-agi.mjs",stat=lstatSync(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.uid!==0||(stat.mode&511)!==365||stat.size>32768)throw Error();const rows=["/proc/net/udp","/proc/net/udp6"].flatMap(p=>readFileSync(p,"utf8").trim().split("\\n").slice(1));console.log(JSON.stringify({agiSha256:createHash("sha256").update(readFileSync(path)).digest("hex"),busy:rows.some(r=>[20020,20021].includes(parseInt(r.trim().split(/\\s+/)[1].split(":")[1],16)))}));',
        ]),
      );
      const expectedAgi = createHash('sha256')
        .update(
          readFileSync(new URL('./tenant-routing-agi.mjs', import.meta.url)),
        )
        .digest('hex');
      if (sockets.busy) {
        stage = 'private_port_conflict';
        throw new Error();
      }
      if (sockets.agiSha256 !== expectedAgi) {
        stage = 'native_agi_asset_mismatch';
        throw new Error();
      }
    }
    stage = 'canonical_preparation_unavailable';
    const result = spawnSync(
      'docker',
      [
        'exec',
        '--user',
        'node',
        'myims-rebuild-dev-workspace-1',
        'node',
        '/workspace/scripts/tenant-call-preparation.mjs',
        action,
        file,
        ...args,
      ],
      { encoding: 'utf8', timeout: 120000, maxBuffer: 1048576 },
    );
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.status !== 0) {
      if (!result.stdout) throw new Error();
      process.exitCode = 2;
    }
  }
} catch {
  console.log(
    JSON.stringify({
      state: 'blocked',
      reason: stage,
      ...(workerContainer ? { workerContainer } : {}),
    }),
  );
  console.error(
    'Preparation blocked or unresolved. Use passive inspect/status and exact request reconciliation; native, port or protected dependency checks may be unavailable.',
  );
  process.exitCode = 2;
}
