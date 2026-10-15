// Private IPC to independent telephony processes; HTTP/Next receive catalog only.
import { randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
export async function pbxBrowserFixture(appUrl, access, secrets) {
  const processes = [];
  secrets.push(
    access.credentials.username,
    access.credentials.password,
    access.fixturePassword,
    access.rotatedCredentials.username,
    access.rotatedCredentials.password,
  );
  const catalog = [
    {
      ...access.catalog[0],
      credentialAliases: [
        ...access.catalog[0].credentialAliases,
        'fixture-rotated',
        'fixture-missing',
      ],
    },
  ];
  catalog.push({
    ...catalog[0],
    installationId: randomUUID(),
    targetAlias: 'browser-unavailable',
    aliases: [],
    host: 'unavailable.fixture.invalid',
    tlsServerName: 'unavailable.fixture.invalid',
    addresses: ['192.0.2.12'],
  });
  async function start() {
    const child = fork(
      new URL('./telephony-fixture.mjs', import.meta.url),
      [],
      { silent: true },
    );
    let serial = 0;
    const pending = new Map();
    const logs = [];
    child.stdout.on('data', (b) => logs.push(b.toString()));
    child.stderr.on('data', (b) => logs.push(b.toString()));
    child.on('message', (m) => {
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      clearTimeout(p.timer);
      if (m.failure) p.reject(new Error('Telephony browser fixture failed'));
      else p.resolve(m.value);
    });
    const call = (op, ...args) =>
      new Promise((resolve, reject) => {
        const id = ++serial,
          timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error(`Telephony deadline: ${op}`));
          }, 20000);
        pending.set(id, { resolve, reject, timer });
        child.send({ id, op, args });
      });
    const result = { child, call, logs };
    processes.push(result);
    await call('init', {
      url: appUrl,
      catalog,
      trust: access.trust,
      credentials: access.credentials,
      settings: {},
    });
    return result;
  }
  return {
    access,
    catalog,
    start,
    close: async () => {
      for (const p of processes) {
        if (p.child.connected) {
          await p.call('close');
          p.child.disconnect();
        }
        for (const secret of secrets)
          if (p.logs.join('').includes(secret))
            throw new Error('Observer secret leaked');
      }
    },
  };
}
