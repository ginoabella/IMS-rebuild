import { randomBytes, X509Certificate, createPrivateKey } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

export const materialDirectory = resolve('.local/platform-https');
export const publicCertificate = resolve('.local/platform-https-ca.crt');
export const browserOrigin = 'https://localhost:3443';
const files = ['ca.key', 'ca.crt', 'server.key', 'server.crt', 'auth.json'];

function openssl(directory, args) {
  const result = spawnSync('openssl', args, {
    cwd: directory,
    stdio: 'ignore',
    timeout: 30000,
  });
  if (result.status !== 0)
    throw new Error('Development certificate creation failed');
}

export function readMaterial() {
  const directory = lstatSync(materialDirectory);
  if (
    !directory.isDirectory() ||
    directory.isSymbolicLink() ||
    directory.uid !== process.getuid() ||
    (directory.mode & 0o077) !== 0
  )
    throw new Error(
      'Platform HTTPS directory must be owned by you with mode 700',
    );
  for (const name of files) {
    const entry = lstatSync(`${materialDirectory}/${name}`);
    if (
      !entry.isFile() ||
      entry.isSymbolicLink() ||
      entry.uid !== process.getuid() ||
      (entry.mode & 0o077) !== 0
    )
      throw new Error(
        'Platform HTTPS files must be private regular owner-owned files',
      );
  }
  const ca = readFileSync(`${materialDirectory}/ca.crt`);
  const cert = readFileSync(`${materialDirectory}/server.crt`);
  const key = readFileSync(`${materialDirectory}/server.key`);
  const authority = new X509Certificate(ca),
    leaf = new X509Certificate(cert);
  if (
    !authority.ca ||
    !leaf.verify(authority.publicKey) ||
    !leaf.checkHost('localhost') ||
    !leaf.checkPrivateKey(createPrivateKey(key)) ||
    !authority.checkPrivateKey(
      createPrivateKey(readFileSync(`${materialDirectory}/ca.key`)),
    ) ||
    [authority, leaf].some(
      (entry) =>
        Date.parse(entry.validTo) <= Date.now() ||
        Date.parse(entry.validFrom) > Date.now(),
    )
  )
    throw new Error(
      'Development certificate invalid or expired; follow certificate renewal runbook',
    );
  const secrets = JSON.parse(
    readFileSync(`${materialDirectory}/auth.json`, 'utf8'),
  );
  const values = ['proxy', 'csrf', 'ingress'].map((name) => secrets[name]);
  if (
    values.some(
      (value) => typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value),
    ) ||
    new Set(values).size !== 3
  )
    throw new Error('Invalid private platform authentication secrets');
  return { ca, cert, key, secrets, fingerprint: authority.fingerprint256 };
}

export function prepareMaterial() {
  process.umask(0o077);
  mkdirSync(resolve('.local'), { recursive: true });
  if (!existsSync(materialDirectory)) {
    const temporary = mkdtempSync(resolve('.local/platform-https-creating-'));
    try {
      openssl(temporary, [
        'req',
        '-x509',
        '-newkey',
        'rsa:3072',
        '-nodes',
        '-keyout',
        'ca.key',
        '-out',
        'ca.crt',
        '-days',
        '3650',
        '-sha256',
        '-subj',
        '/CN=MyIMS Private Development CA',
        '-addext',
        'basicConstraints=critical,CA:TRUE,pathlen:0',
        '-addext',
        'keyUsage=critical,keyCertSign,cRLSign',
      ]);
      openssl(temporary, [
        'req',
        '-new',
        '-newkey',
        'rsa:3072',
        '-nodes',
        '-keyout',
        'server.key',
        '-out',
        'server.csr',
        '-subj',
        '/CN=localhost',
      ]);
      writeFileSync(
        `${temporary}/server.ext`,
        'subjectAltName=DNS:localhost\nbasicConstraints=critical,CA:FALSE\n' +
          'keyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n',
        { mode: 0o600, flag: 'wx' },
      );
      openssl(temporary, [
        'x509',
        '-req',
        '-in',
        'server.csr',
        '-CA',
        'ca.crt',
        '-CAkey',
        'ca.key',
        '-CAcreateserial',
        '-out',
        'server.crt',
        '-days',
        '365',
        '-sha256',
        '-extfile',
        'server.ext',
      ]);
      writeFileSync(
        `${temporary}/auth.json`,
        JSON.stringify({
          proxy: randomBytes(32).toString('hex'),
          csrf: randomBytes(32).toString('hex'),
          ingress: randomBytes(32).toString('hex'),
        }),
        { mode: 0o600, flag: 'wx' },
      );
      for (const name of files) chmodSync(`${temporary}/${name}`, 0o600);
      for (const name of ['server.csr', 'server.ext', 'ca.srl'])
        rmSync(`${temporary}/${name}`, { force: true });
      renameSync(temporary, materialDirectory);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  }
  const material = readMaterial();
  // Public certificate only: safe to transfer to the browser workstation.
  if (
    existsSync(publicCertificate) &&
    lstatSync(publicCertificate).isSymbolicLink()
  )
    throw new Error('Public certificate export must not be a symbolic link');
  const exportTemporary = `${publicCertificate}.${randomBytes(8).toString('hex')}.tmp`;
  try {
    writeFileSync(exportTemporary, material.ca, { mode: 0o600, flag: 'wx' });
    renameSync(exportTemporary, publicCertificate);
  } finally {
    rmSync(exportTemporary, { force: true });
  }
  return material;
}
