// JavaScript port/failure evidence only. Real Android/iOS acceptance is separate.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const directory = mkdtempSync(join(tmpdir(), 'myims-native-port-'));
try {
  for (const name of ['access', 'transport', 'secure-storage']) {
    let source = readFileSync(`apps/responder-mobile/auth/${name}.ts`, 'utf8')
      .replace("from './transport'", "from './transport.mjs'")
      .replace(
        "import * as SecureStore from 'expo-secure-store';",
        'const SecureStore = globalThis.__nativeStorageFixture;',
      );
    source = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    }).outputText;
    writeFileSync(join(directory, `${name}.mjs`), source);
  }
  const { MobileAccess } = await import(
    pathToFileURL(join(directory, 'access.mjs'))
  );
  const { MobileAccessError, mobileTransport } = await import(
    pathToFileURL(join(directory, 'transport.mjs'))
  );
  const token = 'a'.repeat(43),
    secondToken = 'b'.repeat(43);
  const owner = {
    plane: 'tenant',
    consumer: 'mobile',
    tenantId: '11111111-1111-4111-8111-111111111111',
    staffId: '22222222-2222-4222-8222-222222222222',
    roles: ['responder'],
    idleExpiresAt: Date.now() + 86400000,
    absoluteExpiresAt: Date.now() + 604800000,
  };
  const input = () => ({
    tenantCode: 'native.fixture',
    username: 'responder',
    password: 'not a real credential',
  });
  function fixture() {
    let stored = null,
      saveOutcome = 'stored',
      clearOutcome = 'cleared',
      readOutcome = null,
      revoked = false,
      revokeFails = false,
      sessionFails = false,
      saves = 0,
      reads = 0,
      checks = 0,
      logouts = 0,
      state;
    const storage = {
      async save(t) {
        saves++;
        stored = t;
        return saveOutcome;
      },
      async read() {
        reads++;
        return (
          readOutcome ??
          (stored ? { kind: 'found', token: stored } : { kind: 'absent' })
        );
      },
      async clear() {
        if (clearOutcome === 'cleared') stored = null;
        return clearOutcome;
      },
    };
    const transport = {
      async signIn() {
        revoked = false;
        return { ...owner, token };
      },
      async session(t) {
        checks++;
        assert.ok([token, secondToken].includes(t));
        if (revoked || sessionFails) throw new MobileAccessError(401);
        return { ...owner };
      },
      async logout(t) {
        assert.ok(!t || [token, secondToken].includes(t));
        logouts++;
        if (revokeFails) throw new MobileAccessError(503);
        revoked = true;
      },
    };
    const access = new MobileAccess(storage, transport, (next) => {
      state = next;
    });
    return {
      access,
      storage,
      transport,
      get state() {
        return state;
      },
      get stored() {
        return stored;
      },
      get saves() {
        return saves;
      },
      get checks() {
        return checks;
      },
      get logouts() {
        return logouts;
      },
      get reads() {
        return reads;
      },
      save(value) {
        saveOutcome = value;
      },
      clear(value) {
        clearOutcome = value;
      },
      read(value) {
        readOutcome = value;
      },
      revokeFail(value) {
        revokeFails = value;
      },
      sessionFail(value) {
        sessionFails = value;
      },
    };
  }
  const absent = fixture();
  await absent.access.logout();
  assert.equal(absent.state.session, null);
  assert.ok(
    absent.state.message.includes('No stored session was available to revoke'),
  );
  absent.access.dispose();
  const active = fixture();
  await active.access.signIn(input());
  assert.equal(active.state.mode, 'ready');
  assert.equal(active.stored, token);
  assert.equal(active.checks, 1);
  active.access.hide();
  assert.equal(active.state.session, null);
  await active.access.check();
  assert.equal(active.state.mode, 'ready');
  assert.equal(active.checks, 2);
  active.access.dispose();
  let restart;
  const restarted = new MobileAccess(active.storage, active.transport, (s) => {
    restart = s;
  });
  await restarted.check();
  assert.equal(restart.mode, 'ready');
  assert.equal(active.checks, 3);
  restarted.dispose();
  await active.access.logout();
  assert.equal(active.stored, null);
  assert.equal(active.state.mode, 'reauth');
  for (const outcome of ['failed', 'uncertain']) {
    const failed = fixture();
    failed.save(outcome);
    await failed.access.signIn(input());
    assert.equal(failed.state.session, null);
    assert.equal(failed.logouts, 1);
    assert.equal(failed.stored, null);
    failed.access.dispose();
  }
  const uncertainRevoke = fixture();
  uncertainRevoke.save('uncertain');
  uncertainRevoke.revokeFail(true);
  await uncertainRevoke.access.signIn(input());
  assert.equal(uncertainRevoke.state.mode, 'cleanup');
  assert.equal(uncertainRevoke.state.session, null);
  uncertainRevoke.revokeFail(false);
  await new Promise((r) => setTimeout(r, 1050));
  await uncertainRevoke.access.check();
  assert.equal(uncertainRevoke.stored, null);
  assert.equal(uncertainRevoke.state.mode, 'reauth');
  uncertainRevoke.access.dispose();
  const deleteFailure = fixture();
  await deleteFailure.access.signIn(input());
  deleteFailure.clear('uncertain');
  await deleteFailure.access.logout();
  assert.equal(deleteFailure.state.mode, 'cleanup');
  assert.equal(deleteFailure.state.session, null);
  assert.equal(deleteFailure.stored, token);
  deleteFailure.clear('cleared');
  // Explicit retry honours one-second unavailable bound.
  await new Promise((r) => setTimeout(r, 1050));
  await deleteFailure.access.check();
  assert.equal(deleteFailure.stored, null);
  assert.equal(deleteFailure.state.mode, 'reauth');
  assert.equal(deleteFailure.logouts, 1);
  deleteFailure.access.dispose();
  const locked = fixture();
  locked.read({ kind: 'unavailable' });
  await locked.access.check();
  assert.equal(locked.state.session, null);
  assert.equal(locked.saves, 0);
  locked.access.dispose();
  const stale = fixture();
  await stale.access.signIn(input());
  stale.sessionFail(true);
  await stale.access.check();
  assert.equal(stale.state.session, null);
  assert.equal(stale.state.mode, 'reauth');
  stale.access.dispose();
  // App hides during issuance. Late token is explicitly orphan-revoked, never shown.
  const delayed = fixture();
  let release;
  delayed.transport.signIn = () =>
    new Promise((r) => {
      release = () => r({ ...owner, token });
    });
  const flight = delayed.access.signIn(input());
  while (!release) await new Promise((r) => setTimeout(r, 0));
  delayed.access.hide();
  release();
  await flight;
  assert.equal(delayed.state.session, null);
  assert.equal(delayed.saves, 0);
  assert.equal(delayed.logouts, 1);
  delayed.access.dispose();
  // Replacement revokes previous device token before storing a new one.
  const replacement = fixture();
  await replacement.access.signIn(input());
  await replacement.access.signIn(input());
  assert.equal(replacement.logouts, 1);
  assert.equal(replacement.state.mode, 'ready');
  replacement.access.dispose();
  // No transport is attempted under missing/HTTP/malformed origin config.
  for (const origin of [
    undefined,
    'http://localhost',
    'https://host.invalid/path',
    'https://user:secret@host.invalid',
  ]) {
    await assert.rejects(
      mobileTransport(origin).session(token),
      MobileAccessError,
    );
  }
  // Use the installed native abort polyfill, not Node's richer AbortSignal API.
  const projectRequire = createRequire(import.meta.url);
  const nativeRequire = createRequire(
    projectRequire.resolve('react-native/package.json', {
      paths: ['apps/responder-mobile'],
    }),
  );
  const nativeAbort = nativeRequire('abort-controller/dist/abort-controller');
  const { Request: NativeRequest } = nativeRequire('whatwg-fetch');
  // Actual native fetch cache handling rewrites GET URLs, which the ingress denies.
  const sessionUrl = 'https://localhost:3444/staff/auth/mobile/session';
  assert.notEqual(
    new NativeRequest(sessionUrl, { cache: 'no-store' }).url,
    sessionUrl,
  );
  const savedGlobals = {
    AbortController: globalThis.AbortController,
    AbortSignal: globalThis.AbortSignal,
    fetch: globalThis.fetch,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  };
  try {
    globalThis.AbortController = nativeAbort.AbortController;
    globalThis.AbortSignal = nativeAbort.AbortSignal;
    assert.equal(typeof AbortSignal.timeout, 'undefined');
    let timeoutCallback,
      cleared = 0,
      requests = 0;
    globalThis.setTimeout = (callback, milliseconds) => {
      assert.equal(milliseconds, 7000);
      timeoutCallback = callback;
      return 1;
    };
    globalThis.clearTimeout = () => cleared++;
    globalThis.fetch = async (url, options) => {
      requests++;
      assert.ok(options.signal instanceof nativeAbort.AbortSignal);
      assert.equal(options.credentials, 'omit');
      const nativeRequest = new NativeRequest(url, options);
      assert.equal(nativeRequest.url, url);
      assert.equal(nativeRequest.headers.get('cache-control'), 'no-store');
      const body = url.endsWith('/logout')
        ? { signedOut: true }
        : url.endsWith('/sign-in')
          ? { ...owner, token }
          : owner;
      return { ok: true, text: async () => JSON.stringify(body) };
    };
    const nativeTransport = mobileTransport('https://localhost:3444');
    assert.equal((await nativeTransport.signIn(input())).token, token);
    assert.deepEqual(await nativeTransport.session(token), owner);
    await nativeTransport.logout(token);
    assert.equal(requests, 3);
    assert.equal(cleared, 3);
    globalThis.fetch = (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () =>
          reject(new Error('Aborted')),
        );
      });
    const timedOut = nativeTransport.session(token);
    timeoutCallback();
    await assert.rejects(
      timedOut,
      (error) => error instanceof MobileAccessError && error.status === 503,
    );
    assert.equal(cleared, 4);
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      headers: { get: () => null },
    });
    await assert.rejects(
      nativeTransport.session(token),
      (error) => error instanceof MobileAccessError && error.status === 401,
    );
    assert.equal(cleared, 5);
  } finally {
    Object.assign(globalThis, savedGlobals);
  }
  // Execute adapter itself with an injected OS port. This proves marker/failure sequencing only.
  const values = new Map();
  let failSet = false,
    failDelete = false;
  globalThis.__nativeStorageFixture = {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
    async isAvailableAsync() {
      return true;
    },
    async getItemAsync(k, opts) {
      assert.equal(opts.requireAuthentication, true);
      assert.equal(opts.keychainAccessible, 6);
      return values.get(k) ?? null;
    },
    async setItemAsync(k, v) {
      if (failSet) throw new Error('locked fixture');
      values.set(k, v);
    },
    async deleteItemAsync(k) {
      if (failDelete) throw new Error('failure fixture');
      values.delete(k);
    },
  };
  const { staffSecureStorage } = await import(
    pathToFileURL(join(directory, 'secure-storage.mjs'))
  );
  assert.equal(await staffSecureStorage.save(token), 'stored');
  assert.deepEqual(await staffSecureStorage.read(), { kind: 'found', token });
  failDelete = true;
  assert.equal(await staffSecureStorage.clear(), 'uncertain');
  assert.deepEqual(await staffSecureStorage.read(), { kind: 'unavailable' });
  assert.deepEqual(await staffSecureStorage.readForRevocation(), {
    kind: 'found',
    token,
  });
  failDelete = false;
  assert.equal(await staffSecureStorage.clear(), 'cleared');
  assert.deepEqual(await staffSecureStorage.read(), { kind: 'absent' });
  failSet = true;
  assert.equal(await staffSecureStorage.save(token), 'uncertain');
  assert.deepEqual(await staffSecureStorage.read(), { kind: 'absent' });
  failSet = false;
  // Check the separate device harness around the same adapter. These injected
  // port checks prove placement of faults, not Android protected storage.
  const harnessSource = readFileSync(
    'scripts/native-acceptance/acceptance-store.ts',
    'utf8',
  ).replace(
    "import * as RealSecureStore from 'expo-secure-store';",
    'const RealSecureStore = globalThis.__nativeStorageFixture;',
  );
  writeFileSync(
    join(directory, 'acceptance-store.mjs'),
    ts.transpileModule(harnessSource, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    }).outputText,
  );
  writeFileSync(
    join(directory, 'acceptance-storage.mjs'),
    readFileSync(join(directory, 'secure-storage.mjs'), 'utf8').replace(
      'const SecureStore = globalThis.__nativeStorageFixture;',
      "import { SecureStore } from './acceptance-store.mjs';",
    ),
  );
  const harness = await import(
    pathToFileURL(join(directory, 'acceptance-store.mjs'))
  );
  const { staffSecureStorage: harnessStorage } = await import(
    pathToFileURL(join(directory, 'acceptance-storage.mjs'))
  );
  const marker = 'myims.responder.staff.v1.pending';
  const tokenKey = 'myims.responder.staff.v1.token';
  const traces = [];
  const stopObserving = harness.observeFault((message) => traces.push(message));
  harness.armFault('write');
  assert.equal(await harnessStorage.save(token), 'uncertain');
  assert.equal(values.get(marker), 'pending');
  assert.equal(values.has(tokenKey), false);
  assert.deepEqual(await harnessStorage.read(), { kind: 'unavailable' });
  assert.equal(await harnessStorage.clear(), 'cleared');
  assert.equal(await harnessStorage.save(token), 'stored');
  harness.armFault('delete');
  assert.equal(await harnessStorage.clear(), 'uncertain');
  assert.equal(values.get(marker), 'pending');
  assert.equal(values.get(tokenKey), token);
  assert.deepEqual(await harnessStorage.read(), { kind: 'unavailable' });
  assert.equal(await harnessStorage.clear(), 'cleared');
  harness.armFault('interrupt');
  await harness.SecureStore.setItemAsync(marker, 'pending');
  const paused = harness.SecureStore.setItemAsync(tokenKey, token);
  assert.equal(
    await Promise.race([
      paused.then(() => 'settled'),
      new Promise((resolve) => setTimeout(() => resolve('paused'), 10)),
    ]),
    'paused',
  );
  assert.equal(values.has(tokenKey), false);
  assert.deepEqual(await harnessStorage.read(), { kind: 'unavailable' });
  assert.equal(await harnessStorage.clear(), 'cleared');
  assert.ok(
    traces.some((message) => message.includes('read token: completed')),
  );
  assert.ok(
    traces.some((message) =>
      message.includes('write pending marker: completed'),
    ),
  );
  assert.ok(traces.every((message) => !message.includes(token)));
  stopObserving();
  console.log(
    'PASS isolated native fault harness write/delete/pause placement (port evidence only).',
  );
  delete globalThis.__nativeStorageFixture;
  console.log(
    'PASS mobile JavaScript port: canonical restart checks, storage failures/quarantine, orphan revoke, replacement, reset denial, stale callback fencing and confirmed logout/deletion retry. OS/device/TLS evidence still required.',
  );
} catch {
  throw new Error(
    'Native JavaScript port check failed; credential artifacts omitted.',
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
