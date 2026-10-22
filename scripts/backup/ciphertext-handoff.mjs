// Explicit ciphertext-only custody transfer; no provider, seal or credential access.
import {
  constants as C,
  openSync,
  closeSync,
  fstatSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  fsyncSync,
  fchownSync,
  lstatSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const digest = (v) => createHash('sha256').update(v).digest('hex');
export function handoffCiphertext(
  source,
  target,
  operation,
  owners = { source: 1003, target: 12010 },
) {
  if (!uuid.test(operation)) throw new Error('Handoff operation refused');
  const fds = [];
  try {
    for (const [p, uid] of [
      [source, owners.source],
      [target, owners.target],
    ]) {
      const fd = openSync(p, C.O_RDONLY | C.O_DIRECTORY | C.O_NOFOLLOW);
      fds.push(fd);
      const s = fstatSync(fd);
      if (
        !s.isDirectory() ||
        s.uid !== uid ||
        s.gid !== uid ||
        (s.mode & 0o777) !== 0o700
      )
        throw new Error('Handoff custody refused');
    }
    const [from, to] = fds;
    const names = readdirSync(`/proc/self/fd/${from}`).sort();
    if (
      names.length !== 2 ||
      !names[0].endsWith('.age') ||
      !uuid.test(names[0].slice(0, -4)) ||
      names[1] !== names[0].replace('.age', '.json')
    )
      throw new Error('Handoff members refused');
    const read = (name, max) => {
      const fd = openSync(
        `/proc/self/fd/${from}/${name}`,
        C.O_RDONLY | C.O_NOFOLLOW | C.O_NONBLOCK,
      );
      try {
        const s = fstatSync(fd);
        if (
          !s.isFile() ||
          s.nlink !== 1 ||
          s.uid !== owners.source ||
          s.gid !== owners.source ||
          (s.mode & 0o777) !== 0o600 ||
          s.size < 1 ||
          s.size > max
        )
          throw new Error('Handoff file refused');
        const bytes = readFileSync(fd),
          after = fstatSync(fd);
        if (
          bytes.length !== s.size ||
          after.mtimeMs !== s.mtimeMs ||
          after.ctimeMs !== s.ctimeMs
        )
          throw new Error('Handoff source changed');
        return bytes;
      } finally {
        closeSync(fd);
      }
    };
    const receiptBytes = read(names[1], 4096),
      receipt = JSON.parse(receiptBytes);
    const ciphertext = read(names[0], 402653184);
    if (
      receipt.format !== 1 ||
      receipt.operationId !== names[0].slice(0, -4) ||
      receipt.archive !== names[0] ||
      receipt.captureOperationId !== operation ||
      ![
        'recovery-capture',
        'recovery-audit',
        'bootstrap-post-install',
      ].includes(receipt.kind) ||
      receipt.sha256 !== digest(ciphertext) ||
      receipt.bytes !== ciphertext.length ||
      !ciphertext.subarray(0, 22).toString().startsWith('age-encryption.org/v1')
    )
      throw new Error('Handoff receipt mismatch');
    for (const [name, bytes] of [
      [names[0], ciphertext],
      [names[1], receiptBytes],
    ]) {
      const current = lstatSync(target),
        anchor = fstatSync(to);
      if (
        !current.isDirectory() ||
        current.dev !== anchor.dev ||
        current.ino !== anchor.ino
      )
        throw new Error('Handoff target replaced');
      const fd = openSync(
        `/proc/self/fd/${to}/${name}`,
        C.O_WRONLY | C.O_CREAT | C.O_EXCL | C.O_NOFOLLOW,
        0o600,
      );
      try {
        writeFileSync(fd, bytes);
        fchownSync(fd, owners.target, owners.target);
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      fsyncSync(to);
    }
    return {
      operationId: receipt.operationId,
      captureOperationId: operation,
      kind: receipt.kind,
      bytes: receipt.bytes,
      sha256: receipt.sha256,
    };
  } finally {
    for (const fd of fds) closeSync(fd);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    if (process.argv.length !== 5 || process.getuid() !== 0) throw new Error();
    console.log(JSON.stringify(handoffCiphertext(...process.argv.slice(2))));
  } catch {
    console.error(
      JSON.stringify({
        status: 'ciphertext-handoff-refused',
        automaticRetry: false,
      }),
    );
    process.exitCode = 1;
  }
}
