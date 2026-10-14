// Non-shipping independent process/fault control. No test control route exists in production.
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { connect as tlsConnect } from 'node:tls';
import { readFile } from 'node:fs/promises';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const load = (p) => backend(`./dist/${p}.js`);
const { ObservationRepository } = load(
  'modules/telephony/adapters/db/observation-repository',
);
const { ObservationEngine } = load(
  'modules/telephony/application/observation-engine',
);
const { observationSettings, developmentObservationSettings } = load(
  'modules/telephony/domain/observation-settings',
);
const { FilePbxCatalog } = load(
  'modules/telephony/adapters/connectivity/catalog',
);
const { ExactPbxDestinationPolicy } = load(
  'modules/telephony/adapters/connectivity/destination',
);
const { SecretFileCredentials } = load(
  'modules/telephony/adapters/connectivity/secret-files',
);
const { AmiObservationAdapter } = load(
  'modules/telephony/adapters/observation/ami-adapter',
);
const { OutboxRepository } = load('infrastructure/outbox/outbox-repository');
const { SafeLogger } = load('infrastructure/execution/logging');
let store,
  adapter,
  engine,
  catalog,
  dir,
  credentialFile,
  settings,
  token,
  queued,
  loseRenewal = false,
  outage = false,
  faultTripped = false;
const incarnation = randomUUID();
const events = [];
const controller = new globalThis.AbortController();
const contract = {
  type: 'fixture.pbx-observation',
  version: 1,
  fields: { version: { kind: 'integer', min: 1, max: 2147483647 } },
};
async function probePermissions(targetAlias) {
  const profile = catalog.resolve(targetAlias);
  const dest = await new ExactPbxDestinationPolicy(catalog).destination(
    profile,
    controller.signal,
  );
  if (dest.kind !== 'approved')
    throw new Error('Permission probe destination denied');
  const secret = JSON.parse(await readFile(credentialFile, 'utf8'));
  const socket = tlsConnect({
    host: dest.address,
    port: dest.port,
    servername: dest.servername,
    ca: await readFile(join(dir, 'ca.pem')),
    rejectUnauthorized: true,
  });
  let buffer = '',
    pending,
    serial = 0;
  socket.on('error', () =>
    pending?.reject(new Error('Permission probe failed')),
  );
  socket.on('close', () =>
    pending?.reject(new Error('Permission probe closed')),
  );
  socket.on('data', (bytes) => {
    buffer += bytes.toString();
    if (buffer.length > 16384) {
      socket.destroy();
      return;
    }
    if (buffer.startsWith('Asterisk Call Manager/')) {
      const at = buffer.indexOf('\r\n');
      if (at < 0) return;
      buffer = buffer.slice(at + 2);
    }
    let at;
    while ((at = buffer.indexOf('\r\n\r\n')) >= 0) {
      const frame = buffer.slice(0, at);
      buffer = buffer.slice(at + 4);
      if (pending && frame.split('\r\n').includes(`ActionID: ${pending.id}`)) {
        const p = pending;
        pending = undefined;
        p.resolve(frame);
      }
    }
  });
  async function request(action, fields = '') {
    const id = String(++serial);
    let timer;
    try {
      return await new Promise((resolve, reject) => {
        pending = { id, resolve, reject };
        timer = setTimeout(() => {
          socket.destroy();
          reject(new Error('Permission probe deadline'));
        }, 3000);
        socket.write(`Action: ${action}\r\nActionID: ${id}\r\n${fields}\r\n`);
      });
    } finally {
      clearTimeout(timer);
    }
  }
  try {
    await new Promise((resolve, reject) => {
      socket.once('secureConnect', resolve);
      socket.once('error', reject);
    });
    const login = await request(
      'Login',
      `Username: ${secret.username}\r\nSecret: ${secret.password}\r\nEvents: off\r\n`,
    );
    if (!login.includes('Response: Success'))
      throw new Error('Permission probe authentication failed');
    // Fixed denied-class probes only; no arbitrary command input and no valid
    // originate/configuration request is constructed. CLI text is read-only.
    const denied = [];
    for (const [action, fields] of [
      ['Command', 'Command: core show version\r\n'],
      ['Originate', ''],
      ['UpdateConfig', ''],
    ]) {
      const reply = await request(action, fields);
      if (
        !reply.includes('Response: Error') ||
        !reply.includes('Message: Permission denied')
      )
        throw new Error('Unexpected AMI action authority');
      denied.push(action);
    }
    return { denied };
  } finally {
    socket.destroy();
  }
}
async function handle(op, args) {
  if (op === 'init') {
    const [input] = args;
    dir = await mkdtemp(join(tmpdir(), 'myims-observer-process-'));
    const file = join(dir, 'catalog.json'),
      ca = join(dir, 'ca.pem');
    credentialFile = join(dir, 'observer.json');
    await writeFile(file, JSON.stringify(input.catalog), { mode: 0o600 });
    await writeFile(ca, input.trust, { mode: 0o600 });
    await writeFile(credentialFile, JSON.stringify(input.credentials), {
      mode: 0o600,
    });
    settings = observationSettings({
      ...developmentObservationSettings,
      ...input.settings,
    });
    catalog = new FilePbxCatalog(file);
    store = new ObservationRepository(
      input.url,
      settings,
      new SafeLogger('telephony', (line) => events.push(line)),
    );
    adapter = new AmiObservationAdapter(
      new SecretFileCredentials(
        new Map([
          ['local-asterisk-observer', credentialFile],
          ['fixture-rotated', credentialFile],
        ]),
      ),
      new ExactPbxDestinationPolicy(catalog),
      ca,
      settings,
    );
    return { incarnation };
  }
  if (op === 'acquire') {
    token = await store.acquire(args[0], incarnation);
    return token;
  }
  if (op === 'token') return token;
  if (op === 'renew') {
    token = await store.renew(token);
    return token;
  }
  if (op === 'release') return store.release(args[0] ?? token);
  if (op === 'publish')
    return store.publish(args[0] ?? token, args[1] ?? 1, args[2] ?? []);
  if (op === 'verify') return store.verify(args[0] ?? token);
  if (op === 'queue') {
    queued = { token: { ...token }, sequence: args[0] };
    return true;
  }
  if (op === 'flush') return store.publish(queued.token, queued.sequence, []);
  if (op === 'intent')
    return store.fenced(args[0] ?? token, async (tx) =>
      new OutboxRepository().insert(tx, contract, randomUUID(), {
        version: (args[0] ?? token).desiredVersion,
      }),
    );
  if (op === 'consumer')
    return store.fenced(args[0], async (tx) => {
      await tx.query(
        'INSERT INTO public.fixture_pbx_consumer(node_id,epoch) VALUES($1,$2) ON CONFLICT(node_id) DO UPDATE SET epoch=excluded.epoch',
        [args[0].nodeId, args[0].epoch],
      );
      return true;
    });
  if (op === 'delayedIntent') {
    let callbackRan = false;
    const result = await store.fenced(token, async (tx) => {
      await new OutboxRepository().insert(tx, contract, randomUUID(), {
        version: token.desiredVersion,
      });
      callbackRan = true;
      await delay(800);
      return true;
    });
    return { ...result, callbackRan };
  }
  if (op === 'cancelIntent') {
    const cancelled = new globalThis.AbortController();
    let callbackRan = false;
    const result = await store.fenced(
      token,
      async (tx) => {
        await new OutboxRepository().insert(tx, contract, randomUUID(), {
          version: token.desiredVersion,
        });
        callbackRan = true;
        cancelled.abort();
        return true;
      },
      cancelled.signal,
    );
    return { ...result, callbackRan };
  }
  if (op === 'rollbackIntent')
    return store.fenced(token, async (tx) => {
      await new OutboxRepository().insert(tx, contract, randomUUID(), {
        version: token.desiredVersion,
      });
      throw new Error('Injected required-write failure');
    });
  if (op === 'credentials') {
    await writeFile(credentialFile, JSON.stringify(args[0]), { mode: 0o600 });
    return true;
  }
  if (op === 'removeSecret') {
    await rm(credentialFile);
    return true;
  }
  if (op === 'permissions') return probePermissions(args[0]);
  if (op === 'snapshot') {
    const opened = await adapter.open(
      catalog.resolve(args[0]),
      args[1] ?? 'local-asterisk-observer',
      controller.signal,
    );
    if (opened.kind === 'failed') return opened;
    try {
      return await opened.session.snapshot(controller.signal);
    } finally {
      opened.session.close();
    }
  }
  if (op === 'start') {
    // Fault controls wrap the owner port, leaving the shipping engine unchanged.
    const wrapped = {
      discover: (...a) => {
        if (faultTripped)
          throw new Error('Injected persistent database uncertainty');
        return store.discover(...a);
      },
      acquire: (...a) => store.acquire(...a),
      renew: async (...a) => {
        if (outage) {
          faultTripped = true;
          throw new Error('Injected database unavailable');
        }
        const r = await store.renew(...a);
        if (loseRenewal) {
          faultTripped = true;
          throw new Error('Injected renewal response lost');
        }
        return r;
      },
      release: (...a) => store.release(...a),
      verify: (...a) => store.verify(...a),
      publish: (...a) => store.publish(...a),
      fail: (...a) => store.fail(...a),
    };
    engine = new ObservationEngine(wrapped, catalog, adapter, settings);
    await engine.start();
    return { incarnation: engine.incarnation };
  }
  if (op === 'loss') {
    loseRenewal = true;
    return true;
  }
  if (op === 'outage') {
    outage = true;
    return true;
  }
  if (op === 'recover') {
    loseRenewal = false;
    outage = false;
    faultTripped = false;
    return true;
  }
  if (op === 'stop') {
    await engine?.stop();
    engine = undefined;
    return true;
  }
  if (op === 'events') return events;
  if (op === 'close') {
    controller.abort();
    await engine?.stop();
    await store?.close();
    await rm(dir, { recursive: true, force: true });
    return true;
  }
  throw new Error('Invalid fixture operation');
}
process.on('message', async ({ id, op, args }) => {
  try {
    process.send({ id, value: await handle(op, args) });
  } catch {
    process.send({ id, failure: 'fixture_operation_failed' });
  }
});
