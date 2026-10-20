// Synthetic fixture audit/snapshot backup rehearsal; all outputs stay in helper tmpfs.
import {
  openSync,
  closeSync,
  fstatSync,
  readFileSync,
  writeFileSync,
  fsyncSync,
  unlinkSync,
  constants,
} from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { verifyRecoverySnapshot } from './recovery-snapshot.mjs';
const sha = (b) => createHash('sha256').update(b).digest('hex');
export function disposableBackupGate(need) {
  let firstPrefix;
  function auditPrefix() {
    const fd = openSync(
      '/fixture-audit/endpoint.json',
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      const info = fstatSync(fd);
      need(
        info.isFile() && info.size > 0 && info.size <= 16777216,
        'audit_backup_size',
      );
      const all = readFileSync(fd);
      // An attended byte boundary ends with a complete JSON record. Later bytes are preserved separately.
      const end = all.lastIndexOf(10, Math.min(info.size, all.length) - 1) + 1;
      need(end > 0, 'audit_backup_boundary');
      const prefix = all.subarray(0, end);
      for (const line of prefix.toString('utf8').trimEnd().split('\n'))
        JSON.parse(line);
      return prefix;
    } finally {
      closeSync(fd);
    }
  }
  function save(bytes, suffix) {
    const path = '/private/backup-' + randomUUID() + suffix;
    const fd = openSync(
      path,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      writeFileSync(fd, bytes);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    return path;
  }
  function verifyCopy(path, expected) {
    const copy = readFileSync(path);
    need(sha(copy) === expected, 'audit_backup_hash');
    return copy;
  }
  function gate(snapshot) {
    const paths = [];
    try {
      const prefix = auditPrefix();
      firstPrefix ??= Buffer.from(prefix);
      const sp = save(snapshot, '.snap');
      paths.push(sp);
      const ap = save(prefix, '.audit');
      paths.push(ap);
      const archive = verifyRecoverySnapshot(readFileSync(sp));
      const copy = verifyCopy(ap, sha(prefix));
      const current = auditPrefix();
      need(
        current.length >= prefix.length &&
          current.subarray(0, prefix.length).equals(prefix),
        'audit_backup_prefix_changed',
      );
      let exclusiveRejected = false;
      try {
        const fd = openSync(
          ap,
          constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
          0o600,
        );
        closeSync(fd);
      } catch (error) {
        exclusiveRejected = error.code === 'EEXIST';
      }
      need(exclusiveRejected, 'backup_overwrite_accepted');
      const corrupt = Buffer.from(copy);
      corrupt[0] ^= 1;
      const corruptPath = save(corrupt, '.corrupt.audit');
      paths.push(corruptPath);
      let auditCorruptionRejected = false;
      try {
        verifyCopy(corruptPath, sha(prefix));
      } catch (error) {
        auditCorruptionRejected = error.message === 'audit_backup_hash';
      }
      need(auditCorruptionRejected, 'audit_corruption_not_detected');
      let truncatedRejected = false;
      try {
        verifyRecoverySnapshot(
          snapshot.subarray(0, Math.floor(snapshot.length / 2)),
        );
      } catch {
        truncatedRejected = true;
      }
      need(truncatedRejected, 'snapshot_corruption_not_detected');
      let unavailableRejected = false;
      try {
        const fd = openSync(
          '/private/missing-backup-parent/snapshot',
          constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
          0o600,
        );
        closeSync(fd);
      } catch (error) {
        unavailableRejected = error.code === 'ENOENT';
      }
      need(unavailableRejected, 'backup_unavailable_storage_accepted');
      return {
        snapshotSha256: archive.snapshotSha256,
        auditBoundaryBytes: prefix.length,
        auditSha256: sha(prefix),
        fsyncCalled: true,
        tmpfsOnly: true,
        stablePrefixVerified: true,
        exclusiveOverwriteRejected: true,
        truncatedSnapshotRejected: true,
        corruptAuditRejected: true,
        unavailableStorageRejected: true,
      };
    } finally {
      for (const p of paths) unlinkSync(p);
    }
  }
  function finalAudit() {
    const latest = auditPrefix();
    need(
      firstPrefix && latest.subarray(0, firstPrefix.length).equals(firstPrefix),
      'audit_append_prefix_changed',
    );
    const suffix = latest.subarray(firstPrefix.length);
    const path = save(suffix, '.post-backup.audit');
    try {
      need(sha(readFileSync(path)) === sha(suffix), 'audit_suffix_hash');
    } finally {
      unlinkSync(path);
    }
    return {
      firstBoundaryBytes: firstPrefix.length,
      finalBoundaryBytes: latest.length,
      laterAppendedBytes: suffix.length,
      originalPrefixUnchanged: true,
      laterAuditSeparatelyVerified: true,
    };
  }
  return { gate, finalAudit };
}
