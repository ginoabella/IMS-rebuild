// Trusted acceptance only. No runtime imports, socket access or management grants.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
const target = 'myims-rebuild-dev-asterisk-1';
const include = '/tmp/myims-pbx-fixture.conf';
const lock = '/tmp/myims-pbx-acceptance.lock';
const hash = (v) => createHash('sha256').update(v).digest('hex');
function docker(args, input) {
  const r = spawnSync('docker', args, {
    input,
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.equal(
    r.status,
    0,
    'Controlled PBX operation failed; retain recovery manifest',
  );
  return r.stdout;
}
const exec = (...args) => docker(['exec', target, ...args]);
const cli = (command) => exec('asterisk', '-rx', command);
function waitReady() {
  for (let i = 0; i < 100; i++) {
    const result = spawnSync(
      'docker',
      ['exec', target, 'asterisk', '-rx', 'core show uptime'],
      { encoding: 'utf8', timeout: 3000 },
    );
    if (result.status === 0 && result.stdout.includes('System uptime:')) return;
    spawnSync('sleep', ['0.2']);
  }
  throw new Error(
    'Controlled Asterisk restoration deadline; retain recovery information',
  );
}
function objects() {
  const result = {};
  for (const type of ['endpoints', 'auths', 'aors']) {
    const value = cli(`pjsip show ${type}`);
    assert.ok(
      value.includes('No objects found.') || value.includes('Objects found:'),
      'Unsupported CLI inventory response',
    );
    const label =
      type === 'endpoints' ? 'Endpoint' : type === 'auths' ? 'I/OAuth' : 'Aor';
    result[type] = [
      ...value.matchAll(new RegExp(`^\\s*${label}:\\s+([^\\s/]+)`, 'gm')),
    ]
      .map((m) => m[1])
      .filter((v) => !v.startsWith('<'))
      .sort();
  }
  return result;
}
function exactObjectExists(type, key) {
  assert.ok(['endpoints', 'auths', 'aors'].includes(type));
  assert.match(key, /^[a-zA-Z0-9-]{1,128}$/);
  const response = cli(`pjsip show ${type} like ^${key}$`);
  if (response.includes('No objects found.')) return false;
  assert.match(
    response,
    /Objects found: 1\b/,
    'Exact-object filter must return one bounded identity',
  );
  return true;
}
function noCalls() {
  assert.match(
    cli('core show channels count'),
    /^0 active channels\n0 active calls\n/,
    'Target must have no operational calls',
  );
}
function baseline() {
  return {
    objects: objects(),
    configuration: hash(
      exec(
        'sh',
        '-c',
        "find /etc/asterisk -type f -name '*.conf' -exec sha256sum {} + | sort",
      ),
    ),
    routing: hash(cli('dialplan show')),
    version: cli('core show version').trim(),
  };
}
export function ensureNoGeneratedCollision(objects, installationId) {
  const installation = installationId.replaceAll('-', '').toLowerCase();
  for (const names of Object.values(objects)) {
    assert.ok(
      !names.some((v) =>
        ['e', 'a', 'r'].some((kind) =>
          v.startsWith(`ims-${kind}-${installation}-`),
        ),
      ),
      'Unexplained generated namespace collision',
    );
  }
}
export function ensureKeysAbsent(objects, keys) {
  const existing = Object.values(objects).flat();
  for (const key of keys)
    assert.ok(!existing.includes(key), 'Fixture identity collision');
}
export function inventoryPbxAcceptance(access) {
  const runId = randomUUID();
  const directory = `.local/p3-u2c-runs/${runId}`;
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const manifest = {
    runId,
    target,
    installationId: access.catalog[0].installationId,
    include,
    lock,
    state: 'preflight',
    owned: [],
    baseline: null,
  };
  const persist = () =>
    writeFileSync(
      `${directory}/recovery.json`,
      JSON.stringify(manifest, null, 2),
      { mode: 0o600 },
    );
  persist();
  const running = JSON.parse(
    docker(['inspect', target, '--format', '{{json .State.Running}}']),
  );
  assert.equal(
    running,
    true,
    'Acceptance requires the approved target initially running',
  );
  assert.ok(
    !docker(['ps', '--format', '{{.Names}}'])
      .split('\n')
      .some((n) => /^myims-session-check-/.test(n)),
    'Conflicting acceptance container',
  );
  exec('sh', '-c', `test ! -e ${include} && mkdir ${lock}`);
  docker(
    [
      'exec',
      '-i',
      target,
      'sh',
      '-c',
      `cat > ${lock}/owner && chmod 600 ${lock}/owner`,
    ],
    runId,
  );
  let expectedContent = null,
    stopped = false,
    closed = false;
  function owned() {
    assert.equal(
      exec('cat', `${lock}/owner`),
      runId,
      'Exclusive lock ownership lost',
    );
  }
  function ownedStopped() {
    const result = spawnSync('docker', ['cp', `${target}:${lock}/owner`, '-'], {
      timeout: 5000,
      maxBuffer: 16384,
    });
    assert.equal(result.status, 0, 'Stopped-container ownership read failed');
    const tar = result.stdout;
    let found = false;
    for (let offset = 0; offset + 512 <= tar.length;) {
      const name = tar
        .subarray(offset, offset + 100)
        .toString()
        .replace(/\0.*$/s, '');
      if (!name) break;
      const length = parseInt(
        tar
          .subarray(offset + 124, offset + 136)
          .toString()
          .replace(/\0.*$/s, '')
          .trim(),
        8,
      );
      assert.ok(
        Number.isSafeInteger(length) && length >= 0 && length <= 8192,
        'Invalid bounded lock archive',
      );
      if (name === 'owner') {
        assert.equal(
          tar.subarray(offset + 512, offset + 512 + length).toString(),
          runId,
          'Stopped-container lock ownership lost',
        );
        found = true;
      }
      offset += 512 + Math.ceil(length / 512) * 512;
    }
    assert.ok(found, 'Missing stopped-container lock owner');
  }
  function verifyInclude() {
    owned();
    if (expectedContent === null) exec('sh', '-c', `test ! -e ${include}`);
    else
      assert.equal(
        exec('sha256sum', include).split(' ')[0],
        hash(expectedContent),
        'Fixture include changed outside acceptance',
      );
  }
  function reload(content) {
    owned();
    noCalls();
    verifyInclude();
    manifest.nextFixtureDigest = hash(content);
    persist();
    docker(
      [
        'exec',
        '-i',
        '--user',
        'asterisk',
        target,
        'sh',
        '-c',
        `umask 077; cat > ${include}`,
      ],
      content,
    );
    expectedContent = content;
    manifest.fixtureDigest = hash(content);
    delete manifest.nextFixtureDigest;
    persist();
    const result = cli('module reload res_pjsip.so');
    assert.ok(!/No such|Unable|Error/i.test(result), 'Fixture reload failed');
  }
  try {
    ownedStopped();
    noCalls();
    assert.match(
      cli('dialplan show myims-observation-no-calls'),
      /There is no existence of|does not exist/,
      'Fixture no-call context must have no dialplan',
    );
    manifest.baseline = baseline();
    ensureNoGeneratedCollision(
      manifest.baseline.objects,
      manifest.installationId,
    );
    for (const [type, kind] of [
      ['endpoints', 'e'],
      ['auths', 'a'],
      ['aors', 'r'],
    ]) {
      assert.ok(
        cli(
          `pjsip show ${type} like ^ims-${kind}-${manifest.installationId.replaceAll('-', '')}-`,
        ).includes('No objects found.'),
        'Unexplained generated namespace collision',
      );
    }
    manifest.state = 'baseline_verified';
    persist();
  } catch (e) {
    manifest.state = 'preflight_failed';
    persist();
    exec('rm', '-f', `${lock}/owner`);
    exec('rmdir', lock);
    throw e;
  }
  console.log(
    JSON.stringify({
      check: 'p3-u2c-baseline',
      runId,
      installationId: manifest.installationId,
      runtime: manifest.baseline.version,
      objects: manifest.baseline.objects,
      configuration: manifest.baseline.configuration,
      routing: manifest.baseline.routing,
      noCalls: true,
      exclusive: true,
      recoveryManifest: `${directory}/recovery.json`,
    }),
  );
  return {
    baselineEndpoints() {
      return [...manifest.baseline.objects.endpoints];
    },
    recordFailure(operation) {
      manifest.failures ??= [];
      manifest.failures.push({
        operation: /^[A-Z_]{1,60}$/.test(operation)
          ? operation
          : 'unknown_control',
        state: manifest.state,
        at: new Date().toISOString(),
      });
      persist();
    },
    writeLegacy(content, name) {
      assert.match(name, /^myims-observation-[a-f0-9]{8}$/);
      if (!manifest.owned.length) {
        ensureKeysAbsent(manifest.baseline.objects, [name]);
        ensureKeysAbsent(objects(), [name]);
        manifest.owned = [{ endpoint: name, auth: name, aor: name }];
        manifest.state = 'fixtures_installing';
        persist();
      }
      assert.equal(manifest.owned[0].endpoint, name);
      reload(content);
      manifest.state = content ? 'fixtures_installed' : 'fixtures_removed';
      persist();
    },
    install(rows) {
      assert.equal(manifest.state, 'baseline_verified');
      owned();
      noCalls();
      const current = objects();
      assert.deepEqual(
        current,
        manifest.baseline.objects,
        'PBX objects changed before fixture setup',
      );
      assert.ok(Array.isArray(rows) && rows.length === 2);
      const installation = manifest.installationId.replaceAll('-', '');
      for (const row of rows)
        assert.match(
          row.id,
          /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
        );
      manifest.owned = rows.map((r) => ({
        extensionId: r.id,
        endpoint: `ims-e-${installation}-${r.id.replaceAll('-', '')}`,
        auth: `ims-a-${installation}-${r.id.replaceAll('-', '')}`,
        aor: `ims-r-${installation}-${r.id.replaceAll('-', '')}`,
      }));
      const unmanaged = '6102';
      assert.ok(
        !Object.values(current).flat().includes(unmanaged),
        'Unmanaged fixture identity collision',
      );
      manifest.unmanaged = unmanaged;
      for (const row of manifest.owned)
        for (const key of [row.endpoint, row.auth, row.aor])
          assert.ok(
            !Object.values(current).flat().includes(key),
            'Fixture identity collision',
          );
      assert.equal(
        hash(cli('dialplan show')),
        manifest.baseline.routing,
        'Routing changed before fixture install',
      );
      for (const row of manifest.owned) {
        assert.equal(exactObjectExists('endpoints', row.endpoint), false);
        assert.equal(exactObjectExists('auths', row.auth), false);
        assert.equal(exactObjectExists('aors', row.aor), false);
      }
      manifest.fixtureSettings = {
        maxContacts: 1,
        removeExisting: false,
        codec: 'ulaw',
        context: 'myims-observation-no-calls',
      };
      manifest.state = 'installing';
      persist();
      console.log(
        JSON.stringify({
          check: 'p3-u2c-save-boundary',
          runId,
          keysAbsentBeforeFixture: true,
          routesUnchanged:
            hash(cli('dialplan show')) === manifest.baseline.routing,
          owned: manifest.owned,
        }),
      );
      let content = manifest.owned
        .map(
          (r, index) =>
            `[${r.endpoint}]\ntype=endpoint\ncontext=myims-observation-no-calls\nauth=${r.auth}\naors=${r.aor}\ndisallow=all\nallow=ulaw\n[${r.auth}]\ntype=auth\nauth_type=userpass\nusername=${r.endpoint}\npassword=${index === 0 ? access.fixturePassword : randomBytes(32).toString('hex')}\n[${r.aor}]\ntype=aor\nmax_contacts=1\nremove_existing=no\n`,
        )
        .join('');
      content += `[${unmanaged}]\ntype=endpoint\ncontext=myims-observation-no-calls\ndisallow=all\nallow=ulaw\n`;
      reload(content);
      manifest.state = 'fixtures_installed';
      persist();
      for (const row of manifest.owned) {
        assert.ok(exactObjectExists('endpoints', row.endpoint));
        assert.ok(exactObjectExists('auths', row.auth));
        assert.ok(exactObjectExists('aors', row.aor));
      }
    },
    stop() {
      owned();
      noCalls();
      verifyInclude();
      manifest.state = 'stopping';
      persist();
      docker(['stop', '--time', '10', target]);
      stopped = true;
      manifest.state = 'stopped';
      persist();
    },
    start() {
      assert.ok(stopped);
      ownedStopped();
      docker(['start', target]);
      waitReady();
      owned();
      verifyInclude();
      stopped = false;
      manifest.state = 'fixtures_installed';
      persist();
    },
    close() {
      if (closed) return;
      try {
        if (stopped) {
          docker(['start', target]);
          waitReady();
          stopped = false;
        }
        owned();
        if (expectedContent !== null) {
          reload('');
          exec('rm', include);
          expectedContent = null;
        }
        noCalls();
        for (const row of manifest.owned) {
          assert.equal(exactObjectExists('endpoints', row.endpoint), false);
          assert.equal(exactObjectExists('auths', row.auth), false);
          assert.equal(exactObjectExists('aors', row.aor), false);
        }
        const restored = baseline();
        assert.deepEqual(
          restored,
          manifest.baseline,
          'PBX baseline restoration failed',
        );
        assert.equal(
          docker(['inspect', target, '--format', '{{.State.Running}}']).trim(),
          'true',
        );
        manifest.state = 'restored_verified';
        persist();
        exec('rm', `${lock}/owner`);
        exec('rmdir', lock);
        closed = true;
        console.log(
          JSON.stringify({
            check: 'p3-u2c-pbx-cleanup',
            runId,
            fixturesAbsent: true,
            baselineRestored: true,
            originalRunningStateRestored: true,
            lockReleased: true,
          }),
        );
      } catch (e) {
        manifest.state = 'recovery_required';
        persist();
        throw e;
      }
    },
  };
}
