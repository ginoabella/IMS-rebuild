// Real filesystem custody checks, mounted only in an isolated rehearsal container.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  linkSync,
  unlinkSync,
  symlinkSync,
  rmSync,
} from 'node:fs';
const load = createRequire('/workspace/services/backend/package.json');
const { ProtectedStaticProfiles, staticDigest } = load(
  './dist/modules/telephony/adapters/live/static-profiles.js',
);
process.umask(0o077);
const root = '/var/lib/myims-pbx/control/' + randomUUID();
mkdirSync(root, { mode: 0o700 });
const group = Number(
  readFileSync('/etc/group', 'utf8')
    .split('\n')
    .find((l) => l.startsWith('asterisk:'))
    ?.split(':')[2],
);
let digest;
try {
  const store = new ProtectedStaticProfiles(root, group),
    files = store.readDirectory('/etc/asterisk');
  digest = store.stage(files);
  assert.equal(staticDigest(store.load(digest)), digest);
  assert.equal(store.stage(files), digest);
  store.project(digest);
  store.verifyProjection(digest);
  assert.throws(() => new ProtectedStaticProfiles(root + '/../escape', group));
  const escape = new Map(files);
  escape.set('../escape', Buffer.from('fixture'));
  assert.throws(() => store.stage(escape));
  const oversized = new Map(files);
  oversized.set('modules.conf', Buffer.alloc(1048577));
  assert.throws(() => store.stage(oversized));
  const path = root + '/static-profiles/' + digest + '/modules.conf',
    original = readFileSync(path);
  chmodSync(path, 0o644);
  assert.throws(() => store.load(digest));
  assert.throws(() => store.stage(files));
  chmodSync(path, 0o600);
  writeFileSync(path, Buffer.from('tampered'));
  assert.throws(() => store.load(digest));
  writeFileSync(path, original);
  linkSync(path, root + '/second-link');
  assert.throws(() => store.load(digest));
  unlinkSync(root + '/second-link');
  unlinkSync(path);
  symlinkSync(root + '/missing', path);
  assert.throws(() => store.load(digest));
  unlinkSync(path);
  writeFileSync(path, original, { mode: 0o600 });
  const projected =
    '/var/lib/myims-pbx/profiles/' + digest + '/conf/modules.conf';
  chmodSync(projected, 0o666);
  assert.throws(() => store.verifyProjection(digest));
  chmodSync(projected, 0o640);
  store.verifyProjection(digest);
  console.log(
    JSON.stringify({
      check: 'protected-static-profile-custody',
      passed: true,
      retryExact: true,
      tamperPermissionsLinksBoundsAndTraversalRejected: true,
    }),
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
