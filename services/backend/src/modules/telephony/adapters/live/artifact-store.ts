import { createHash, randomUUID } from 'node:crypto';
import {
  constants,
  closeSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { uuid } from '../../../identity/domain/storage';
import { canonical } from '../../domain/revision-snapshot';
export class ArtifactStoreFailure extends Error {
  constructor(
    readonly code:
      'artifact_invalid' | 'artifact_unavailable' | 'artifact_conflict',
  ) {
    super('Protected PBX artifact unavailable');
  }
}
export interface ArtifactIdentity {
  installationId: string;
  nodeId: string;
  revisionId: string;
  sequence: number;
  compilerVersion: string;
  policyVersion: string;
  sourceDigest: string;
}
/** Internal secret-bearing content. Never use as an HTTP/queue/audit contract. */
export interface ManagedArtifacts {
  pjsip: Buffer;
  dialplan: Buffer;
}
const maximum = 4 * 1024 * 1024;
const names = ['pjsip.conf', 'extensions.conf', 'provenance.json'] as const;
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
function invalid(): never {
  throw new ArtifactStoreFailure('artifact_invalid');
}
function identity(value: unknown): ArtifactIdentity {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).sort().join(',') !==
      'compilerVersion,installationId,nodeId,policyVersion,revisionId,sequence,sourceDigest' ||
    [v.installationId, v.nodeId, v.revisionId].some(
      (x) => !uuid(x) || x !== String(x).toLowerCase(),
    ) ||
    typeof v.sequence !== 'number' ||
    !Number.isSafeInteger(v.sequence) ||
    v.sequence < 1 ||
    v.sequence > 2147483647 ||
    [v.compilerVersion, v.policyVersion].some(
      (x) => typeof x !== 'string' || !/^[a-z0-9-]{1,64}$/.test(x),
    ) ||
    typeof v.sourceDigest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(v.sourceDigest)
  )
    invalid();
  return v as unknown as ArtifactIdentity;
}
/**
 * Protected immutable complete-set staging only. Selection/reload deliberately
 * belongs to the fenced mutation boundary; this store cannot activate a set.
 * Root and files are owner-only until the deployment defines the PBX reader grant.
 */
export class ProtectedArtifactStore {
  private readonly root: string;
  private readonly owner: number;
  constructor(
    root: string,
    private readonly installationId: string,
    private readonly nodeId: string,
  ) {
    if (
      !uuid(installationId) ||
      !uuid(nodeId) ||
      !root.startsWith('/') ||
      root.includes('\0') ||
      root !== resolve(root)
    )
      invalid();
    this.root = root;
    const owner = process.getuid?.();
    if (owner === undefined) invalid();
    this.owner = owner;
    try {
      this.directory(root);
    } catch (e) {
      if (e instanceof ArtifactStoreFailure) throw e;
      throw new ArtifactStoreFailure('artifact_unavailable');
    }
  }
  private directory(path: string) {
    const stat = lstatSync(path);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      stat.uid !== this.owner ||
      (stat.mode & 0o077) !== 0
    )
      invalid();
  }
  private checkedIdentity(value: unknown) {
    const v = identity(value);
    if (v.installationId !== this.installationId || v.nodeId !== this.nodeId)
      invalid();
    return v;
  }
  private bytes(path: string, max: number): Buffer {
    const fd = openSync(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const s = fstatSync(fd);
      if (
        !s.isFile() ||
        s.nlink !== 1 ||
        s.uid !== this.owner ||
        (s.mode & 0o077) !== 0 ||
        s.size > max
      )
        invalid();
      const bytes = readFileSync(fd);
      if (bytes.length > max) invalid();
      return bytes;
    } finally {
      closeSync(fd);
    }
  }
  private sync(path: string) {
    const fd = openSync(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY,
    );
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }
  private write(path: string, data: Buffer) {
    const fd = openSync(
      path,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      writeFileSync(fd, data);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }
  stage(exact: ArtifactIdentity, files: ManagedArtifacts): ArtifactIdentity {
    let temporary: string | undefined;
    try {
      const selected = this.checkedIdentity(exact);
      if (
        !Buffer.isBuffer(files.pjsip) ||
        !Buffer.isBuffer(files.dialplan) ||
        files.pjsip.length + files.dialplan.length > maximum
      )
        invalid();
      this.directory(this.root);
      const provenance = Buffer.from(
        canonical({
          identity: selected,
          pjsip: hash(files.pjsip),
          dialplan: hash(files.dialplan),
        }),
      );
      const target = join(this.root, selected.revisionId);
      // An exact retry proves both the identity and the complete existing bytes.
      if (readdirSync(this.root).includes(selected.revisionId)) {
        const old = this.load(selected);
        if (
          !old.pjsip.equals(files.pjsip) ||
          !old.dialplan.equals(files.dialplan)
        )
          throw new ArtifactStoreFailure('artifact_conflict');
        return { ...selected };
      }
      temporary = join(this.root, `.stage-${randomUUID()}`);
      mkdirSync(temporary, { mode: 0o700 });
      this.write(join(temporary, names[0]), files.pjsip);
      this.write(join(temporary, names[1]), files.dialplan);
      this.write(join(temporary, names[2]), provenance);
      this.sync(temporary);
      try {
        renameSync(temporary, target);
      } catch {
        // Concurrent exact staging is safe only when the winner matches fully.
        const old = this.load(selected);
        if (
          !old.pjsip.equals(files.pjsip) ||
          !old.dialplan.equals(files.dialplan)
        )
          throw new ArtifactStoreFailure('artifact_conflict');
      }
      this.sync(this.root);
      return { ...selected };
    } catch (e) {
      if (e instanceof ArtifactStoreFailure) throw e;
      throw new ArtifactStoreFailure('artifact_unavailable');
    } finally {
      if (temporary) {
        try {
          rmSync(temporary, { recursive: true, force: true });
        } catch {
          /* Retain protected staging remnants; never replace a finite error. */
        }
      }
    }
  }
  load(exact: ArtifactIdentity): ManagedArtifacts {
    try {
      const selected = this.checkedIdentity(exact);
      this.directory(this.root);
      const path = join(this.root, selected.revisionId);
      this.directory(path);
      if (readdirSync(path).sort().join(',') !== [...names].sort().join(','))
        invalid();
      const pjsip = this.bytes(join(path, names[0]), maximum),
        dialplan = this.bytes(join(path, names[1]), maximum);
      if (pjsip.length + dialplan.length > maximum) invalid();
      const provenance: unknown = JSON.parse(
        this.bytes(join(path, names[2]), 4096).toString('utf8'),
      );
      if (
        canonical(provenance) !==
        canonical({
          identity: selected,
          pjsip: hash(pjsip),
          dialplan: hash(dialplan),
        })
      )
        throw new ArtifactStoreFailure('artifact_conflict');
      return { pjsip, dialplan };
    } catch (e) {
      if (e instanceof ArtifactStoreFailure) throw e;
      throw new ArtifactStoreFailure('artifact_unavailable');
    }
  }
}
