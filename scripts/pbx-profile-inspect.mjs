// Trusted deployment inspection only. Never acquire ownership, write, or call.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const digest = /^[a-f0-9]{64}$/;
export const requiredModules = [
  'res_pjsip_pubsub',
  'res_pjsip_outbound_authenticator_digest',
  'app_dial',
  'bridge_simple',
  'func_strings',
  'res_speech',
  'res_agi',
  'func_channel',
  'res_pjsip_header_funcs',
  'res_pjsip_endpoint_identifier_ip',
];
export function expectations(value) {
  const keys = [
    'nodeId',
    'installationId',
    'initialBaselineId',
    'artifactId',
    'compilerVersion',
    'policyVersion',
    'unmanagedDigest',
    'nodeVersion',
    'proposedUnmanagedDigest',
  ];
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join() !== [...keys].sort().join() ||
    keys
      .slice(0, 4)
      .some(
        (key) => typeof value[key] !== 'string' || !uuid.test(value[key]),
      ) ||
    typeof value.unmanagedDigest !== 'string' ||
    !digest.test(value.unmanagedDigest) ||
    typeof value.proposedUnmanagedDigest !== 'string' ||
    !digest.test(value.proposedUnmanagedDigest) ||
    !Number.isSafeInteger(value.nodeVersion) ||
    value.nodeVersion < 1 ||
    [value.compilerVersion, value.policyVersion].some(
      (v) => typeof v !== 'string' || !/^[a-z0-9-]{1,64}$/.test(v),
    )
  )
    throw new Error('Invalid exact profile expectations');
  return value;
}
export function channels(output) {
  const matches = [...output.matchAll(/^(\d+) active channels\s*$/gm)];
  if (matches.length !== 1) return null;
  const count = Number(matches[0][1]);
  return Number.isSafeInteger(count) ? count : null;
}
export function profileSummary(files) {
  const lines = (name) =>
    files[name]
      .toString('utf8')
      .split(/\r?\n/)
      .map((line) => line.replace(/;.*$/, '').trim())
      .filter(Boolean);
  const modules = lines('modules.conf');
  const values = (name, key) =>
    lines(name).flatMap((line) => {
      const pair = /^([a-z_]+)\s*=\s*(.*?)\s*$/i.exec(line);
      return pair?.[1].toLowerCase() === key ? [pair[2]] : [];
    });
  const safeModules = (directive) =>
    modules
      .flatMap((line) => {
        const match = /^(load|noload)\s*=\s*([a-z0-9_]+)\.so$/.exec(line);
        return match?.[1] === directive ? [match[2]] : [];
      })
      .sort();
  const finite = (name, key, allowed) =>
    values(name, key).map((v) => (allowed.includes(v) ? v : 'other'));
  const number = (key) =>
    values('rtp.conf', key).map((v) =>
      /^\d{1,5}$/.test(v) && Number(v) <= 65535 ? Number(v) : null,
    );
  return {
    autoload: finite('modules.conf', 'autoload', ['yes', 'no']),
    explicitLoads: safeModules('load'),
    explicitExclusions: safeModules('noload'),
    rtpStart: number('rtpstart'),
    rtpEnd: number('rtpend'),
    strictRtp: finite('rtp.conf', 'strictrtp', ['yes', 'no']),
    transports: finite('pjsip.conf', 'protocol', [
      'udp',
      'tcp',
      'ws',
      'wss',
      'tls',
    ]),
    directMedia: finite('pjsip.conf', 'direct_media', ['yes', 'no']),
    symmetricRtp: finite('pjsip.conf', 'rtp_symmetric', ['yes', 'no']),
    forceRport: finite('pjsip.conf', 'force_rport', ['yes', 'no']),
    rewriteContact: finite('pjsip.conf', 'rewrite_contact', ['yes', 'no']),
    externalAddressConfigured: [
      'external_media_address',
      'external_signaling_address',
    ].map((key) => values('pjsip.conf', key).length > 0),
    // No addresses, accounts, destinations, or secret-bearing source lines.
  };
}
export async function inspectProfile(expected, target) {
  const load = createRequire('/workspace/services/backend/package.json');
  const base = './dist/modules/telephony/adapters/live/';
  const { liveConfiguration, protectedLiveBytes } = load(
    base + 'configuration.js',
  );
  const { ProtectedArtifactStore } = load(base + 'artifact-store.js');
  const { NativePbxDriver, moduleIsRunning } = load(base + 'native-driver.js');
  const { RetainedLivePlans } = load(base + 'retained-plans.js');
  const { Client } = load('pg');
  const { runtimePins } = load(
    './dist/modules/telephony/domain/runtime-pins.js',
  );
  const { canonical } = load(
    './dist/modules/telephony/domain/revision-snapshot.js',
  );
  const { staticDigest, ProtectedStaticProfiles } = load(
    base + 'static-profiles.js',
  );
  const config = liveConfiguration(
    '/run/pbx-live-native/configuration.json',
    false,
  );
  const report = {
    mode: expected ? 'preflight' : 'status',
    observedAt: new Date().toISOString(),
    effectAuthorization: false,
    blockers: [],
    nodeId: config.nodeId,
    installationId: config.installationId,
  };
  const block = (code) => {
    if (!report.blockers.includes(code)) report.blockers.push(code);
  };
  if (
    config.nodeId !== target.nodeId ||
    config.installationId !== target.installationId
  ) {
    block('wrong_target');
    return report;
  }
  const root = '/var/lib/myims-pbx/control/' + config.nodeId;
  const cli = (command) =>
    execFileSync('/usr/sbin/asterisk', ['-rx', command], {
      encoding: 'utf8',
      timeout: 3000,
      killSignal: 'SIGKILL',
      maxBuffer: 1048576,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  const client = new Client({
    connectionString: config.database,
    connectionTimeoutMillis: 2000,
    statement_timeout: 3000,
    idle_in_transaction_session_timeout: 30000,
  });
  client.on('error', () => {});
  try {
    await client.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const query = async (sql) =>
      (await client.query(sql, [config.nodeId])).rows;
    const schema = (
      await client.query(
        "SELECT to_regclass('public.pbx_profile_operations') IS NOT NULL AS available",
      )
    ).rows[0].available;
    report.profileSchemaAvailable = schema;
    if (!schema) block('profile_schema_unavailable');
    const [row] =
      await query(`SELECT n.id,n.installation_id,n.version,n.host,n.port,n.transport,
      r.installed_id,r.verified_id,r.known_good_id,r.runtime_state,r.active_operation_id,r.active_retirement_id,
      ${schema ? 'r.active_profile_operation_id' : 'NULL::uuid AS active_profile_operation_id'},r.executor_seen_at,
      r.boundary_epoch,r.routing_generation,o.epoch,o.incarnation,o.expires_at>clock_timestamp() AS owner_current,
      r.executor_seen_at>clock_timestamp()-interval '15 seconds' AS executor_fresh
      FROM public.pbx_nodes n JOIN public.pbx_live_runtime r ON r.node_id=n.id
      JOIN public.pbx_ownership o ON o.node_id=n.id WHERE n.id=$1`);
    if (
      !row ||
      row.installation_id !== config.installationId ||
      row.host !== 'asterisk' ||
      row.port !== 5039 ||
      row.transport !== 'ami-tls'
    ) {
      block('wrong_canonical_target');
      return report;
    }
    const initial = protectedLiveBytes(root + '/initial-baseline', 64).toString(
      'utf8',
    );
    if (!uuid.test(initial)) throw new Error();
    const journal = JSON.parse(
      protectedLiveBytes(root + '/boundary.json', 1048576),
    );
    report.nodeVersion = row.version;
    report.runtime = {
      state: row.runtime_state,
      artifactId: row.verified_id,
      knownGoodId: row.known_good_id,
      initialBaselineId: initial,
      nativeEpoch: journal.epoch,
      canonicalEpoch: row.epoch,
      runtimeEpoch: row.boundary_epoch,
      routingGeneration: row.routing_generation,
      ownerCurrent: row.owner_current,
      executorFresh: row.executor_fresh,
      pendingOperation: !!row.active_operation_id || !!journal.pending,
      pendingRetirement: !!row.active_retirement_id,
      pendingProfileTransition: !!row.active_profile_operation_id,
    };
    if (
      row.runtime_state !== 'verified' ||
      !row.verified_id ||
      row.installed_id !== row.verified_id ||
      row.known_good_id !== row.verified_id
    )
      block('runtime_unverified');
    if (
      journal.version !== 1 ||
      journal.nodeId !== config.nodeId ||
      journal.installationId !== config.installationId ||
      journal.verifiedId !== row.verified_id ||
      journal.epoch !== row.epoch ||
      journal.incarnation !== row.incarnation ||
      row.boundary_epoch !== row.epoch
    )
      block('native_owner_mismatch');
    if (!row.owner_current || !row.executor_fresh) block('owner_unavailable');
    if (
      report.runtime.pendingOperation ||
      report.runtime.pendingRetirement ||
      report.runtime.pendingProfileTransition
    )
      block('pending_work');
    try {
      const executor = JSON.parse(
        protectedLiveBytes(root + '/profile-executor.json', 2048),
      );
      if (
        executor.version !== 1 ||
        executor.nodeId !== config.nodeId ||
        executor.installationId !== config.installationId ||
        !Number.isSafeInteger(executor.pid) ||
        executor.pid < 1
      )
        throw new Error();
      const stat = readFileSync('/proc/' + executor.pid + '/stat', 'utf8');
      if (
        stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19] !==
          executor.startTicks ||
        new Date(row.executor_seen_at).getTime() <
          new Date(executor.startedAt).getTime()
      )
        throw new Error();
      report.nativeProfileExecutorAvailable = true;
    } catch {
      report.nativeProfileExecutorAvailable = false;
      block('native_profile_executor_unavailable');
    }
    const pending = await query(
      `SELECT p.state FROM public.pbx_live_progress p WHERE p.node_id=$1 AND p.state NOT IN ('verified','recovered','validation_failed','revoked') LIMIT 2049`,
    );
    const tests = await query(
      `SELECT state FROM public.tenant_route_test_progress WHERE node_id=$1 AND state IN ('queued','dispatching','admitted','unknown') LIMIT 2049`,
    );
    if (pending.length || tests.length) block('unresolved_work');
    report.work = {
      unresolvedRevisions: pending.length,
      unresolvedTests: tests.length,
    };
    const artifacts =
      await query(`SELECT a.id,a.revision_id,a.initial_baseline,a.operation_id,
      r.compiler_version,r.policy_version,r.source_digest FROM public.pbx_live_artifacts a
      LEFT JOIN public.pbx_revisions r ON r.id=a.revision_id
      LEFT JOIN public.pbx_artifact_retirements t ON t.artifact_id=a.id
      WHERE a.node_id=$1 AND t.artifact_id IS NULL ORDER BY a.verified_at,a.id LIMIT 2049`);
    const pins =
      await query(`SELECT revision_id,kind,resource_id,version,material_kind,material_version
      FROM public.pbx_live_pins WHERE node_id=$1 AND released_at IS NULL ORDER BY revision_id,kind,resource_id,version LIMIT 2049`);
    const operations =
      await query(`SELECT id,predecessor_id,sequence,expected_baseline_id,target_id,installation_id
      FROM public.pbx_live_operations WHERE node_id=$1 ORDER BY sequence LIMIT 2049`);
    if (
      [artifacts, pins, operations, pending, tests].some((v) => v.length > 2048)
    ) {
      block('inventory_limit');
      return report;
    }
    if (
      !artifacts.some((a) => a.id === initial && a.initial_baseline) ||
      !artifacts.some((a) => a.id === row.verified_id)
    )
      block('recovery_artifact_missing');
    const store = new ProtectedArtifactStore(
      root + '/staging',
      config.installationId,
      config.nodeId,
    );
    const plans = new RetainedLivePlans(
      root,
      config.nodeId,
      config.installationId,
      true,
    );
    const driver = new NativePbxDriver(
      root,
      '/var/lib/myims-pbx/managed',
      store,
      null,
      true,
    );
    const gid = Number(
      readFileSync('/etc/group', 'utf8')
        .split('\n')
        .find((l) => l.startsWith('asterisk:'))
        ?.split(':')[2],
    );
    const profiles = new ProtectedStaticProfiles(root, gid);
    report.unmanagedDigest = driver.unmanaged();
    report.artifacts = [];
    for (const artifact of artifacts) {
      try {
        const plan = plans.load(artifact.id);
        store.load(plan.identity);
        if (
          !artifact.initial_baseline &&
          (plan.identity.compilerVersion !== artifact.compiler_version ||
            plan.identity.policyVersion !== artifact.policy_version ||
            plan.identity.sourceDigest !== artifact.source_digest)
        )
          throw new Error();
        if (!artifact.initial_baseline) {
          if (
            createHash('sha256')
              .update(canonical(plan.snapshot))
              .digest('hex') !== artifact.source_digest
          )
            throw new Error();
          for (const entry of runtimePins(plan.snapshot)) {
            const pin = pins.find(
              (p) =>
                p.revision_id === artifact.revision_id &&
                p.kind === entry.kind &&
                p.resource_id === entry.value.id &&
                p.version === entry.value.version,
            );
            if (!pin) block('recovery_pin_missing');
            else if (entry.kind === 'credentials') {
              const endpoint = entry.value.purpose === 'endpoint';
              if (
                pin.material_kind !== (endpoint ? 'endpoint' : 'trunk') ||
                pin.material_version !== (endpoint ? 1 : entry.value.version)
              )
                block('recovery_pin_mismatch');
            }
          }
        }
        const ancestry = new Set();
        let operation = artifact.operation_id;
        let sequence = Infinity;
        while (operation) {
          const parent = operations.find((o) => o.id === operation);
          if (
            !parent ||
            parent.installation_id !== config.installationId ||
            parent.sequence >= sequence ||
            ancestry.has(operation) ||
            ancestry.size >= 128
          )
            throw new Error();
          ancestry.add(operation);
          sequence = parent.sequence;
          operation = parent.predecessor_id;
        }
        const entry = {
          artifactId: artifact.id,
          initialBaseline: artifact.initial_baseline,
          compilerVersion: plan.identity.compilerVersion,
          policyVersion: plan.identity.policyVersion,
          unmanagedDigest: plan.unmanaged,
          protectedBytesAvailable: true,
          currentProfileCompatible: plan.unmanaged === report.unmanagedDigest,
          ancestryDepth: ancestry.size,
        };
        report.artifacts.push(entry);
        if (!entry.currentProfileCompatible) {
          try {
            profiles.load(plan.unmanaged);
            profiles.verifyProjection(plan.unmanaged);
            entry.recoveryStaticCustodyAvailable = true;
          } catch {
            block('historical_profile_unavailable');
          }
        }
        if (artifact.id === row.verified_id) {
          try {
            await driver.verify(plan.identity, plan.snapshot, plan.unmanaged);
            report.exactProtectedAndLoadedRuntimeMatch = true;
          } catch {
            block('loaded_runtime_mismatch');
          }
        }
      } catch {
        block('recovery_custody_unavailable');
      }
    }
    // Baseline proof stays immutable. This inspection never recaptures it.
    const baseline = JSON.parse(
      protectedLiveBytes(root + '/baseline-facts.json', 4096),
    );
    if (
      !digest.test(baseline.unmanaged) ||
      baseline.unmanaged !== plans.load(initial).unmanaged
    )
      block('baseline_provenance_mismatch');
    report.pins = {
      retained: pins.length,
      materialReferences: pins
        .filter((p) => p.kind === 'credentials')
        .map((p) => ({
          artifactId: p.revision_id,
          kind: p.material_kind,
          credentialId: p.resource_id,
          version: p.material_version,
        })),
    };
    report.activeChannels = channels(cli('core show channels count'));
    if (report.activeChannels === null) block('activity_unknown');
    else if (report.activeChannels !== 0) block('activity_busy');
    const version = cli('core show version');
    report.expectedAsteriskVersion = /\bAsterisk 22\.10\.1\b/.test(version);
    if (!report.expectedAsteriskVersion) block('runtime_version_mismatch');
    report.capabilities = requiredModules.map((name) => ({
      name,
      loaded: moduleIsRunning(cli('module show like ' + name + '.so'), name),
    }));
    report.profileUpgradeRequired = report.capabilities.some((m) => !m.loaded);
    const files = Object.fromEntries(
      ['modules.conf', 'rtp.conf', 'pjsip.conf'].map((name) => {
        const path = join(driver.staticDirectory(), name),
          stat = lstatSync(path);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1048576)
          throw new Error();
        return [name, readFileSync(path)];
      }),
    );
    report.currentProfile = profileSummary(files);
    if (
      report.currentProfile.autoload.length !== 1 ||
      report.currentProfile.autoload[0] !== 'no' ||
      report.currentProfile.explicitLoads.length > 128
    )
      block('current_module_policy_unsupported');
    for (const name of report.currentProfile.explicitLoads) {
      if (
        !/^[a-z0-9_]{1,64}$/.test(name) ||
        !moduleIsRunning(cli('module show like ' + name + '.so'), name)
      )
        block('current_capability_mismatch');
    }
    try {
      profiles.load(report.unmanagedDigest);
      profiles.verifyProjection(report.unmanagedDigest);
      report.staticProfileCustody = 'versioned_exact';
    } catch {
      report.staticProfileCustody =
        'protected_current_bytes_require_staging_before_selection';
    }
    const conf = new Map(
      readdirSync(driver.staticDirectory())
        .filter((n) => n.endsWith('.conf'))
        .map((n) => [n, readFileSync(join(driver.staticDirectory(), n))]),
    );
    const missing = requiredModules.filter(
      (name) => !report.currentProfile.explicitLoads.includes(name),
    );
    if (missing.length)
      conf.set(
        'modules.conf',
        Buffer.concat([
          conf.get('modules.conf'),
          Buffer.from(
            '\n' + missing.map((m) => 'load = ' + m + '.so').join('\n') + '\n',
          ),
        ]),
      );
    report.proposedUnmanagedDigest = staticDigest(conf);
    report.profileFileCount = readdirSync('/etc/asterisk').filter((n) =>
      n.endsWith('.conf'),
    ).length;
    if (expected) {
      const actual = report.artifacts.find(
        (a) => a.artifactId === row.verified_id,
      );
      if (
        row.version !== expected.nodeVersion ||
        report.proposedUnmanagedDigest !== expected.proposedUnmanagedDigest ||
        initial !== expected.initialBaselineId ||
        row.verified_id !== expected.artifactId ||
        actual?.compilerVersion !== expected.compilerVersion ||
        actual?.policyVersion !== expected.policyVersion ||
        report.unmanagedDigest !== expected.unmanagedDigest
      )
        block('expected_profile_mismatch');
    }
    // A passive multi-source observation is never an effect-time fence/proof.
    const finalJournal = JSON.parse(
      protectedLiveBytes(root + '/boundary.json', 1048576),
    );
    if (
      JSON.stringify(journal) !== JSON.stringify(finalJournal) ||
      report.unmanagedDigest !== driver.unmanaged()
    )
      block('concurrent_native_change');
    await client.query('COMMIT');
    const after = (
      await client.query(
        `SELECT r.installed_id,r.verified_id,r.known_good_id,r.runtime_state,
      r.active_operation_id,r.active_retirement_id,r.boundary_epoch,r.routing_generation,o.epoch,o.incarnation,
      o.expires_at>clock_timestamp() AS owner_current,r.executor_seen_at>clock_timestamp()-interval '15 seconds' AS executor_fresh
      FROM public.pbx_live_runtime r JOIN public.pbx_ownership o ON o.node_id=r.node_id WHERE r.node_id=$1`,
        [config.nodeId],
      )
    ).rows[0];
    if (!after || Object.keys(after).some((key) => after[key] !== row[key]))
      block('concurrent_canonical_change');
    if (!after?.owner_current || !after?.executor_fresh)
      block('owner_unavailable');
  } catch {
    block('dependency_unavailable');
  } finally {
    await client.end().catch(() => {});
  }
  report.providerCustody = 'native_has_no_provider_access';
  return report;
}
if (process.argv[2] === '--native-profile-inspect') {
  try {
    const input = JSON.parse(process.argv[3]);
    const expected = input.expected ? expectations(input.expected) : null;
    if (
      !uuid.test(input.target?.nodeId) ||
      !uuid.test(input.target?.installationId)
    )
      throw new Error();
    const report = await inspectProfile(expected, input.target);
    console.log(JSON.stringify(report));
    process.exitCode = expected && report.blockers.length ? 2 : 0;
  } catch {
    console.log(
      JSON.stringify({
        effectAuthorization: false,
        blockers: ['inspection_unavailable'],
      }),
    );
    process.exitCode = 2;
  }
}
