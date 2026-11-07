import { createHash, randomUUID } from 'node:crypto';
import {
  constants,
  openSync,
  closeSync,
  fsyncSync,
  fstatSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  lstatSync,
  readdirSync,
  renameSync,
  chownSync,
  chmodSync,
} from 'node:fs';
import { join } from 'node:path';
import { canonical } from '../../domain/revision-snapshot';
import { protectedLiveBytes } from './configuration';
import { uuid } from '../../../identity/domain/storage';
const digestPattern = /^[a-f0-9]{64}$/;
const hash = (bytes: Buffer) =>
  createHash('sha256').update(bytes).digest('hex');
export function staticDigest(files: ReadonlyMap<string, Buffer>): string {
  return hash(
    Buffer.from(
      canonical(
        [...files]
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([name, bytes]) => [name, hash(bytes)]),
      ),
    ),
  );
}
export function syncDirectory(path: string) {
  const fd = openSync(
    path,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
export function durableJson(path: string, value: unknown) {
  const temporary = path + '.' + randomUUID();
  const fd = openSync(
    temporary,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    0o600,
  );
  try {
    writeFileSync(fd, canonical(value));
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(temporary, path);
  syncDirectory(join(path, '..'));
}
/** Root-only immutable static custody, with an independently checked PBX-readable projection. */
export class ProtectedStaticProfiles {
  constructor(
    private readonly root: string,
    private readonly readerGid: number,
  ) {
    if (
      process.getuid?.() !== 0 ||
      !/^\/var\/lib\/myims-pbx\/control\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(
        root,
      ) ||
      !Number.isSafeInteger(readerGid) ||
      readerGid < 1
    )
      throw new Error('Static custody unavailable');
    this.directory(root, 0o700);
  }
  private directory(path: string, mode: number, group = 0) {
    const stat = lstatSync(path);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      stat.uid !== 0 ||
      stat.gid !== group ||
      (stat.mode & 0o777) !== mode
    )
      throw new Error('Static custody unavailable');
  }
  private createDirectory(path: string, mode: number, group = 0) {
    try {
      mkdirSync(path, { mode });
      chownSync(path, 0, group);
      chmodSync(path, mode);
    } catch (e) {
      if (!(e && typeof e === 'object' && 'code' in e && e.code === 'EEXIST'))
        throw e;
    }
    this.directory(path, mode, group);
  }
  readDirectory(
    path: string,
    protectedCustody = false,
    projection = false,
  ): Map<string, Buffer> {
    const names = readdirSync(path).sort();
    if (
      names.length < 1 ||
      names.length > 64 ||
      names.some((n) => !/^[a-z][a-z0-9_-]{0,63}\.conf$/.test(n))
    )
      throw new Error('Static profile unavailable');
    const files = new Map<string, Buffer>();
    let total = 0;
    for (const name of names) {
      const fd = openSync(
        join(path, name),
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const stat = fstatSync(fd);
        if (
          !stat.isFile() ||
          stat.nlink !== 1 ||
          stat.size > 1048576 ||
          (protectedCustody && (stat.uid !== 0 || stat.mode & 0o077)) ||
          (projection &&
            (stat.uid !== 0 ||
              stat.gid !== this.readerGid ||
              (stat.mode & 0o777) !== 0o640))
        )
          throw new Error('Static profile unavailable');
        const bytes = readFileSync(fd);
        total += bytes.length;
        if (bytes.length > 1048576 || total > 8388608)
          throw new Error('Static profile unavailable');
        files.set(name, bytes);
      } finally {
        closeSync(fd);
      }
    }
    if (
      !files.has('asterisk.conf') ||
      !files.has('modules.conf') ||
      !files.has('pjsip.conf') ||
      !files.has('extensions.conf')
    )
      throw new Error('Static profile incomplete');
    return files;
  }
  private write(path: string, bytes: Buffer, mode: number, group = 0) {
    const fd = openSync(
      path,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      mode,
    );
    try {
      writeFileSync(fd, bytes);
      chownSync(path, 0, group);
      chmodSync(path, mode);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }
  stage(files: ReadonlyMap<string, Buffer>): string {
    if (
      files.size < 1 ||
      files.size > 64 ||
      [...files].some(
        ([name, bytes]) =>
          !/^[a-z][a-z0-9_-]{0,63}\.conf$/.test(name) ||
          !Buffer.isBuffer(bytes) ||
          bytes.length > 1048576,
      ) ||
      [...files.values()].reduce((total, bytes) => total + bytes.length, 0) >
        8388608
    )
      throw new Error('Static profile unavailable');
    const digest = staticDigest(files),
      custody = join(this.root, 'static-profiles');
    this.createDirectory(custody, 0o700);
    const target = join(custody, digest);
    try {
      lstatSync(target);
      this.load(digest);
      return digest;
    } catch (e) {
      if (!(e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT'))
        throw e;
    }
    const temporary = join(custody, '.stage-' + randomUUID());
    this.createDirectory(temporary, 0o700);
    for (const [name, bytes] of files) {
      if (
        !/^[a-z][a-z0-9_-]{0,63}\.conf$/.test(name) ||
        !Buffer.isBuffer(bytes)
      )
        throw new Error('Static profile unavailable');
      this.write(join(temporary, name), bytes, 0o600);
    }
    if (staticDigest(this.readDirectory(temporary, true)) !== digest)
      throw new Error('Static profile conflict');
    syncDirectory(temporary);
    renameSync(temporary, target);
    syncDirectory(custody);
    return digest;
  }
  load(digest: string) {
    if (!digestPattern.test(digest))
      throw new Error('Static profile unavailable');
    const path = join(this.root, 'static-profiles', digest);
    this.directory(join(this.root, 'static-profiles'), 0o700);
    this.directory(path, 0o700);
    const files = this.readDirectory(path, true);
    if (staticDigest(files) !== digest)
      throw new Error('Static profile conflict');
    return files;
  }
  project(digest: string): string {
    const files = this.load(digest),
      profiles = '/var/lib/myims-pbx/profiles';
    this.createDirectory(profiles, 0o750, this.readerGid);
    const target = join(profiles, digest),
      conf = join(target, 'conf');
    try {
      lstatSync(target);
      return this.verifyProjection(digest);
    } catch (e) {
      if (!(e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT'))
        throw e;
    }
    const temporary = join(profiles, '.project-' + randomUUID());
    this.createDirectory(temporary, 0o750, this.readerGid);
    this.createDirectory(join(temporary, 'conf'), 0o750, this.readerGid);
    for (const [name, bytes] of files)
      this.write(join(temporary, 'conf', name), bytes, 0o640, this.readerGid);
    const original = files.get('asterisk.conf')!.toString('utf8');
    if (
      (original.match(/^astetcdir\s*=>\s*\/etc\/asterisk\s*$/gm) ?? [])
        .length !== 1
    )
      throw new Error('Unsupported static directory layout');
    this.write(
      join(temporary, 'launch.conf'),
      Buffer.from(
        original.replace(
          /^astetcdir\s*=>\s*\/etc\/asterisk\s*$/m,
          'astetcdir => ' + conf,
        ),
      ),
      0o640,
      this.readerGid,
    );
    syncDirectory(join(temporary, 'conf'));
    syncDirectory(temporary);
    renameSync(temporary, target);
    syncDirectory(profiles);
    return this.verifyProjection(digest);
  }
  verifyProjection(digest: string) {
    const files = this.load(digest),
      path = '/var/lib/myims-pbx/profiles/' + digest;
    this.directory('/var/lib/myims-pbx/profiles', 0o750, this.readerGid);
    this.directory(path, 0o750, this.readerGid);
    this.directory(join(path, 'conf'), 0o750, this.readerGid);
    if (
      staticDigest(this.readDirectory(join(path, 'conf'), false, true)) !==
      digest
    )
      throw new Error('Static projection conflict');
    const expected = files
      .get('asterisk.conf')!
      .toString('utf8')
      .replace(
        /^astetcdir\s*=>\s*\/etc\/asterisk\s*$/m,
        'astetcdir => ' + path + '/conf',
      );
    const fd = openSync(
      join(path, 'launch.conf'),
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const stat = fstatSync(fd);
      if (
        !stat.isFile() ||
        stat.nlink !== 1 ||
        stat.uid !== 0 ||
        stat.gid !== this.readerGid ||
        (stat.mode & 0o777) !== 0o640 ||
        stat.size > 1048576 ||
        !readFileSync(fd).equals(Buffer.from(expected))
      )
        throw new Error('Static launcher conflict');
    } finally {
      closeSync(fd);
    }
    return path + '/launch.conf';
  }
  select(digest: string, artifactId: string) {
    if (!uuid(artifactId)) throw new Error('Static selection unavailable');
    this.verifyProjection(digest);
    durableJson(join(this.root, 'static-selection.json'), {
      version: 1,
      digest,
      artifactId,
    });
  }
}
export function selectedStaticProfile(
  root: string,
): { digest: string; artifactId: string } | null {
  let bytes: Buffer;
  try {
    bytes = protectedLiveBytes(join(root, 'static-selection.json'), 1024);
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT')
      return null;
    throw e;
  }
  const v = JSON.parse(bytes.toString('utf8')) as {
    version: unknown;
    digest: unknown;
    artifactId: unknown;
  };
  if (
    Object.keys(v).sort().join() !== 'artifactId,digest,version' ||
    v.version !== 1 ||
    typeof v.digest !== 'string' ||
    !digestPattern.test(v.digest) ||
    !uuid(v.artifactId)
  )
    throw new Error('Static selection unavailable');
  return { digest: v.digest, artifactId: v.artifactId as string };
}
