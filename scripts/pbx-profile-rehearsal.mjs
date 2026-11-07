// Actual PostgreSQL/Asterisk copy. Every mutation is confined to exact owned fixtures.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { expectations } from './pbx-profile-inspect.mjs';
import { dispatchProfileRestart } from './pbx-profile-dispatch.mjs';
const expected = expectations(
  JSON.parse(readFileSync(process.argv[2], 'utf8')),
);
const smoke = process.argv[3] === '--smoke';
const safety = process.argv[3] === '--safety';
const single = process.argv[3] === '--case' ? process.argv[4] : null;
if (process.argv.length !== (single ? 5 : smoke || safety ? 4 : 3))
  throw new Error(
    'Use exact expectations and optional --smoke, --safety or --case CASE',
  );
const safetyCases = [
  'active_call',
  'unknown_activity',
  'owner_loss',
  'competing_intents',
  'console_recovery',
  'missing_custody',
  'restart_before',
  'restart_after',
  'version_race',
  'bootstrap_boot_loss',
  'partial_boot_loss',
];
const project = process.env.STORAGE_HOST_PROJECT_ROOT ?? process.cwd();
const cases = smoke
  ? ['normal']
  : safety
    ? safetyCases
    : [
        'normal',
        'preparation_before',
        'static_before',
        'static_after',
        'managed_before',
        'managed_after',
        'preparation_after',
        'native_proof_after',
        'native_ack_after',
        'sql_ack_before',
        'sql_ack_after',
        'sql_failure',
        ...safetyCases,
      ];
if (single) {
  if (!cases.includes(single)) throw new Error('Unknown isolated case');
  cases.splice(0, cases.length, single);
}
function docker(args, { input, timeout = 30000 } = {}) {
  const result = spawnSync('docker', args, {
    input,
    timeout,
    maxBuffer: 67108864,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error('Owned profile fixture command failed');
  }
  return result.stdout;
}
const text = (args, options) => docker(args, options).toString('utf8');
const originalImage = 'myims-rebuild-dev-asterisk-live';
const legacySupervisor = docker([
  'exec',
  'myims-rebuild-dev-asterisk-1',
  'cat',
  '/usr/local/lib/myims/start-pbx-live.sh',
]);
const dump = docker([
  'exec',
  'myims-rebuild-dev-postgres-1',
  'pg_dump',
  '-U',
  'myims',
  '-d',
  'myims',
  '--format=custom',
  '--no-owner',
]);
const archive = docker([
  'exec',
  'myims-rebuild-dev-asterisk-1',
  'tar',
  '-C',
  '/',
  '--hard-dereference',
  '-cf',
  '-',
  'etc/asterisk',
  'var/lib/myims-pbx/control/' + expected.nodeId,
  'var/lib/myims-pbx/managed',
  'run/pbx-live-native',
  'run/pbx-server',
]);
const reports = [];
for (const point of cases) {
  const token = randomBytes(6).toString('hex'),
    database = 'myims_session_' + token,
    name = 'myims-profile-rehearsal-' + token;
  const owned = new Map(
    ['configuration', 'data', 'native', 'server', 'socket'].map((kind) => [
      kind,
      name + '-' + kind,
    ]),
  );
  let created = false,
    databaseCreated = false,
    helperCreated = false,
    ownerCreated = false,
    stage = 'create';
  let restartLossInjected = false;
  let cleanupComplete;
  let naturalActivityDeadline = 0;
  let bootRecoveryStarts = 0;
  const helper = name + '-populate';
  const workspacePrefix = [
    'exec',
    '-i',
    '--user',
    'node',
    'myims-rebuild-dev-workspace-1',
    'env',
    'MIGRATION_DATABASE_URL=postgresql://myims@postgres:5432/' + database,
  ];
  function coordinate(action) {
    return text(
      [
        'exec',
        '--user',
        'node',
        'myims-rebuild-dev-workspace-1',
        'node',
        '/workspace/scripts/pbx-profile-fixture-database.mjs',
        action,
        database,
        expected.nodeId,
      ],
      { timeout: 60000 },
    );
  }
  function operation(action, input) {
    const output = text([
      ...workspacePrefix,
      'node',
      '/workspace/scripts/pbx-profile-operation.mjs',
      action,
      JSON.stringify(input),
    ]);
    return JSON.parse(output.trim().split('\n').at(-1));
  }
  function state() {
    return JSON.parse(coordinate('state'));
  }
  function native(code, args = []) {
    return text(['exec', name, 'node', '-e', code, ...args]);
  }
  function create(image, legacy = false) {
    const args = [
      'create',
      '--name',
      name,
      '--label',
      'myims.profile-fixture=' + token,
      '--network',
      'myims-rebuild-dev_default',
      '--cap-add',
      'NET_ADMIN',
      '-e',
      'PBX_LIVE_PROFILE=approved-local-development',
    ];
    for (const [kind, target] of [
      ['configuration', '/etc/asterisk'],
      ['data', '/var/lib/myims-pbx'],
      ['native', '/run/pbx-live-native'],
      ['server', '/run/pbx-server'],
      ['socket', '/run/pbx-live'],
    ])
      args.push('--mount', `type=volume,src=${owned.get(kind)},dst=${target}`);
    for (const [source, target] of [
      [project + '/services/backend/dist', '/workspace/services/backend/dist'],
      [
        project + '/services/backend/package.json',
        '/workspace/services/backend/package.json',
      ],
      [project + '/packages/config', '/workspace/packages/config'],
      [project + '/packages/contracts', '/workspace/packages/contracts'],
      [
        project + '/scripts/pbx-profile-fixture-native.mjs',
        '/fixture-native.mjs',
      ],
      [
        project + '/scripts/pbx-profile-fixture-owner.mjs',
        '/fixture-owner.mjs',
      ],
      [
        project + '/scripts/pbx-profile-fixture-owner.sh',
        '/usr/local/lib/myims/native-owner.sh',
      ],
      [
        project + '/scripts/pbx-static-profile-fixture.mjs',
        '/fixture-static.mjs',
      ],
    ])
      args.push('--mount', `type=bind,src=${source},dst=${target},readonly`);
    for (const [source, target] of [
      ['workspace-deps-0', '/workspace/node_modules'],
      ['workspace-deps-10', '/workspace/services/backend/node_modules'],
      ['workspace-deps-6', '/workspace/packages/config/node_modules'],
      ['workspace-deps-7', '/workspace/packages/contracts/node_modules'],
    ])
      args.push(
        '--mount',
        `type=volume,src=myims-rebuild-dev_${source},dst=${target},readonly`,
      );
    args.push(
      '--entrypoint',
      '/bin/sh',
      image,
      legacy
        ? '/var/lib/myims-pbx/fixture-legacy-supervisor.sh'
        : '/usr/local/lib/myims/start-pbx-live.sh',
    );
    docker(args);
    created = true;
  }
  function startOwner() {
    if (ownerCreated) return;
    const args = [
      'run',
      '-d',
      '--name',
      name + '-owner',
      '--label',
      'myims.profile-fixture=' + token,
      '--network',
      'myims-rebuild-dev_default',
    ];
    for (const [source, target] of [
      [project + '/services/backend/dist', '/workspace/services/backend/dist'],
      [
        project + '/services/backend/package.json',
        '/workspace/services/backend/package.json',
      ],
      [project + '/packages/config', '/workspace/packages/config'],
      [project + '/packages/contracts', '/workspace/packages/contracts'],
      [
        project + '/scripts/pbx-profile-fixture-owner.mjs',
        '/fixture-owner.mjs',
      ],
      [
        project + '/.local/pbx-live/native/db.password',
        '/input/executor.password',
      ],
      [
        project + '/.local/shared-services/runtime-postgres-password',
        '/input/runtime.password',
      ],
    ])
      args.push('--mount', `type=bind,src=${source},dst=${target},readonly`);
    for (const [source, target] of [
      ['workspace-deps-0', '/workspace/node_modules'],
      ['workspace-deps-10', '/workspace/services/backend/node_modules'],
      ['workspace-deps-6', '/workspace/packages/config/node_modules'],
      ['workspace-deps-7', '/workspace/packages/contracts/node_modules'],
    ])
      args.push(
        '--mount',
        `type=volume,src=myims-rebuild-dev_${source},dst=${target},readonly`,
      );
    args.push(
      '--mount',
      `type=volume,src=${owned.get('socket')},dst=/run/pbx-live,readonly`,
      'node:22.23.3-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c',
      'node',
      '/fixture-owner.mjs',
      database,
      expected.nodeId,
    );
    docker(args);
    ownerCreated = true;
  }
  async function waitOwner() {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      try {
        const s = state();
        if (
          s.owner_current &&
          s.executor_current &&
          s.boundary_epoch === s.canonical_epoch
        ) {
          const ready = native(
            'const fs=require("node:fs");const c=JSON.parse(fs.readFileSync("/run/pbx-live-native/configuration.json"));const b=JSON.parse(fs.readFileSync("/var/lib/myims-pbx/control/"+c.nodeId+"/boundary.json"));process.stdout.write(b.epoch)',
          );
          if (ready === s.boundary_epoch) return;
        }
      } catch {
        /* bounded startup */
      }
      await delay(500);
    }
    throw new Error('Isolated owner unavailable');
  }
  async function restart(identity, targetArtifactId, targetDigest) {
    await dispatchProfileRestart({
      workspacePrefix,
      identity,
      nativeContainer: name,
      targetArtifactId,
      targetDigest,
      effect: async () => {
        if (point === 'restart_before' && !restartLossInjected) {
          docker(['kill', '--signal', 'KILL', name]);
          restartLossInjected = true;
        } else docker(['stop', '--time', '10', name], { timeout: 20000 });
        docker(['rm', '-v', name]);
        created = false;
        create('myims-rebuild-dev-asterisk-live');
        docker(['start', name]);
        if (point === 'restart_after' && !restartLossInjected) {
          docker(['kill', '--signal', 'KILL', name]);
          restartLossInjected = true;
          docker(['rm', '-v', name]);
          created = false;
          create('myims-rebuild-dev-asterisk-live');
          docker(['start', name]);
        }
        startOwner();
      },
    });
  }
  function metadata(id) {
    return JSON.parse(
      native(
        'const fs=require("node:fs");const c=JSON.parse(fs.readFileSync("/run/pbx-live-native/configuration.json"));const p=JSON.parse(fs.readFileSync("/var/lib/myims-pbx/control/"+c.nodeId+"/plans/"+process.argv[1]+".json"));process.stdout.write(JSON.stringify({compilerVersion:p.identity.compilerVersion,policyVersion:p.identity.policyVersion,unmanagedDigest:p.unmanaged}))',
        [id],
      ),
    );
  }
  function consoleAction(action, target = expected.initialBaselineId) {
    const output = text([
      'exec',
      '--user',
      'node',
      'myims-rebuild-dev-workspace-1',
      'node',
      '/workspace/scripts/pbx-profile-fixture-console.mjs',
      database,
      expected.nodeId,
      action,
      target,
    ]);
    return JSON.parse(output.trim().split('\n').at(-1));
  }
  function selections() {
    return JSON.parse(
      native(
        'const fs=require("node:fs");const c=JSON.parse(fs.readFileSync("/run/pbx-live-native/configuration.json"));const p="/var/lib/myims-pbx/control/"+c.nodeId+"/fixture-selections.jsonl";process.stdout.write(JSON.stringify(fs.existsSync(p)?fs.readFileSync(p,"utf8").trim().split("\\n").filter(Boolean).map(l=>JSON.parse(l)):[]))',
      ),
    );
  }
  function request(kind, id, target, digest, predecessor = null) {
    const s = state(),
      source = metadata(s.verified_id);
    return {
      operationId: id,
      nodeId: expected.nodeId,
      installationId: expected.installationId,
      kind,
      sourceArtifactId: s.verified_id,
      sourceDigest: source.unmanagedDigest,
      targetArtifactId: target,
      targetDigest: digest,
      nodeVersion: s.node_version,
      compilerVersion: source.compilerVersion,
      policyVersion: source.policyVersion,
      initialBaselineId: expected.initialBaselineId,
      predecessorId: predecessor,
    };
  }
  async function result(identity, { allowUnknown = false } = {}) {
    const end = Date.now() + 45000;
    while (Date.now() < end) {
      const row = operation('status', identity);
      if (
        ['verified', 'rolled_back', 'prepared'].includes(row.state) ||
        (allowUnknown && row.state === 'unknown')
      )
        return row;
      await delay(250);
    }
    throw new Error('Isolated transition result unavailable');
  }
  const historyCode =
    'const fs=require("node:fs"),crypto=require("node:crypto");const c=JSON.parse(fs.readFileSync("/run/pbx-live-native/configuration.json"));const r="/var/lib/myims-pbx/control/"+c.nodeId;const ids=JSON.parse(process.argv[1]);const names=[r+"/initial-baseline",r+"/baseline-facts.json",...ids.flatMap(id=>[r+"/plans/"+id+".json",... ["pjsip.conf","extensions.conf","provenance.json"].map(n=>r+"/staging/"+id+"/"+n)])];const b=JSON.parse(fs.readFileSync(r+"/boundary.json"));process.stdout.write(JSON.stringify({files:names.map(p=>[p,crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")]),sequence:b.sequence,receipts:b.receipts}))';
  try {
    stage = 'database_create';
    coordinate('create');
    databaseCreated = true;
    stage = 'database_restore';
    docker(
      [
        'exec',
        '-i',
        'myims-rebuild-dev-postgres-1',
        'pg_restore',
        '-U',
        'myims',
        '-d',
        database,
        '--clean',
        '--if-exists',
        '--no-owner',
        '--exit-on-error',
      ],
      { input: dump, timeout: 60000 },
    );
    stage = 'database_initialize';
    coordinate('initialize');
    for (const volume of owned.values())
      docker([
        'volume',
        'create',
        '--label',
        'myims.profile-fixture=' + token,
        volume,
      ]);
    stage = 'container_create';
    create(originalImage, true);
    docker([
      'run',
      '-d',
      '--name',
      helper,
      '--network',
      'none',
      '--volumes-from',
      name,
      '--entrypoint',
      '/bin/sleep',
      originalImage,
      'infinity',
    ]);
    helperCreated = true;
    stage = 'custody_copy';
    docker([
      'exec',
      helper,
      '/bin/sh',
      '-c',
      'find /etc/asterisk -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +',
    ]);
    stage = 'custody_extract';
    docker(['exec', '-i', helper, 'tar', '-C', '/', '-xpf', '-'], {
      input: archive,
    });
    stage = 'native_configuration';
    docker([
      'exec',
      helper,
      'node',
      '-e',
      'const fs=require("node:fs"),p="/run/pbx-live-native/configuration.json";const c=JSON.parse(fs.readFileSync(p));const u=new URL(c.databaseUrl);u.pathname="/"+process.argv[1];c.databaseUrl=u.href;fs.writeFileSync(p,JSON.stringify(c),{mode:0o600});',
      database,
    ]);
    stage = 'legacy_script';
    docker(
      [
        'exec',
        '-i',
        helper,
        'node',
        '-e',
        'const fs=require("node:fs");fs.writeFileSync("/var/lib/myims-pbx/fixture-legacy-supervisor.sh",fs.readFileSync(0),{mode:0o700});',
      ],
      { input: legacySupervisor },
    );
    docker(['rm', '-fv', helper]);
    helperCreated = false;
    stage = 'initial_start';
    docker(['start', name]);
    startOwner();
    stage = 'owner';
    await waitOwner();
    const before = native(historyCode, [
      JSON.stringify([expected.initialBaselineId, expected.artifactId]),
    ]);
    if (point === 'console_recovery') {
      stage = 'static_custody_attacks';
      const proof = JSON.parse(
        text(['exec', name, 'node', '/fixture-static.mjs']).trim(),
      );
      if (!proof.passed) throw new Error('Static custody checks failed');
    }
    const id = randomUUID(),
      identity = {
        operationId: id,
        nodeId: expected.nodeId,
        installationId: expected.installationId,
      };
    if (
      (point !== 'normal' && !safetyCases.includes(point)) ||
      ['bootstrap_boot_loss', 'partial_boot_loss'].includes(point)
    )
      native(
        'const fs=require("node:fs");const c=JSON.parse(fs.readFileSync("/run/pbx-live-native/configuration.json"));fs.writeFileSync("/var/lib/myims-pbx/control/"+c.nodeId+"/fixture-fault.json",process.argv[1],{mode:0o600});',
        [
          JSON.stringify({
            operationId: id,
            point:
              point === 'sql_failure'
                ? 'sql_ack_before'
                : point === 'bootstrap_boot_loss'
                  ? 'static_before'
                  : point === 'partial_boot_loss'
                    ? 'static_after'
                    : point,
            kind: ['bootstrap_boot_loss', 'partial_boot_loss'].includes(point)
              ? 'container_exit'
              : point === 'sql_failure'
                ? 'sql_failure'
                : 'exit',
          }),
        ],
      );
    stage = 'accept';
    const accepted = request(
      'upgrade',
      id,
      id,
      expected.proposedUnmanagedDigest,
    );
    if (point === 'active_call') {
      // Test-only CLI origination, loaded transiently in the disposable PBX.
      // Static bytes/digests stay exact and the single Local call drains naturally.
      text([
        'exec',
        name,
        'asterisk',
        '-rx',
        'module load res_clioriginate.so',
      ]);
      text([
        'exec',
        name,
        'asterisk',
        '-rx',
        'dialplan add extension 777,1,Wait,8 into myims-profile-hold',
      ]);
      text([
        'exec',
        name,
        'asterisk',
        '-rx',
        'channel originate Local/777@myims-profile-hold/n application Wait 8',
      ]);
      naturalActivityDeadline = Date.now() + 10000;
      const live = text([
        'exec',
        name,
        'asterisk',
        '-rx',
        'core show channels count',
      ]);
      if (!/[1-9][0-9]* active channels/.test(live))
        throw new Error('Bounded isolated call unavailable');
    }
    if (point === 'unknown_activity')
      native(
        'const fs=require("node:fs");const p=Number(fs.readFileSync("/var/run/asterisk/asterisk.pid","utf8"));const uid=fs.readFileSync("/etc/passwd","utf8").split("\\n").find(l=>l.startsWith("asterisk:")).split(":")[2];const s=fs.readFileSync("/proc/"+p+"/status","utf8").split("\\n");const ids=s.find(l=>l.startsWith("Uid:")).trim().split(/\\s+/).slice(1);if(s.find(l=>l.startsWith("Name:")).trim().split(/\\s+/)[1]!=="asterisk"||ids.length!==4||ids.some(id=>id!==uid))throw Error();process.kill(p,"SIGSTOP")',
      );
    if (point === 'missing_custody')
      native(
        'const fs=require("node:fs");const c=JSON.parse(fs.readFileSync("/run/pbx-live-native/configuration.json"));const p="/var/lib/myims-pbx/control/"+c.nodeId+"/baseline-facts.json";fs.renameSync(p,p+".fixture-held")',
      );
    operation('accept', accepted);
    if (
      ['active_call', 'unknown_activity', 'missing_custody'].includes(point)
    ) {
      await delay(point === 'unknown_activity' ? 4500 : 1200);
      if (
        selections().length ||
        operation('status', identity).state === 'prepared'
      )
        throw new Error('Unsafe profile effect occurred');
      if (point === 'unknown_activity')
        native(
          'const fs=require("node:fs");const p=Number(fs.readFileSync("/var/run/asterisk/asterisk.pid","utf8"));process.kill(p,"SIGCONT")',
        );
      if (point === 'missing_custody')
        native(
          'const fs=require("node:fs");const c=JSON.parse(fs.readFileSync("/run/pbx-live-native/configuration.json"));const p="/var/lib/myims-pbx/control/"+c.nodeId+"/baseline-facts.json";if(fs.existsSync(p))throw Error("Recaptured baseline");fs.renameSync(p+".fixture-held",p)',
        );
    }
    stage = 'preparation';
    if (['bootstrap_boot_loss', 'partial_boot_loss'].includes(point)) {
      stage = 'cold_start_recovery';
      const deadline = Date.now() + 30000;
      let reached = false;
      while (Date.now() < deadline) {
        const marker = spawnSync(
          'docker',
          [
            'exec',
            name,
            'test',
            '-f',
            '/var/lib/myims-pbx/control/' +
              expected.nodeId +
              '/fixture-fault-consumed.json',
          ],
          { timeout: 3000 },
        );
        if (marker.status === 0) {
          reached = true;
          break;
        }
        await delay(250);
      }
      if (!reached) throw new Error('Cold-start durable boundary not reached');
      docker(['kill', '--signal', 'KILL', name]);
      if (
        text(['inspect', '--format', '{{.State.Running}}', name]).trim() !==
        'false'
      )
        throw new Error('Actual container loss did not execute');
      docker(['rm', '-v', name]);
      created = false;
      create('myims-rebuild-dev-asterisk-live');
      docker(['start', name]);
      bootRecoveryStarts++;
      await waitOwner();
    }
    let current = await result(identity, {
      allowUnknown: !['unknown_activity', 'missing_custody'].includes(point),
    });
    if (point === 'bootstrap_boot_loss') {
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline && current.state === 'unknown') {
        await delay(250);
        current = operation('status', identity);
      }
      if (
        current.state !== 'rolled_back' ||
        selections().some((effect) => effect.id === id)
      )
        throw new Error('Legacy cold-start recovery replayed selection');
    }
    let selectedId = id,
      restarts = 0;
    if (point === 'version_race') {
      if (current.state !== 'prepared')
        throw new Error('Expected prepared version boundary');
      const before = state().profile_dispatches;
      coordinate('bump-version');
      let rejected = false;
      try {
        operation('dispatch', identity);
      } catch {
        rejected = true;
      }
      if (!rejected || state().profile_dispatches !== before)
        throw new Error('Stale-version restart was dispatched');
      await waitOwner();
      const deadline = Date.now() + 30000;
      while (
        Date.now() < deadline &&
        operation('status', identity).state !== 'unknown'
      )
        await delay(250);
      current = operation('status', identity);
      if (current.state !== 'unknown')
        throw new Error('Version drift did not retain uncertainty');
    }
    if (point === 'owner_loss' || point === 'competing_intents') {
      if (current.state !== 'prepared')
        throw new Error('Expected prepared boundary');
      if (point === 'competing_intents') consoleAction('races');
      else {
        const oldEpoch = state().canonical_epoch;
        const oldToken = JSON.parse(
          native(
            'const fs=require("node:fs");const c=JSON.parse(fs.readFileSync("/run/pbx-live-native/configuration.json"));const b=JSON.parse(fs.readFileSync("/var/lib/myims-pbx/control/"+c.nodeId+"/boundary.json"));process.stdout.write(JSON.stringify({nodeId:c.nodeId,epoch:b.epoch,incarnation:b.incarnation,desiredVersion:Number(process.argv[1])}))',
            [String(expected.nodeVersion)],
          ),
        );
        const effects = JSON.stringify(selections());
        docker(['kill', '--signal', 'KILL', name + '-owner']);
        docker(['rm', '-v', name + '-owner']);
        ownerCreated = false;
        await delay(16000);
        startOwner();
        await waitOwner();
        if (
          state().canonical_epoch === oldEpoch ||
          JSON.stringify(selections()) !== effects
        )
          throw new Error('Owner loss replayed selection or did not fence');
        const stale = JSON.parse(
          native(
            'const {NativeOwnerClient}=require("/workspace/services/backend/dist/modules/telephony/adapters/live/native-transport.js");(async()=>{let rejected=false;try{await new NativeOwnerClient("/run/pbx-live/native.sock").inspect(JSON.parse(process.argv[1]),process.argv[2]);}catch{rejected=true;}if(!rejected)process.exit(1);console.log(JSON.stringify({staleOwnerRejected:true}));})().catch(()=>process.exit(1));',
            [JSON.stringify(oldToken), id],
          ),
        );
        if (!stale.staleOwnerRejected)
          throw new Error('Stale private owner accepted');
      }
    }
    if (current.state === 'unknown') {
      stage = 'explicit_rollback';
      const recovery = randomUUID();
      const rollback = request(
        'rollback',
        recovery,
        expected.artifactId,
        expected.unmanagedDigest,
        id,
      );
      operation('accept', rollback);
      const recoveryIdentity = { ...identity, operationId: recovery };
      current = await result(recoveryIdentity);
      if (current.state === 'prepared') {
        await restart(
          recoveryIdentity,
          expected.artifactId,
          expected.unmanagedDigest,
        );
        restarts++;
        current = await result(recoveryIdentity);
      }
      if (current.state !== 'rolled_back')
        throw new Error('Exact rollback unavailable');
      selectedId = expected.artifactId;
      if (operation('status', identity).state !== 'rolled_back')
        throw new Error('Predecessor unresolved');
    } else if (current.state === 'prepared') {
      stage = 'restart';
      await restart(identity, id, expected.proposedUnmanagedDigest);
      restarts++;
      stage = 'acknowledgement';
      current = await result(identity);
      if (current.state !== 'verified')
        throw new Error('Target pair not verified');
    } else if (current.state === 'rolled_back') {
      selectedId = expected.artifactId;
    } else throw new Error('Unexpected transition state');
    if (point === 'normal') {
      // Prove the untouched original baseline and return to the new verified target.
      for (const [target, digest] of [
        [expected.initialBaselineId, expected.unmanagedDigest],
        [id, expected.proposedUnmanagedDigest],
      ]) {
        const recovery = randomUUID(),
          rollback = request('rollback', recovery, target, digest);
        operation('accept', rollback);
        const recoveryIdentity = { ...identity, operationId: recovery };
        let restored = await result(recoveryIdentity);
        if (restored.state === 'prepared') {
          await restart(recoveryIdentity, target, digest);
          restarts++;
          restored = await result(recoveryIdentity);
        }
        if (restored.state !== 'rolled_back' || state().verified_id !== target)
          throw new Error('Required historical pair unavailable');
      }
    }
    if (point === 'partial_boot_loss') {
      stage = 'missing_established_selector';
      native(
        'const fs=require("node:fs");const c=JSON.parse(fs.readFileSync("/run/pbx-live-native/configuration.json"));const p="/var/lib/myims-pbx/control/"+c.nodeId+"/static-selection.json";fs.renameSync(p,p+".fixture-held")',
      );
      const unavailable = spawnSync(
        'docker',
        ['exec', name, 'node', '/usr/local/lib/myims/pbx-profile-launch.mjs'],
        { encoding: 'utf8', timeout: 30000, maxBuffer: 8192 },
      );
      const blocked =
        unavailable.status !== 0 && state().runtime_state === 'unknown';
      native(
        'const fs=require("node:fs");const c=JSON.parse(fs.readFileSync("/run/pbx-live-native/configuration.json"));const p="/var/lib/myims-pbx/control/"+c.nodeId+"/static-selection.json";fs.renameSync(p+".fixture-held",p)',
      );
      if (!blocked)
        throw new Error('Missing established selector did not fail closed');
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline && state().runtime_state !== 'verified')
        await delay(250);
    }
    stage = 'preservation';
    if (
      native(historyCode, [
        JSON.stringify([expected.initialBaselineId, expected.artifactId]),
      ]) !== before
    )
      throw new Error('Historical bytes/sequence changed');
    if (point === 'console_recovery') {
      stage = 'console_recovery';
      for (const target of [expected.initialBaselineId, id]) {
        const request = consoleAction('recover', target).results[0];
        if (request.status !== 202)
          throw new Error('Console recovery rejected');
        const deadline = Date.now() + 60000;
        while (
          Date.now() < deadline &&
          (state().verified_id !== target || state().active_operation_id)
        )
          await delay(500);
        if (
          state().verified_id !== target ||
          state().active_operation_id ||
          state().runtime_state !== 'verified'
        )
          throw new Error('Console profile recovery unresolved');
      }
    }
    const final = state();
    if (
      final.runtime_state !== 'verified' ||
      final.active_profile_operation_id ||
      final.active_operation_id ||
      final.active_retirement_id
    )
      throw new Error('Unresolved final state');
    if (
      ((point !== 'normal' && !safetyCases.includes(point)) ||
        ['bootstrap_boot_loss', 'partial_boot_loss'].includes(point)) &&
      native(
        'const fs=require("node:fs");const c=JSON.parse(fs.readFileSync("/run/pbx-live-native/configuration.json"));process.stdout.write(String(fs.existsSync("/var/lib/myims-pbx/control/"+c.nodeId+"/fixture-fault-consumed.json")))',
      ) !== 'true'
    )
      throw new Error('Fault did not execute');
    const effects = selections();
    for (const kind of ['static', 'managed'])
      if (
        effects.filter((e) => e.id === id && e.kind === kind).length >
        (['normal', 'console_recovery'].includes(point) ? 2 : 1)
      )
        throw new Error('Uncertain transition blindly replayed selection');
    const report = {
      case: point,
      passed: true,
      actualProcessLoss: ![
        'normal',
        'sql_failure',
        ...safetyCases.filter(
          (c) =>
            ![
              'owner_loss',
              'restart_before',
              'restart_after',
              'bootstrap_boot_loss',
              'partial_boot_loss',
            ].includes(c),
        ),
      ].includes(point),
      injectedSqlFault: point === 'sql_failure',
      requiredRestarts: restarts,
      selectedId,
      finalArtifactId: final.verified_id,
      immutableHistoryPreserved: true,
      selectionReplayRejected: true,
      safetyScenario: safetyCases.includes(point) ? point : null,
      restartProcessLossInjected: restartLossInjected,
      effectTimeVersionRaceFenced: point === 'version_race',
      bootRecoveryStarts,
      missingEstablishedSelectorBlocked: point === 'partial_boot_loss',
    };
    reports.push(report);
    console.log(JSON.stringify(report));
  } catch {
    if (created) {
      try {
        const lines = text(['logs', name])
          .split('\n')
          .flatMap((line) => {
            try {
              const event = JSON.parse(line);
              return event.entrypoint === 'telephony-native'
                ? [{ state: event.state, failureCode: event.failureCode }]
                : [];
            } catch {
              return [];
            }
          });
        console.error(
          JSON.stringify({
            nativeEvents: lines.slice(-5),
            copiedRuntime: state(),
          }),
        );
        console.error(
          native(
            'const fs=require("node:fs");const p="/tmp/profile-owner.log";const lines=fs.existsSync(p)?fs.readFileSync(p,"utf8").split("\\n"):[];const events=lines.flatMap(line=>{try{const e=JSON.parse(line);return [{operation:e.operation,outcome:e.outcome,errorCode:e.errorCode}]}catch{return []}});process.stdout.write(JSON.stringify({ownerEvents:events.slice(-5)}))',
          ),
        );
      } catch {
        /* Diagnostics never replace exact fixture cleanup. */
      }
    }
    console.error(JSON.stringify({ case: point, stage, passed: false }));
    throw new Error(
      'Isolated profile rehearsal failed; retained target unchanged',
    );
  } finally {
    // Even a failed test assertion lets its bounded Local call finish naturally.
    if (Date.now() < naturalActivityDeadline)
      await delay(naturalActivityDeadline - Date.now());
    if (ownerCreated) docker(['rm', '-fv', name + '-owner']);
    if (helperCreated) docker(['rm', '-fv', helper]);
    if (created) docker(['rm', '-fv', name]);
    for (const volume of owned.values()) {
      try {
        docker(['volume', 'rm', volume]);
      } catch {
        /* Uncreated volumes have no custody. */
      }
    }
    if (databaseCreated) coordinate('cleanup');
    const remaining = text([
      'volume',
      'ls',
      '-q',
      '--filter',
      'label=myims.profile-fixture=' + token,
    ]).trim();
    cleanupComplete =
      !remaining &&
      !text([
        'ps',
        '-aq',
        '--filter',
        'label=myims.profile-fixture=' + token,
      ]).trim();
  }
  if (!cleanupComplete) throw new Error('Owned fixture cleanup incomplete');
}
console.log(
  JSON.stringify({
    check: 'profile-transition-rehearsal',
    passed: true,
    smoke,
    safety,
    selectedCase: single,
    cases: reports.length,
    retainedEffects: false,
    ownedCleanup: true,
  }),
);
