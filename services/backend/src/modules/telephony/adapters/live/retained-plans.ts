import { randomUUID } from 'node:crypto';
import {
  constants,
  openSync,
  fstatSync,
  readFileSync,
  writeFileSync,
  fsyncSync,
  closeSync,
  mkdirSync,
  lstatSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { uuid } from '../../../identity/domain/storage';
import { canonical } from '../../domain/revision-snapshot';
import type { RetainedLiveArtifact } from './verified-execution';
import { NativePbxFailure } from './native-driver';
/** Native owner-only recovery descriptors. Contains no provider token or material. */
export class RetainedLivePlans {
  private readonly directory: string;
  constructor(
    root: string,
    private readonly nodeId: string,
    private readonly installationId: string,
  ) {
    this.directory = join(root, 'plans');
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const stat = lstatSync(this.directory);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      stat.uid !== process.getuid?.() ||
      stat.mode & 0o077
    )
      throw new NativePbxFailure('boundary_unavailable');
  }
  private check(value: RetainedLiveArtifact, id: string) {
    if (
      !uuid(id) ||
      value.identity?.revisionId !== id ||
      value.identity.nodeId !== this.nodeId ||
      value.identity.installationId !== this.installationId ||
      value.snapshot?.node.id !== this.nodeId ||
      value.snapshot.node.installationId !== this.installationId ||
      !/^[a-f0-9]{64}$/.test(value.unmanaged)
    )
      throw new NativePbxFailure('boundary_unavailable');
  }
  load(id: string): RetainedLiveArtifact {
    if (!uuid(id)) throw new NativePbxFailure('boundary_unavailable');
    const fd = openSync(
      join(this.directory, id + '.json'),
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const stat = fstatSync(fd);
      if (
        !stat.isFile() ||
        stat.nlink !== 1 ||
        stat.uid !== process.getuid?.() ||
        stat.mode & 0o077 ||
        stat.size > 5 * 1024 * 1024
      )
        throw new NativePbxFailure('boundary_unavailable');
      const value = JSON.parse(
        readFileSync(fd, 'utf8'),
      ) as RetainedLiveArtifact;
      this.check(value, id);
      return value;
    } finally {
      closeSync(fd);
    }
  }
  save(value: RetainedLiveArtifact) {
    const id = value.identity.revisionId;
    this.check(value, id);
    try {
      const old = this.load(id);
      if (canonical(old) !== canonical(value))
        throw new NativePbxFailure('boundary_unavailable');
      return;
    } catch (error) {
      if (
        !error ||
        typeof error !== 'object' ||
        !('code' in error) ||
        error.code !== 'ENOENT'
      )
        throw error;
    }
    const temporary = join(this.directory, `.plan-${randomUUID()}`);
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
    try {
      renameSync(temporary, join(this.directory, id + '.json'));
    } finally {
      rmSync(temporary, { force: true });
    }
    const directory = openSync(
      this.directory,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    try {
      fsyncSync(directory);
    } finally {
      closeSync(directory);
    }
  }
}
