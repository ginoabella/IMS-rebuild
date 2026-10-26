// Trusted one-shot volume initialization; no provider network or application code.
import {
  lstatSync,
  existsSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  chownSync,
} from 'node:fs';
const [uidInput, gidInput, installation] = process.argv.slice(2),
  uid = Number(uidInput),
  gid = Number(gidInput);
if (
  process.getuid() !== 0 ||
  !Number.isSafeInteger(uid) ||
  uid < 1 ||
  !Number.isSafeInteger(gid) ||
  gid < 1 ||
  !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(installation ?? '')
)
  throw new Error('Invalid protected consumer identity');
const root = lstatSync('/consumer');
if (!root.isDirectory() || root.isSymbolicLink())
  throw new Error('Protected consumer volume unavailable');
for (const name of [
  `live-${installation}.token`,
  `live-${installation}.token.new`,
  `live-issuer-policy-before-${installation}.json`,
]) {
  const source = '/legacy/' + name,
    target = '/consumer/' + name;
  if (!existsSync(source) || existsSync(target)) continue;
  const stat = lstatSync(source);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.nlink !== 1 ||
    stat.uid !== 0 ||
    stat.mode & 0o077 ||
    stat.size > 16384
  )
    throw new Error('Legacy live custody unavailable');
  writeFileSync(target, readFileSync(source), { mode: 0o600, flag: 'wx' });
  chownSync(target, uid, gid);
}
writeFileSync('/consumer/ca.crt', readFileSync('/public-ca'), { mode: 0o600 });
chmodSync('/consumer/ca.crt', 0o600);
chownSync('/consumer/ca.crt', uid, gid);
chmodSync('/consumer', 0o700);
chownSync('/consumer', uid, gid);
console.log(
  JSON.stringify({
    state: 'private_consumer_volume_initialized',
    credentialOutput: false,
  }),
);
