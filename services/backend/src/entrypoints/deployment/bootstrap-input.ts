import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import {
  PasswordInputError,
  validatePassword,
} from '../../infrastructure/password/scrypt';
import { normalizeUsername } from '../../modules/identity/domain/storage';
export interface BootstrapInput {
  username: string;
  password: Buffer;
}
function input(username: unknown, password: Buffer): BootstrapInput {
  const canonical = normalizeUsername(username);
  if (!canonical) throw new PasswordInputError();
  validatePassword(password);
  return { username: canonical, password };
}
async function secretFile(path: string): Promise<BootstrapInput> {
  // O_NOFOLLOW and descriptor checks prevent symlink and replacement races.
  const file = await open(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  const bytes = Buffer.alloc(4097);
  let password: Buffer | undefined;
  try {
    const stat = await file.stat();
    if (
      !stat.isFile() ||
      stat.uid !== process.getuid?.() ||
      (stat.mode & 0o077) !== 0 ||
      stat.size > 4096
    )
      throw new PasswordInputError();
    let used = 0;
    while (used < bytes.length) {
      const { bytesRead } = await file.read(
        bytes,
        used,
        bytes.length - used,
        null,
      );
      if (!bytesRead) break;
      used += bytesRead;
    }
    if (used > 4096) throw new PasswordInputError();
    const parsed: unknown = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, used)),
    );
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new PasswordInputError();
    const data = parsed as Record<string, unknown>;
    if (
      Object.keys(data).length !== 2 ||
      typeof data.username !== 'string' ||
      typeof data.password !== 'string'
    )
      throw new PasswordInputError();
    password = Buffer.from(data.password, 'utf8');
    // JSON allows unpaired surrogates; do not silently replace them with U+FFFD.
    if (password.toString('utf8') !== data.password)
      throw new PasswordInputError();
    const result = input(data.username, password);
    password = undefined;
    return result;
  } finally {
    password?.fill(0);
    bytes.fill(0);
    await file.close();
  }
}
async function hidden(prompt: string, limit: number): Promise<Buffer> {
  const stream = process.stdin;
  if (!stream.isTTY || !process.stderr.isTTY) throw new PasswordInputError();
  const bytes = Buffer.alloc(limit);
  let used = 0;
  const priorRaw = stream.isRaw;
  stream.setRawMode(true);
  process.stderr.write(prompt);
  stream.resume();
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (ok: boolean) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      stream.off('data', onData);
      stream.off('end', onEnd);
      stream.off('error', onEnd);
      process.off('SIGTERM', onEnd);
      process.off('SIGHUP', onEnd);
      stream.setRawMode(priorRaw);
      stream.pause();
      process.stderr.write('\n');
      const result = ok ? Buffer.from(bytes.subarray(0, used)) : undefined;
      bytes.fill(0);
      if (result) resolve(result);
      else reject(new PasswordInputError());
    };
    const onEnd = () => finish(false);
    const onData = (chunk: Buffer) => {
      for (const byte of chunk) {
        if (byte === 3 || byte === 4) {
          finish(false);
          return;
        }
        if (byte === 13 || byte === 10) {
          finish(true);
          return;
        }
        if (byte === 127 || byte === 8) {
          if (used) {
            used--;
            while (used > 0 && ((bytes[used] ?? 0) & 0xc0) === 0x80) used--;
            bytes.fill(0, used);
          }
        } else if (used >= limit) {
          finish(false);
          return;
        } else bytes[used++] = byte;
      }
    };
    const timer = setTimeout(onEnd, 120000);
    stream.on('data', onData);
    stream.once('end', onEnd);
    stream.once('error', onEnd);
    process.once('SIGTERM', onEnd);
    process.once('SIGHUP', onEnd);
  });
}
export async function readBootstrapInput(
  args: string[],
): Promise<BootstrapInput> {
  try {
    if (args.length === 2 && args[0] === '--secret-file' && args[1])
      return await secretFile(args[1]);
    if (args.length !== 0) throw new PasswordInputError();
    const username = await hidden('Operator username (hidden): ', 512);
    let password: Buffer | undefined;
    let confirmation: Buffer | undefined;
    try {
      password = await hidden('Password (hidden): ', 512);
      confirmation = await hidden('Confirm password (hidden): ', 512);
      if (
        password.length !== confirmation.length ||
        !timingSafeEqual(password, confirmation)
      )
        throw new PasswordInputError();
      const value = new TextDecoder('utf-8', { fatal: true }).decode(username);
      const result = input(value, password);
      password = undefined;
      return result;
    } finally {
      username.fill(0);
      password?.fill(0);
      confirmation?.fill(0);
    }
  } catch {
    throw new PasswordInputError();
  }
}
