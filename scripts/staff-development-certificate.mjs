// Separate localhost/IP leaf, signed by the existing trusted development CA.
import { spawnSync } from 'node:child_process';
import { randomBytes, X509Certificate, createPrivateKey } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { materialDirectory } from './platform-https-material.mjs';
export function staffCertificate(directory, platform) {
  const target = `${directory}/tls`;
  const privateFile = (file) => {
    const s = lstatSync(file);
    if (
      !s.isFile() ||
      s.isSymbolicLink() ||
      s.uid !== process.getuid() ||
      (s.mode & 0o077) !== 0
    )
      throw new Error('Private leaf material required');
  };
  if (!existsSync(target)) {
    const temporary = mkdtempSync(`${directory}/tls-creating-`);
    const run = (args) => {
      if (
        spawnSync('openssl', args, {
          cwd: temporary,
          stdio: 'ignore',
          timeout: 30000,
        }).status !== 0
      )
        throw new Error('Leaf creation failed');
    };
    try {
      run([
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
        'subjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n',
        { mode: 0o600, flag: 'wx' },
      );
      run([
        'x509',
        '-req',
        '-in',
        'server.csr',
        '-CA',
        `${materialDirectory}/ca.crt`,
        '-CAkey',
        `${materialDirectory}/ca.key`,
        '-set_serial',
        `0x${randomBytes(16).toString('hex')}`,
        '-out',
        'server.crt',
        '-days',
        '365',
        '-sha256',
        '-extfile',
        'server.ext',
      ]);
      for (const name of ['server.csr', 'server.ext'])
        rmSync(`${temporary}/${name}`);
      renameSync(temporary, target);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  }
  const s = lstatSync(target);
  if (
    !s.isDirectory() ||
    s.isSymbolicLink() ||
    s.uid !== process.getuid() ||
    (s.mode & 0o077) !== 0
  )
    throw new Error('Private TLS directory required');
  for (const name of ['server.key', 'server.crt'])
    privateFile(`${target}/${name}`);
  const key = readFileSync(`${target}/server.key`),
    cert = readFileSync(`${target}/server.crt`),
    leaf = new X509Certificate(cert);
  if (
    !leaf.verify(new X509Certificate(platform.ca).publicKey) ||
    !leaf.checkHost('localhost') ||
    !leaf.checkIP('127.0.0.1') ||
    !leaf.checkPrivateKey(createPrivateKey(key)) ||
    Date.parse(leaf.validTo) <= Date.now() ||
    Date.parse(leaf.validFrom) > Date.now()
  )
    throw new Error('Invalid development leaf');
  return { key, cert };
}
