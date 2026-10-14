import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fork, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir, networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createSocket } from 'node:dgram';
import { createServer, connect as connectTcp } from 'node:net';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const load = (p) => backend(`./dist/${p}.js`);
const { parseSessionConfig } = backend('@myims/config');
const { PlatformBrowser } = load(
  'modules/identity/adapters/http/platform-browser',
);
const { observationSettings, developmentObservationSettings } = load(
  'modules/telephony/domain/observation-settings',
);
const { checkAmiFaults } = await import('./check-pbx-ami-faults.mjs');
const { checkEngineFaults } = await import('./check-pbx-engine-faults.mjs');
async function until(action, description, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const result = await action();
    if (result) return result;
    await delay(1000);
  }
  throw new Error(`Observation deadline: ${description}`);
}
export function sipRegistration(access, expires) {
  return new Promise((resolve, reject) => {
    const socket = createSocket('udp4');
    const name = access.fixtureName,
      host = access.catalog[0].addresses[0],
      password = access.fixturePassword;
    let serial = 1,
      auth = '',
      done = false;
    const callId = randomUUID(),
      tag = randomBytes(8).toString('hex');
    const finish = (error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.close();
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(
      () => finish(new Error('SIP registration deadline')),
      5000,
    );
    function send() {
      const port = socket.address().port,
        uri = `sip:${host}`;
      const text = `REGISTER ${uri} SIP/2.0\r\nVia: SIP/2.0/UDP ${socket.address().address}:${port};branch=z9hG4bK${randomBytes(8).toString('hex')}\r\nMax-Forwards: 70\r\nFrom: <sip:${name}@${host}>;tag=${tag}\r\nTo: <sip:${name}@${host}>\r\nCall-ID: ${callId}\r\nCSeq: ${serial++} REGISTER\r\nContact: ${expires === 0 ? '*' : `<sip:${name}@${socket.address().address}:${port}>`}\r\nExpires: ${expires}\r\n${auth}Content-Length: 0\r\n\r\n`;
      socket.send(text, 5060, host);
    }
    socket.on('error', () => finish(new Error('SIP fixture failed')));
    socket.on('message', (data) => {
      const text = data.toString();
      if (text.startsWith('SIP/2.0 200')) {
        finish();
        return;
      }
      if (text.startsWith('SIP/2.0 401') && serial < 4) {
        const realm = /realm="([^"]+)"/.exec(text)?.[1],
          nonce = /nonce="([^"]+)"/.exec(text)?.[1];
        if (!realm || !nonce) {
          finish(new Error('SIP challenge unavailable'));
          return;
        }
        const md5 = (s) => createHash('md5').update(s).digest('hex');
        const uri = `sip:${host}`,
          a1 = md5(`${name}:${realm}:${password}`),
          a2 = md5(`REGISTER:${uri}`);
        const qop = /qop="([^"]+)"/.exec(text)?.[1],
          cnonce = randomBytes(8).toString('hex');
        const response = qop
          ? md5(`${a1}:${nonce}:00000001:${cnonce}:auth:${a2}`)
          : md5(`${a1}:${nonce}:${a2}`);
        auth = `Authorization: Digest username="${name}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}", algorithm=MD5${qop ? `, qop=auth, nc=00000001, cnonce="${cnonce}"` : ''}\r\n`;
        send();
      } else finish(new Error('SIP fixture rejected'));
    });
    const source = Object.values(networkInterfaces())
      .flat()
      .find((n) => n && n.family === 'IPv4' && !n.internal)?.address;
    assert.ok(source, 'Private fixture source address unavailable');
    socket.bind(0, source, send);
  });
}
async function databaseInterruptionProxy(appUrl) {
  const target = new URL(appUrl),
    sockets = new Set();
  let online = true;
  const server = createServer((downstream) => {
    if (!online) {
      downstream.destroy();
      return;
    }
    const upstream = connectTcp({
      host: target.hostname,
      port: Number(target.port || 5432),
    });
    for (const socket of [downstream, upstream]) {
      sockets.add(socket);
      socket.on('error', () => {});
      socket.on('close', () => sockets.delete(socket));
    }
    downstream.pipe(upstream);
    upstream.pipe(downstream);
    downstream.on('close', () => upstream.destroy());
    upstream.on('close', () => downstream.destroy());
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = new URL(appUrl);
  url.hostname = '127.0.0.1';
  url.port = String(server.address().port);
  url.searchParams.delete('sslmode');
  return {
    url: url.href,
    offline() {
      online = false;
      for (const socket of sockets) socket.destroy();
    },
    online() {
      online = true;
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
export async function checkPbxObservation({
  owner,
  runtime,
  worker,
  redis,
  issue,
  key,
  secrets,
  appUrl,
  commitProxy,
  pbxAccess,
}) {
  assert.ok(
    pbxAccess,
    'Controlled access must be supplied by trusted launcher',
  );
  const directory = await mkdtemp(join(tmpdir(), 'myims-pbx-observation-'));
  const children = [],
    captured = [];
  const databaseProxies = [];
  let registeredFixture = false;
  const profile = pbxAccess.catalog[0];
  const synthetic = {
    ...profile,
    installationId: randomUUID(),
    targetAlias: 'synthetic-isolation',
    aliases: [],
    host: 'unavailable.fixture.invalid',
    tlsServerName: 'unavailable.fixture.invalid',
    addresses: ['192.0.2.12'],
  };
  const catalog = [
    {
      ...profile,
      credentialAliases: [...profile.credentialAliases, 'fixture-rotated'],
    },
    synthetic,
  ];
  const catalogFile = join(directory, 'catalog.json');
  await writeFile(catalogFile, JSON.stringify(catalog), { mode: 0o600 });
  secrets.push(
    pbxAccess.credentials.password,
    pbxAccess.fixturePassword,
    pbxAccess.rotatedCredentials.password,
  );
  const browserConfig = {
    origin: 'https://localhost:9443',
    proxyPeers: ['127.0.0.1'],
    proxySecret: randomBytes(32).toString('hex'),
    csrfSecret: randomBytes(32).toString('hex'),
  };
  const browser = new PlatformBrowser(browserConfig);
  const http = await worker({
    http: true,
    productionHttp: true,
    pbxCatalogFile: catalogFile,
    config: parseSessionConfig({}),
    browserConfig,
  });
  const id = randomUUID();
  await owner.query(
    "INSERT INTO public.platform_operators(id,normalized_username,status,credential_state,password_hash,credential_changed_at) VALUES($1,$2,'active','ready','fixture',clock_timestamp())",
    [id, `observation.${id}`],
  );
  const session = await issue(http, {
    plane: 'platform',
    identityId: id,
    authenticationVersion: 1,
  });
  async function api(path, method = 'GET', body) {
    const res = await fetch(`${http.url}/platform/pbx-nodes${path}`, {
      method,
      headers: {
        origin: browserConfig.origin,
        'x-platform-proxy': browserConfig.proxySecret,
        'x-forwarded-for': '192.0.2.119',
        cookie: `__Host-myims-platform=${session.token}`,
        'x-platform-csrf': browser.sessionProof(session.token),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    captured.push(JSON.stringify(data));
    return { status: res.status, data, headers: res.headers };
  }
  const desired = (p) => ({
    displayName: 'Observation fixture',
    management: {
      targetAlias: p.targetAlias,
      transport: p.transport,
      port: p.port,
    },
    credentialAlias: 'local-asterisk-observer',
  });
  async function processFixture(url = appUrl, settings = {}) {
    const child = fork(
      new URL('./telephony-fixture.mjs', import.meta.url),
      [],
      { silent: true },
    );
    children.push(child);
    child.stdout.on('data', (data) => captured.push(data.toString()));
    child.stderr.on('data', (data) => captured.push(data.toString()));
    let id = 0;
    const pending = new Map();
    child.on('message', (m) => {
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      clearTimeout(p.timer);
      if (m.failure) p.reject(new Error(m.failure));
      else p.resolve(m.value);
    });
    const call = (op, ...args) =>
      new Promise((resolve, reject) => {
        const n = ++id;
        const timer = setTimeout(() => {
          pending.delete(n);
          reject(new Error(`Telephony fixture deadline ${op}`));
        }, 20000);
        pending.set(n, { resolve, reject, timer });
        child.send({ id: n, op, args });
      });
    await call('init', {
      url,
      catalog,
      trust: pbxAccess.trust,
      credentials: pbxAccess.credentials,
      settings,
    });
    return { call, child };
  }
  async function projection(node) {
    const r = await api(`/${node.id}`);
    assert.equal(r.status, 200);
    return r.data.node.observation;
  }
  async function expire(node) {
    await owner.query(
      "UPDATE public.pbx_ownership SET expires_at=clock_timestamp()-interval '1 second' WHERE node_id=$1",
      [node.id],
    );
  }
  try {
    await assert.rejects(
      runtime.query('DELETE FROM public.pbx_ownership'),
      (error) => error.code === '42501',
    );
    for (const [k] of Object.entries(developmentObservationSettings))
      assert.throws(() =>
        observationSettings({ ...developmentObservationSettings, [k]: 0 }),
      );
    assert.throws(() =>
      observationSettings({
        ...developmentObservationSettings,
        renewMs: 14000,
      }),
    );
    const created = await api('', 'POST', {
      requestId: randomUUID(),
      ...desired(profile),
    });
    assert.equal(created.status, 201);
    const node = created.data.node;
    const second = await api('', 'POST', {
      requestId: randomUUID(),
      ...desired(synthetic),
    });
    assert.equal(second.status, 201);
    const syntheticNode = second.data.node;
    await owner.query(
      'CREATE TABLE public.fixture_pbx_consumer(node_id uuid PRIMARY KEY,epoch bigint NOT NULL); GRANT SELECT,INSERT,UPDATE ON public.fixture_pbx_consumer TO myims_runtime',
    );
    await assert.rejects(
      runtime.query(
        'UPDATE public.pbx_ownership SET node_id=$1 WHERE node_id=$2',
        [syntheticNode.id, node.id],
      ),
      (error) => error.code === '42501',
    );
    await assert.rejects(
      runtime.query(
        'INSERT INTO public.pbx_ownership(node_id,desired_version,epoch) VALUES($1,1,99)',
        [randomUUID()],
      ),
      (error) => error.code === '42501',
    );
    const a = await processFixture(),
      b = await processFixture();
    const contenders = await Promise.all([
      a.call('acquire', node.id),
      b.call('acquire', node.id),
    ]);
    assert.equal(contenders.filter(Boolean).length, 1);
    const winner = contenders[0] ? a : b,
      loser = winner === a ? b : a,
      old = contenders.find(Boolean);
    assert.equal((await winner.call('renew')).epoch, old.epoch);
    assert.ok(await loser.call('acquire', syntheticNode.id));
    assert.ok(await winner.call('publish', old, 1, []));
    assert.equal(await winner.call('publish', old, 1, []), false);
    assert.equal(
      await winner.call('publish', old, 0, []).catch(() => false),
      false,
    );
    assert.equal(
      await winner.call('publish', old, 3, []),
      false,
      'Sequence gaps require reconciliation',
    );
    const receipt = await winner.call('intent', old);
    assert.equal(receipt.accepted, true);
    const intentCount = Number(
      (
        await owner.query(
          "SELECT count(*) FROM public.outbox_work WHERE work_type='fixture.pbx-observation'",
        )
      ).rows[0].count,
    );
    await assert.rejects(winner.call('rollbackIntent'));
    const cancelledIntent = await winner.call('cancelIntent');
    assert.equal(cancelledIntent.callbackRan, true);
    assert.equal(cancelledIntent.accepted, false);
    assert.equal(
      Number(
        (
          await owner.query(
            "SELECT count(*) FROM public.outbox_work WHERE work_type='fixture.pbx-observation'",
          )
        ).rows[0].count,
      ),
      intentCount,
    );
    await winner.call('queue', 2);
    winner.child.kill('SIGSTOP');
    await expire(node);
    const replacement = await loser.call('acquire', node.id);
    assert.ok(BigInt(replacement.epoch) > BigInt(old.epoch));
    winner.child.kill('SIGCONT');
    assert.equal(await winner.call('flush'), false);
    assert.equal(await winner.call('release', old), false);
    assert.equal(await winner.call('verify', old), false);
    assert.equal((await winner.call('intent', old)).accepted, false);
    assert.equal((await winner.call('consumer', old)).accepted, false);
    assert.equal(await winner.call('publish', old, 9, []), false);
    await loser.call('release', replacement);
    const next = await winner.call('acquire', node.id);
    assert.ok(BigInt(next.epoch) > BigInt(replacement.epoch));
    await expire(node);
    assert.equal(await winner.call('renew'), null);
    let reacquired = await winner.call('acquire', node.id);
    assert.ok(BigInt(reacquired.epoch) > BigInt(next.epoch));
    await owner.query(
      "UPDATE public.pbx_ownership SET expires_at=clock_timestamp()+interval '500 milliseconds' WHERE node_id=$1",
      [node.id],
    );
    const beforeDelayed = Number(
      (
        await owner.query(
          "SELECT count(*) FROM public.outbox_work WHERE work_type='fixture.pbx-observation'",
        )
      ).rows[0].count,
    );
    const delayed = await winner.call('delayedIntent');
    assert.equal(delayed.callbackRan, true);
    assert.equal(delayed.accepted, false);
    assert.equal(
      Number(
        (
          await owner.query(
            "SELECT count(*) FROM public.outbox_work WHERE work_type='fixture.pbx-observation'",
          )
        ).rows[0].count,
      ),
      beforeDelayed,
    );
    reacquired = await winner.call('acquire', node.id);
    assert.ok(reacquired);
    // Real HTTP edit/audit failure must roll back the installed observation hook.
    await owner.query(
      `CREATE FUNCTION public.fixture_reject_pbx_audit() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN IF NEW.event_type='telephony.pbx.desired-changed' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END;$body$; CREATE TRIGGER fixture_pbx_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fixture_reject_pbx_audit()`,
    );
    const failedEdit = await api(`/${node.id}`, 'PATCH', {
      expectedVersion: 1,
      ...desired(profile),
      credentialAlias: 'fixture-rotated',
    });
    assert.equal(failedEdit.status, 503);
    await owner.query(
      'DROP TRIGGER fixture_pbx_audit ON public.audit_events; DROP FUNCTION public.fixture_reject_pbx_audit()',
    );
    assert.equal((await api(`/${node.id}`)).data.node.version, 1);
    assert.equal(await winner.call('verify', reacquired), true);
    // Forced invalidation failure rolls back earlier desired and audit writes too.
    await owner.query(
      `CREATE FUNCTION public.fixture_reject_pbx_invalidation() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN RAISE EXCEPTION 'injected invalidation failure'; END;$body$; CREATE TRIGGER fixture_pbx_invalidation BEFORE UPDATE ON public.pbx_observations FOR EACH ROW EXECUTE FUNCTION public.fixture_reject_pbx_invalidation()`,
    );
    const failedHook = await api(`/${node.id}`, 'PATCH', {
      expectedVersion: 1,
      ...desired(profile),
      credentialAlias: 'fixture-rotated',
    });
    assert.equal(failedHook.status, 503);
    await owner.query(
      'DROP TRIGGER fixture_pbx_invalidation ON public.pbx_observations; DROP FUNCTION public.fixture_reject_pbx_invalidation()',
    );
    assert.equal((await api(`/${node.id}`)).data.node.version, 1);
    assert.equal(await winner.call('verify', reacquired), true);
    // Atomic name-only requalification preserves ownership; old-version callbacks reject.
    const rename = await api(`/${node.id}`, 'PATCH', {
      expectedVersion: 1,
      ...desired(profile),
      displayName: 'Renamed observation',
    });
    assert.equal(rename.status, 200);
    assert.equal(await winner.call('publish', reacquired, 10, []), false);
    const renamed = await winner.call('renew');
    assert.equal(renamed.epoch, reacquired.epoch);
    assert.equal(renamed.desiredVersion, 2);
    assert.ok(await winner.call('publish', renamed, 1, []));
    const edit = await api(`/${node.id}`, 'PATCH', {
      expectedVersion: 2,
      ...desired(profile),
      credentialAlias: 'fixture-rotated',
    });
    assert.equal(edit.status, 200);
    assert.equal((await winner.call('consumer', renamed)).accepted, false);
    assert.equal(await winner.call('release', renamed), false);
    assert.notEqual((await projection(node)).freshness, 'current');
    console.log(
      'PASS B-03/B-04 real PostgreSQL independent-process race, expiry/takeover/release epochs; paused stale callbacks, intents/consumer and old desired versions rejected (expiry injected by trusted database fixture).',
    );
    // Runtime real authenticated AMI observation.
    const empty = await a.call('snapshot', profile.targetAlias);
    assert.equal(empty.kind, 'complete', JSON.stringify(empty));
    assert.deepEqual(empty.registrations, []);
    assert.deepEqual(
      (await a.call('permissions', profile.targetAlias)).denied,
      ['Command', 'Originate', 'UpdateConfig'],
    );
    console.log(
      'PASS B-01/B-08 real controlled AMI account denies command/originate/config classes; system-class mutation authority is explicitly retained and not probed by executing a mutation.',
    );
    await a.call('credentials', {
      username: pbxAccess.credentials.username,
      password: 'PBX_SECRET_SENTINEL',
    });
    const invalid = await a.call('snapshot', profile.targetAlias);
    assert.equal(invalid.kind, 'failed');
    assert.ok(['auth_failed', 'disconnected'].includes(invalid.failure));
    await a.call('removeSecret');
    assert.equal(
      (await a.call('snapshot', profile.targetAlias)).failure,
      'secret_missing',
    );
    console.log('PBX_FIXTURE_ROTATE');
    await a.call('credentials', pbxAccess.rotatedCredentials);
    await until(
      async () =>
        (await a.call('snapshot', profile.targetAlias)).kind === 'complete',
      'real credential rotation',
    );
    await b.call('credentials', pbxAccess.rotatedCredentials);
    console.log(
      'PASS B-07 real controlled account rotation and fresh protected provider lookup reconnect; installation identity unchanged.',
    );
    await a.call('start');
    await b.call('start');
    await until(async () => {
      const o = await projection(node);
      return o.freshness === 'current' && o;
    }, 'real initial complete empty snapshot');
    console.log('PBX_FIXTURE_INSTALL');
    const unregistered = await until(async () => {
      const r = await a.call('snapshot', profile.targetAlias);
      return (
        r.kind === 'complete' &&
        r.registrations.find((f) => f.endpoint === pbxAccess.fixtureName)
      );
    }, 'unregistered fixture');
    assert.equal(unregistered.registered, false);
    await sipRegistration(pbxAccess, 120);
    registeredFixture = true;
    await until(async () => {
      const o = await projection(node);
      return (
        o.freshness === 'current' &&
        o.registrations.find(
          (f) => f.endpoint === pbxAccess.fixtureName && f.registered,
        )
      );
    }, 'real SIP registration');
    const desiredState = (await api(`/${node.id}`)).data.node;
    assert.equal(desiredState.version, 3);
    assert.equal(desiredState.credentialAlias, 'fixture-rotated');
    const passive = await redis.get(key(session.token));
    await api('');
    assert.equal(await redis.get(key(session.token)), passive);
    assert.equal(
      (
        await owner.query(
          'SELECT count(*)::int AS n FROM public.fixture_pbx_consumer',
        )
      ).rows[0].n,
      0,
    );
    console.log(
      'PASS B-02 real controlled Asterisk certificate-verified authentication, complete empty/unregistered/registered snapshots, safe invalid-auth/secret-missing states; desired registry and tenant inventory unchanged.',
    );
    const beforeRestart = (await projection(node)).epoch;
    console.log('PBX_FIXTURE_RESTART');
    await until(async () => {
      const o = await projection(node);
      return o.freshness !== 'current';
    }, 'disconnect is historical');
    await until(
      async () => {
        const o = await projection(node);
        return o.freshness === 'current' && o;
      },
      'real reconnect reconciliation',
      25000,
    );
    console.log(
      'PASS B-06 real controlled Asterisk disconnect/restart/reconnect reconciles complete snapshots.',
    );
    captured.push(
      JSON.stringify([await a.call('events'), await b.call('events')]),
    );
    // Failover: release the active engine and let the independent successor reconcile.
    await a.call('stop');
    await b.call('stop');
    const historical = await projection(node);
    assert.notEqual(historical.freshness, 'current');
    await a.call('start');
    await until(async () => {
      const o = await projection(node);
      return (
        o.freshness === 'current' && BigInt(o.epoch) > BigInt(beforeRestart)
      );
    }, 'new engine generation reconciles');
    await a.call('loss');
    await until(async () => {
      const o = await projection(node);
      return o.freshness !== 'current';
    }, 'ambiguous renewal cancels publication');
    await a.call('stop');
    await a.call('recover');
    await b.call('start');
    await until(async () => {
      const o = await projection(node);
      return o.freshness === 'current';
    }, 'independent failover reconciliation');
    await b.call('outage');
    await until(async () => {
      const o = await projection(node);
      return o.freshness !== 'current';
    }, 'database renewal outage cancels');
    await b.call('stop');
    await b.call('recover');
    // Real PostgreSQL COMMIT response loss at renewal, not a substitute for live PBX checks.
    console.log('PBX_FIXTURE_RESTORE');
    await a.call('credentials', pbxAccess.credentials);
    await b.call('credentials', pbxAccess.credentials);
    const cp = await commitProxy(/UPDATE public\.pbx_ownership SET expires_at/);
    const c = await processFixture(cp.url);
    const ct = await c.call('acquire', node.id);
    assert.ok(ct);
    await assert.rejects(c.call('renew'));
    assert.ok(cp.dropped());
    assert.equal(await a.call('acquire', node.id), null);
    await expire(node);
    console.log(
      'PASS B-05 renewal ambiguity/database-loss controls cancel work; real PostgreSQL renewal COMMIT-response loss leaves no assumed authority.',
    );
    await b.call('start');
    await until(async () => {
      const o = await projection(node);
      return o.freshness === 'current';
    }, 'reacquisition after uncertainty');
    await sipRegistration(pbxAccess, 0);
    registeredFixture = false;
    console.log('PBX_FIXTURE_REMOVE');
    let obsolete;
    await until(async () => {
      const o = await projection(node);
      obsolete = o;
      return o.freshness === 'current' && o.registrations.length === 0;
    }, 'complete snapshot removes obsolete facts').catch((error) => {
      console.log(
        JSON.stringify({
          checkpoint: 'obsolete-snapshot',
          freshness: obsolete?.freshness,
          connection: obsolete?.connection,
          failure: obsolete?.failure,
          epoch: obsolete?.epoch,
          sequence: obsolete?.sequence,
          registrationCount: obsolete?.registrations.length,
        }),
      );
      throw error;
    });
    await b.call('stop');
    const interruption = await databaseInterruptionProxy(appUrl);
    databaseProxies.push(interruption);
    const interrupted = await processFixture(interruption.url);
    await interrupted.call('start');
    const beforeInterruption = await until(async () => {
      const o = await projection(node);
      return o.freshness === 'current' && o;
    }, 'real database transport fixture owns node');
    interruption.offline();
    await delay(5500);
    const unchanged = await projection(node);
    assert.equal(unchanged.sequence, beforeInterruption.sequence);
    // Accelerate only the lease clock boundary through trusted DB expiry; transport
    // destruction/rejection is real and no production database is stopped.
    await expire(node);
    assert.notEqual((await projection(node)).freshness, 'current');
    interruption.online();
    await until(async () => {
      const o = await projection(node);
      return (
        o.freshness === 'current' &&
        BigInt(o.epoch) > BigInt(beforeInterruption.epoch)
      );
    }, 'database transport restored with new reconciled epoch');
    await interrupted.call('stop');
    console.log(
      'PASS B-05 real PostgreSQL TCP interruption prevents publication; restored transport reacquires a newer epoch and reconciles (lease expiry accelerated by trusted fixture).',
    );
    const stoppedAt = Date.now();
    await b.call('stop');
    await until(
      async () => {
        const o = await projection(node);
        return o.freshness === 'stale';
      },
      'freshness expires without observer',
      35000,
    );
    assert.ok(Date.now() - stoppedAt >= 25000);
    // Also exercise the actual shipping entry point, without fixture controls.
    const credentialFile = join(directory, 'main-observer.json'),
      trustFile = join(directory, 'main-ca.pem'),
      configFile = join(directory, 'main-configuration.json');
    await writeFile(credentialFile, JSON.stringify(pbxAccess.credentials), {
      mode: 0o600,
    });
    await writeFile(trustFile, pbxAccess.trust, { mode: 0o600 });
    await writeFile(
      configFile,
      JSON.stringify({
        credentials: {
          'local-asterisk-observer': credentialFile,
          'fixture-rotated': credentialFile,
        },
        trustFile,
      }),
      { mode: 0o600 },
    );
    const mains = [];
    for (let i = 0; i < 2; i++) {
      const child = spawn(
        process.execPath,
        [
          '--import',
          './scripts/deny-listen.mjs',
          './services/backend/dist/entrypoints/telephony/main.js',
        ],
        {
          env: {
            PATH: process.env.PATH,
            PBX_OBSERVATION_PROFILE: 'approved-local-development',
            PBX_CATALOG_FILE: catalogFile,
            PBX_OBSERVATION_CONFIG_FILE: configFile,
            DATABASE_URL: appUrl,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      children.push(child);
      mains.push(child);
      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
        captured.push(data.toString());
      });
      child.stderr.on('data', (data) => captured.push(data.toString()));
      await until(
        () => output.includes('"capabilities":"pbx-observation"'),
        'actual telephony entry point readiness',
      );
    }
    await until(
      async () => (await projection(node)).freshness === 'current',
      'actual independent main reconciliation',
    );
    const drains = mains.map((child) => once(child, 'exit'));
    const drainingAt = Date.now();
    for (const child of mains) child.kill('SIGTERM');
    for (const exit of drains) {
      const [code] = await exit;
      assert.equal(code, 0);
    }
    assert.ok(Date.now() - drainingAt < 5500);
    assert.equal(
      (
        await owner.query(
          'SELECT count(*)::int AS n FROM public.pbx_ownership WHERE incarnation IS NOT NULL AND expires_at>clock_timestamp()',
        )
      ).rows[0].n,
      0,
    );
    console.log(
      'PASS B-05/B-08 actual shipping telephony A/B entry points reconcile, open no listener, drain within 5 seconds and release matching generations.',
    );
    await checkAmiFaults();
    await checkEngineFaults();
    const diagnostics =
      captured.join('') +
      JSON.stringify(
        (await owner.query('SELECT * FROM public.pbx_observations')).rows,
      ) +
      JSON.stringify(
        (
          await owner.query(
            "SELECT payload FROM public.outbox_work WHERE work_type='fixture.pbx-observation'",
          )
        ).rows,
      );
    for (const sentinel of [
      ...secrets,
      'PBX_SECRET_SENTINEL',
      'PBX_USER_SENTINEL',
    ])
      assert.ok(!diagnostics.includes(sentinel), 'Protected sentinel leaked');
    console.log(
      'PASS B-07/B-08 safe projections/diagnostics, unmapped registrations, passive HTTP, no live mutation adapter; synthetic second-node lease/isolation only, no live multi-PBX claim.',
    );
  } finally {
    if (registeredFixture)
      await sipRegistration(pbxAccess, 0).catch(() =>
        console.error('PBX fixture registration cleanup failed'),
      );
    for (const child of children) {
      if (child.exitCode === null) child.kill('SIGCONT');
      // Fixture teardown owns only its process-private temporary directory.
      if (child.connected)
        await new Promise((resolve) => {
          const id = randomBytes(4).toString('hex');
          const timer = setTimeout(resolve, 6000);
          const handler = (m) => {
            if (m.id === id) {
              clearTimeout(timer);
              child.off('message', handler);
              resolve();
            }
          };
          child.on('message', handler);
          child.send({ id, op: 'close', args: [] });
        });
      child.kill('SIGKILL');
    }
    for (const proxy of databaseProxies) await proxy.close();
    console.log('PBX_FIXTURE_REMOVE');
    await rm(directory, { recursive: true, force: true });
  }
}
