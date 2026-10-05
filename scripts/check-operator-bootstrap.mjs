import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  mkdtemp,
  writeFile,
  chmod,
  rm,
  symlink,
  readFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { Client } = backend('pg');
const { loadMigrationConfig } = backend(
  './dist/infrastructure/configuration.js',
);
const { hashPassword, verifyPassword, validatePassword } = backend(
  './dist/infrastructure/password/scrypt.js',
);
const { SnapshotDatabase } = backend(
  './dist/infrastructure/database/read-snapshot.js',
);
const { PlatformAuthorityRepository } = backend(
  './dist/modules/platform/adapters/db/authority-read.js',
);
const { PlatformCredentialRepository } = backend(
  './dist/modules/platform/adapters/db/credential-read.js',
);
const command = 'services/backend/dist/entrypoints/deployment/main.js';
const username = 'bootstrap_identity_sentinel';
const password = '  Bootstrap_PASSWORD_SENTINEL:Éé🛟  ';
const replacement = 'Rerun_PASSWORD_SENTINEL:unchanged';
const sentinels = [
  username,
  username.toUpperCase(),
  password,
  replacement,
  'Bootstrap_PASSWORD_SENTINEL',
  'Rerun_PASSWORD_SENTINEL',
];
export async function checkBootstrap() {
  const { adminUrl, runtimeUrl } = loadMigrationConfig();
  const name = `myims_bootstrap_${randomBytes(6).toString('hex')}`;
  const trusted = new URL(adminUrl);
  const app = new URL(runtimeUrl);
  trusted.pathname = app.pathname = `/${name}`;
  const env = (url = trusted.href) => ({
    ...process.env,
    DATABASE_URL: app.href,
    DATABASE_PASSWORD_FILE: undefined,
    MIGRATION_DATABASE_URL: url,
    MIGRATION_DATABASE_PASSWORD_FILE: undefined,
  });
  const admin = new Client({ connectionString: adminUrl });
  const owner = new Client({ connectionString: trusted.href });
  const runtime = new Client({ connectionString: app.href });
  const directory = await mkdtemp('/tmp/myims-bootstrap-');
  const outputs = [];
  const children = new Set();
  let created = false;
  let phase = 'fixture creation';
  let proxy;
  let snapshot;
  let currentHash;
  const start = (args, settings = {}) => {
    const child = spawn(
      process.execPath,
      ['--import', './scripts/deny-listen.mjs', command, ...args],
      {
        env: env(settings.url),
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    children.add(child);
    let output = '';
    child.stdout.on('data', (data) => {
      output += data;
    });
    child.stderr.on('data', (data) => {
      output += data;
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), 60000);
    const result = once(child, 'exit').then(([code, signal]) => {
      clearTimeout(timer);
      children.delete(child);
      outputs.push(output);
      const messages = output
        .split('\n')
        .filter((line) => line.startsWith('{'))
        .map((line) => JSON.parse(line));
      return { code, signal, messages };
    });
    return { child, result };
  };
  const file = async (user = username, pass = password, bytes) => {
    const path = `${directory}/${randomBytes(5).toString('hex')}.json`;
    await writeFile(
      path,
      bytes ?? JSON.stringify({ username: user, password: pass }),
      { mode: 0o600 },
    );
    return path;
  };
  const invoke = async (path, state, settings) => {
    const result = await start(
      ['bootstrap-operator', '--secret-file', path],
      settings,
    ).result;
    assert.equal(
      result.code,
      ['created', 'already-created'].includes(state) ? 0 : 1,
    );
    assert.equal(result.messages.length, 1);
    assert.equal(result.messages[0].state, state);
    assert.match(result.messages[0].correlationId, /^[a-f0-9-]{36}$/);
    return result.messages[0];
  };
  const counts = async () =>
    (
      await owner.query(`SELECT
    (SELECT count(*)::int FROM public.platform_operators) AS operators,
    (SELECT count(*)::int FROM public.operator_bootstrap_provenance) AS provenance,
    (SELECT count(*)::int FROM public.tenants) AS tenants,
    (SELECT count(*)::int FROM public.staff_users) AS staff`)
    ).rows[0];
  const auditCount = async () =>
    (
      await owner.query(
        "SELECT count(*)::int AS n FROM public.audit_events WHERE event_type='platform.operator.bootstrapped'",
      )
    ).rows[0].n;
  const account = async () =>
    (await owner.query('SELECT * FROM public.platform_operators')).rows[0];
  const clear = async () => {
    await owner.query('DELETE FROM public.operator_bootstrap_provenance');
    await owner.query('DELETE FROM public.platform_operators');
  };
  const waitBlocked = async (number) => {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      // Activity statistics otherwise remain cached inside the held fixture transaction.
      await owner.query('SELECT pg_stat_clear_snapshot()');
      const rows = (
        await owner.query(
          "SELECT pid FROM pg_stat_activity WHERE datname=$1 AND application_name='myims-bootstrap-operator' AND wait_event_type='Lock'",
          [name],
        )
      ).rows;
      if (rows.length >= number) return rows;
      await delay(20);
    }
    throw new Error('Bootstrap lock barrier not reached');
  };
  try {
    await admin.connect();
    await admin.query(
      `CREATE DATABASE "${name}" TEMPLATE template0 ENCODING 'UTF8'`,
    );
    created = true;
    await owner.connect();
    await runtime.connect();
    phase = 'missing schema preflight';
    await invoke(await file(), 'failed');
    assert.equal(
      (
        await owner.query(
          "SELECT to_regclass('public.platform_operators') AS identity",
        )
      ).rows[0].identity,
      null,
    );
    phase = 'fresh deployment isolation';
    assert.equal((await start(['migrate']).result).code, 0);
    assert.equal((await start(['migrate']).result).code, 0);
    assert.deepEqual(await counts(), {
      operators: 0,
      provenance: 0,
      tenants: 0,
      staff: 0,
    });
    assert.equal((await start([]).result).code, 0);
    assert.deepEqual(await counts(), {
      operators: 0,
      provenance: 0,
      tenants: 0,
      staff: 0,
    });
    phase = 'password bounds and protected file input';
    const bytes = Buffer.from(password);
    validatePassword(bytes);
    validatePassword(Buffer.from('a'.repeat(15)));
    validatePassword(Buffer.from('🛟'.repeat(128)));
    for (const invalid of [
      'a'.repeat(14),
      'a'.repeat(129),
      '🛟'.repeat(129),
      'a'.repeat(15) + '\0',
      'a'.repeat(15) + '\n',
      'a'.repeat(15) + '\u2028',
    ])
      assert.throws(() => validatePassword(Buffer.from(invalid)));
    assert.throws(() => validatePassword(Buffer.from([0xc3, 0x28])));
    const firstHash = await hashPassword(bytes);
    const secondHash = await hashPassword(bytes);
    sentinels.push(firstHash, secondHash);
    assert.notEqual(firstHash, secondHash);
    assert.equal(await verifyPassword(bytes, firstHash), true);
    assert.equal(
      await verifyPassword(Buffer.from(password.trim()), firstHash),
      false,
    );
    assert.equal(
      await verifyPassword(Buffer.from(password.toLowerCase()), firstHash),
      false,
    );
    assert.equal(
      await verifyPassword(Buffer.from(password.normalize('NFD')), firstHash),
      false,
    );
    assert.equal(
      await verifyPassword(Buffer.from(replacement), firstHash),
      false,
    );
    for (const invalid of [
      firstHash.replace('N=131072', 'N=1073741824'),
      firstHash + 'x',
      null,
      '$unknown$',
    ])
      assert.equal(await verifyPassword(bytes, invalid), false);
    const pending = hashPassword(bytes);
    await assert.rejects(hashPassword(bytes));
    await pending;
    bytes.fill(0);
    const valid = await file('  BOOTSTRAP_IDENTITY_SENTINEL  ');
    const weak = await file(username, 'short');
    await invoke(weak, 'invalid-input');
    const publicFile = await file();
    await chmod(publicFile, 0o644);
    await invoke(publicFile, 'invalid-input');
    const linked = `${directory}/link`;
    await symlink(valid, linked);
    await invoke(linked, 'invalid-input');
    await invoke(
      await file(username, password, Buffer.alloc(4097, 0x61)),
      'invalid-input',
    );
    await invoke(
      await file(username, password, Buffer.from([0xc3, 0x28])),
      'invalid-input',
    );
    await invoke(
      await file(
        username,
        password,
        '{"username":"bootstrap_identity_sentinel","password":"123456789012345\\ud800"}',
      ),
      'invalid-input',
    );
    await invoke(
      await file(
        username,
        password,
        JSON.stringify({ username, password, extra: true }),
      ),
      'invalid-input',
    );
    const noTTY = await start(['bootstrap-operator']).result;
    assert.equal(noTTY.messages[0].state, 'invalid-input');
    assert.equal(noTTY.code, 1);
    assert.deepEqual(await counts(), {
      operators: 0,
      provenance: 0,
      tenants: 0,
      staff: 0,
    });
    phase = 'first creation, canonical reads and rerun preservation';
    const createdMessage = await invoke(valid, 'created');
    const original = await account();
    currentHash = original.password_hash;
    sentinels.push(currentHash);
    assert.equal(original.normalized_username, username);
    assert.equal(original.status, 'active');
    assert.equal(original.credential_state, 'ready');
    assert.equal(original.version, 1);
    assert.equal(original.authentication_version, 1);
    assert.equal(
      await verifyPassword(Buffer.from(password), currentHash),
      true,
    );
    assert.equal(
      await verifyPassword(Buffer.from(replacement), currentHash),
      false,
    );
    assert.deepEqual(await counts(), {
      operators: 1,
      provenance: 1,
      tenants: 0,
      staff: 0,
    });
    const provenance = (
      await owner.query('SELECT * FROM public.operator_bootstrap_provenance')
    ).rows[0];
    assert.equal(provenance.operator_id, original.id);
    assert.equal(provenance.command_reference, 'deployment.bootstrap-operator');
    const event = (
      await owner.query(
        "SELECT * FROM public.audit_events WHERE event_type='platform.operator.bootstrapped'",
      )
    ).rows[0];
    assert.equal(event.actor_kind, 'system');
    assert.equal(event.identity_plane, 'system');
    assert.equal(event.actor_reference, 'deployment.bootstrap-operator');
    assert.equal(event.system_reason, 'initial-operator-provisioning');
    assert.equal(event.target_reference, original.id);
    assert.equal(event.actor_tenant_id, null);
    assert.equal(event.tenant_id, null);
    assert.equal(event.correlation_id, createdMessage.correlationId);
    assert.deepEqual(event.metadata, {
      outcome: 'created',
      rowVersion: 1,
      authenticationVersion: 1,
    });
    snapshot = new SnapshotDatabase(app.href);
    const authority = new PlatformAuthorityRepository(snapshot);
    const credential = new PlatformCredentialRepository(snapshot);
    assert.equal(
      (await authority.byId({ plane: 'platform', operatorId: original.id }))
        .kind,
      'eligible',
    );
    assert.equal(
      (await credential.read({ plane: 'platform', operatorId: original.id }))
        .credential.passwordHash,
      currentHash,
    );
    const before = await auditCount();
    await invoke(await file(username, replacement), 'already-created');
    await invoke(weak, 'invalid-input');
    assert.deepEqual(await account(), original);
    assert.equal(await auditCount(), before);
    assert.equal(
      await verifyPassword(
        Buffer.from(password),
        (await account()).password_hash,
      ),
      true,
    );
    await invoke(await file('other_identity_sentinel'), 'conflict');
    await owner.query(
      "UPDATE public.platform_operators SET status='disabled' WHERE id=$1",
      [original.id],
    );
    await invoke(valid, 'conflict');
    await owner.query(
      "UPDATE public.platform_operators SET status='active',credential_state='unset',password_hash=NULL,credential_changed_at=NULL WHERE id=$1",
      [original.id],
    );
    await invoke(valid, 'conflict');
    await owner.query(
      "UPDATE public.platform_operators SET credential_state='ready',password_hash=$2,credential_changed_at=clock_timestamp() WHERE id=$1",
      [original.id, currentHash],
    );
    await owner.query(
      "UPDATE public.operator_bootstrap_provenance SET command_reference='conflicting.fixture'",
    );
    await invoke(valid, 'conflict');
    await owner.query(
      "UPDATE public.operator_bootstrap_provenance SET command_reference='deployment.bootstrap-operator'",
    );
    phase = 'runtime authority denial';
    await invoke(valid, 'failed', { url: app.href });
    await assert.rejects(
      runtime.query(
        "INSERT INTO public.platform_operators(id,normalized_username,status,credential_state) VALUES ($1,'runtime.fixture','disabled','unset')",
        [randomUUID()],
      ),
      (error) => error.code === '42501',
    );
    for (const sql of [
      "INSERT INTO public.operator_bootstrap_provenance(singleton,operator_id,command_reference) VALUES(true,'00000000-0000-4000-8000-000000000000','runtime.fixture')",
      "UPDATE public.operator_bootstrap_provenance SET command_reference='runtime.fixture'",
      'DELETE FROM public.operator_bootstrap_provenance',
      'TRUNCATE public.operator_bootstrap_provenance',
    ])
      await assert.rejects(
        runtime.query(sql),
        (error) => error.code === '42501',
      );
    phase = 'unrelated existing account conflict';
    await clear();
    await owner.query(
      "INSERT INTO public.platform_operators(id,normalized_username,status,credential_state) VALUES ($1,$2,'disabled','unset')",
      [randomUUID(), username],
    );
    await invoke(valid, 'conflict');
    assert.equal((await counts()).provenance, 0);
    assert.equal(await auditCount(), before);
    await clear();
    console.log(
      'PASS: actual listener-free bootstrap, protected input/policy, private salted verification, canonical active/ready authority, atomic system audit, rerun/conflicts and runtime denial',
    );
    phase = 'independent process races';
    for (const matching of [true, false]) {
      await owner.query('SELECT pg_advisory_lock(846258114)');
      const startCount = await auditCount();
      const a = start(['bootstrap-operator', '--secret-file', valid]);
      const b = start([
        'bootstrap-operator',
        '--secret-file',
        await file(
          matching ? username : 'other_identity_sentinel',
          replacement,
        ),
      ]);
      await waitBlocked(2);
      await owner.query('SELECT pg_advisory_unlock(846258114)');
      const results = await Promise.all([a.result, b.result]);
      assert.deepEqual(
        results.map((value) => value.messages[0].state).sort(),
        matching ? ['already-created', 'created'] : ['conflict', 'created'],
      );
      assert.equal(
        results.filter((value) => value.code === 0).length,
        matching ? 2 : 1,
      );
      assert.deepEqual(await counts(), {
        operators: 1,
        provenance: 1,
        tenants: 0,
        staff: 0,
      });
      assert.equal(await auditCount(), startCount + 1);
      const winner = await account();
      sentinels.push(winner.password_hash);
      const winningPassword = (await verifyPassword(
        Buffer.from(password),
        winner.password_hash,
      ))
        ? password
        : replacement;
      await invoke(
        await file(
          winner.normalized_username,
          winningPassword === password ? replacement : password,
        ),
        'already-created',
      );
      assert.deepEqual(await account(), winner);
      await clear();
    }
    console.log(
      'PASS: independent matching/different-identity command processes block on PostgreSQL and converge on one initial operator/event',
    );
    phase = 'forced audit rollback';
    const priorAudit = await auditCount();
    await owner.query(
      "ALTER TABLE public.audit_events ADD CONSTRAINT bootstrap_audit_failure CHECK(event_type<>'platform.operator.bootstrapped') NOT VALID",
    );
    await invoke(valid, 'failed');
    assert.deepEqual(await counts(), {
      operators: 0,
      provenance: 0,
      tenants: 0,
      staff: 0,
    });
    assert.equal(await auditCount(), priorAudit);
    await owner.query(
      'ALTER TABLE public.audit_events DROP CONSTRAINT bootstrap_audit_failure',
    );
    phase = 'precommit process/database interruption';
    for (const terminateDatabase of [false, true]) {
      phase = `precommit ${terminateDatabase ? 'database' : 'process'} barrier`;
      await owner.query('BEGIN');
      await owner.query(
        'LOCK TABLE public.audit_events IN ACCESS EXCLUSIVE MODE',
      );
      const pending = start(['bootstrap-operator', '--secret-file', valid]);
      const [blocked] = await waitBlocked(1);
      phase = `precommit ${terminateDatabase ? 'database' : 'process'} uncommitted visibility`;
      // Writes have reached audit but are invisible to another OS/database process.
      assert.deepEqual(await counts(), {
        operators: 0,
        provenance: 0,
        tenants: 0,
        staff: 0,
      });
      if (terminateDatabase)
        await owner.query('SELECT pg_terminate_backend($1)', [blocked.pid]);
      else pending.child.kill('SIGKILL');
      phase = `precommit ${terminateDatabase ? 'database' : 'process'} command exit`;
      const result = await pending.result;
      await owner.query('COMMIT');
      phase = `precommit ${terminateDatabase ? 'database' : 'process'} rollback`;
      assert.ok(result.code !== 0);
      assert.deepEqual(await counts(), {
        operators: 0,
        provenance: 0,
        tenants: 0,
        staff: 0,
      });
      assert.equal(
        await auditCount(),
        priorAudit + (terminateDatabase ? 1 : 0),
      );
      phase = `precommit ${terminateDatabase ? 'database' : 'process'} safe rerun`;
      await invoke(valid, 'created');
      await clear();
    }
    phase = 'commit-response ambiguity';
    const sockets = new Set();
    let dropped = false;
    proxy = net.createServer((downstream) => {
      const upstream = net.connect(
        Number(trusted.port || 5432),
        trusted.hostname,
      );
      for (const socket of [downstream, upstream]) {
        sockets.add(socket);
        socket.on('error', () => {});
        socket.on('close', () => sockets.delete(socket));
      }
      downstream.on('data', (data) => upstream.write(data));
      let received = Buffer.alloc(0);
      upstream.on('data', (data) => {
        received = Buffer.concat([received, data]);
        while (received.length >= 5) {
          const size = received.readUInt32BE(1) + 1;
          if (size > 1024 * 1024 || size < 5)
            throw new Error('Invalid fixture proxy frame');
          if (received.length < size) break;
          const frame = received.subarray(0, size);
          received = received.subarray(size);
          // PostgreSQL emitted CommandComplete(COMMIT), so the transaction is
          // durable. Suppress that response and close the client transport.
          if (frame[0] === 67 && frame.subarray(5).toString() === 'COMMIT\0') {
            dropped = true;
            upstream.destroy();
            downstream.destroy();
            return;
          }
          downstream.write(frame);
        }
      });
      downstream.on('close', () => upstream.destroy());
      upstream.on('close', () => downstream.destroy());
    });
    proxy.listen(0, '127.0.0.1');
    await once(proxy, 'listening');
    const proxyAdmin = new URL(trusted);
    proxyAdmin.hostname = '127.0.0.1';
    proxyAdmin.port = String(proxy.address().port);
    const proxyApp = new URL(app);
    proxyApp.hostname = proxyAdmin.hostname;
    proxyApp.port = proxyAdmin.port;
    // Both typed URLs must target the same database endpoint. Only the trusted
    // pool connects during bootstrap; the runtime URL is still the actual role.
    const proxyEnvironment = env(proxyAdmin.href);
    proxyEnvironment.DATABASE_URL = proxyApp.href;
    const child = spawn(
      process.execPath,
      [
        '--import',
        './scripts/deny-listen.mjs',
        command,
        'bootstrap-operator',
        '--secret-file',
        valid,
      ],
      { env: proxyEnvironment, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    children.add(child);
    let response = '';
    child.stdout.on('data', (data) => (response += data));
    child.stderr.on('data', (data) => (response += data));
    const timeout = setTimeout(() => child.kill('SIGKILL'), 30000);
    const [code] = await once(child, 'exit');
    clearTimeout(timeout);
    children.delete(child);
    outputs.push(response);
    assert.equal(code, 1);
    assert.equal(dropped, true);
    assert.equal(JSON.parse(response.trim()).state, 'uncertain');
    const durable = await account();
    sentinels.push(durable.password_hash);
    const durableAudit = await auditCount();
    await invoke(await file(username, replacement), 'already-created');
    assert.deepEqual(await account(), durable);
    assert.equal(await auditCount(), durableAudit);
    assert.equal(
      await verifyPassword(Buffer.from(password), durable.password_hash),
      true,
    );
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => proxy.close(resolve));
    proxy = undefined;
    console.log(
      'PASS: forced audit failure and process/database precommit interruption roll back; real COMMIT response loss reports uncertainty and rerun preserves the durable original credential',
    );
    phase = 'hidden terminal input';
    await clear();
    const interactive = async (confirmation) => {
      const child = spawn(
        'script',
        [
          '--quiet',
          '--return',
          '--echo',
          'never',
          '--command',
          `${process.execPath} --import ./scripts/deny-listen.mjs ${command} bootstrap-operator`,
          '/dev/null',
        ],
        { env: env(), stdio: ['pipe', 'pipe', 'pipe'] },
      );
      children.add(child);
      let output = '';
      let step = 0;
      const prompts = [
        'Operator username (hidden): ',
        'Password (hidden): ',
        'Confirm password (hidden): ',
      ];
      const answers = [username, password, confirmation];
      const onData = (data) => {
        output += data;
        if (step < prompts.length && output.includes(prompts[step])) {
          child.stdin.write(answers[step] + '\n');
          step++;
        }
      };
      child.stdout.on('data', onData);
      child.stderr.on('data', onData);
      const timer = setTimeout(() => child.kill('SIGKILL'), 20000);
      const [code] = await once(child, 'exit');
      clearTimeout(timer);
      children.delete(child);
      outputs.push(output);
      assert.equal(step, 3);
      return code;
    };
    assert.equal(await interactive(replacement), 1);
    assert.equal((await counts()).operators, 0);
    assert.equal(await interactive(password), 0);
    sentinels.push((await account()).password_hash);
    assert.equal(
      await verifyPassword(
        Buffer.from(password),
        (await account()).password_hash,
      ),
      true,
    );
    phase = 'secret/audit sentinel exclusion and teardown';
    const audits = (
      await owner.query(
        'SELECT metadata,actor_reference,system_reason,correlation_id,target_reference FROM public.audit_events',
      )
    ).rows;
    const diagnostic = outputs.join('\n') + JSON.stringify(audits);
    for (const sentinel of [...sentinels, 'other_identity_sentinel'])
      assert.ok(!diagnostic.includes(sentinel));
    // Caller-owned input is retained unchanged; fixture tooling owns its teardown.
    assert.equal(
      await readFile(valid, 'utf8'),
      JSON.stringify({ username: '  BOOTSTRAP_IDENTITY_SENTINEL  ', password }),
    );
    console.log(
      'PASS: hidden PTY confirmation and exact bytes, protected input retained under caller control, sanitized diagnostics/audit; disposable fixture teardown only',
    );
  } catch {
    throw new Error(`Bootstrap acceptance failed during ${phase}`);
  } finally {
    for (const child of children) child.kill('SIGKILL');
    await snapshot?.close();
    if (proxy) {
      proxy.closeAllConnections?.();
      proxy.close();
    }
    await runtime.end();
    await owner.end();
    if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
    await rm(directory, { recursive: true, force: true });
  }
}
