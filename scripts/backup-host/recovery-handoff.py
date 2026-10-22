#!/usr/bin/env python3
"""Plan exact development recovery staging; attended administrator ciphertext handoff only.
No OpenBao, Docker, network, seal, root-token or repository-credential access.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys

ROOT = Path('/srv/myims-backup-development')
RECOVERY_ROOT = Path('/srv/myims-openbao-recovery-development')
UUID = re.compile(r'^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$')
MAX_BYTES = 402653184


def layout(operation):
    if not UUID.fullmatch(operation):
        raise ValueError('operation_id')
    base = RECOVERY_ROOT / operation
    return {'operationDirectory': str(base), 'capture': str(base / 'capture'),
            'encrypted': str(base / 'encrypted' / 'baseline'), 'auditEncrypted': str(base / 'encrypted' / 'audit-after'), 'spool': str(ROOT / 'encrypted-spool'),
            'directories': [
                {'path': str(RECOVERY_ROOT), 'uid': 0, 'gid': 0, 'mode': '0700'},
                {'path': str(base), 'uid': 0, 'gid': 0, 'mode': '0700'},
                {'path': str(base / 'capture'), 'uid': 1003, 'gid': 1003, 'mode': '0700'},
                {'path': str(base / 'encrypted'), 'uid': 1003, 'gid': 1003, 'mode': '0700'},
                {'path': str(base / 'encrypted' / 'baseline'), 'uid': 1003, 'gid': 1003, 'mode': '0700'},
                {'path': str(base / 'encrypted' / 'audit-after'), 'uid': 1003, 'gid': 1003, 'mode': '0700'},
            ]}


def directory(path, owner):
    for component in [path, *path.parents]:
        value = component.lstat()
        if not stat.S_ISDIR(value.st_mode) or stat.S_ISLNK(value.st_mode):
            raise ValueError('unsafe_directory')
    value = path.lstat()
    if (value.st_uid, value.st_gid, stat.S_IMODE(value.st_mode)) != (*owner, 0o700):
        raise ValueError('directory_custody')


def prepare(operation):
    """Create only the declared empty layout; never repair or reuse an operation."""
    paths = layout(operation)
    entries = paths['directories']
    root = Path(entries[0]['path'])
    # Refuse a pre-existing operation before creating any children. Partial
    # preparation stays accounted for and requires attended review.
    if os.path.lexists(paths['operationDirectory']):
        raise ValueError('operation_exists')
    if os.path.lexists(root):
        directory(root, (0, 0))
    else:
        # Ancestors must be real directories and not writable by other users.
        for parent in root.parents:
            value = parent.lstat()
            if (not stat.S_ISDIR(value.st_mode) or value.st_uid != 0 or value.st_mode & 0o022):
                raise ValueError('unsafe_parent')
        root.mkdir(mode=0o700)
    for entry in entries[1:]:
        path = Path(entry['path'])
        path.mkdir(mode=0o700)
        os.chown(path, entry['uid'], entry['gid'])
        directory(path, (entry['uid'], entry['gid']))
        if list(path.iterdir()):
            raise ValueError('nonempty_staging')
    return {'status': 'empty_staging_prepared', 'operationId': operation,
            'providerAccessed': False, 'credentialContentsRead': False,
            'existingObjectsChanged': False, 'automaticRetry': False}


def read_cipher_input(path, owner, limit, dir_fd=None):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=dir_fd)
    try:
        before = os.fstat(fd)
        if (not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or
                (before.st_uid, before.st_gid, stat.S_IMODE(before.st_mode)) != (*owner, 0o600) or
                not 0 < before.st_size <= limit):
            raise ValueError('ciphertext_custody')
        data = bytearray()
        while len(data) <= limit:
            chunk = os.read(fd, min(1048576, limit + 1 - len(data)))
            if not chunk:
                break
            data.extend(chunk)
        after = os.fstat(fd)
        if (len(data) != before.st_size or
                (before.st_size, before.st_mtime_ns, before.st_ctime_ns) !=
                (after.st_size, after.st_mtime_ns, after.st_ctime_ns)):
            raise ValueError('changed_ciphertext')
        return bytes(data)
    finally:
        os.close(fd)


def handoff(source, spool, operation, source_owner=(1003, 1003), target_owner=(12010, 12010)):
    """Copy one verified encrypted pair exclusively; preserve source and partial results."""
    if not UUID.fullmatch(operation):
        raise ValueError('operation_id')
    directory(source, source_owner)
    directory(spool, target_owner)
    source_fd = os.open(source, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        spool_fd = os.open(spool, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            return handoff_open(source_fd, spool_fd, spool, operation, source_owner, target_owner)
        finally:
            os.close(spool_fd)
    finally:
        os.close(source_fd)


def handoff_open(source_fd, spool_fd, spool, operation, source_owner, target_owner):
    for fd, owner in [(source_fd, source_owner), (spool_fd, target_owner)]:
        value = os.fstat(fd)
        if (value.st_uid, value.st_gid, stat.S_IMODE(value.st_mode)) != (*owner, 0o700):
            raise ValueError('directory_custody_changed')
    members = sorted(os.listdir(source_fd))
    if len(members) != 2 or not members[0].endswith('.age'):
        raise ValueError('unexpected_members')
    archive_id = members[0][:-4]
    if not UUID.fullmatch(archive_id) or members[1] != archive_id + '.json':
        raise ValueError('unexpected_members')
    receipt_bytes = read_cipher_input(members[1], source_owner, 4096, source_fd)
    receipt = json.loads(receipt_bytes)
    if (receipt.get('format') != 1 or receipt.get('kind') not in ('recovery-capture', 'recovery-audit') or
            receipt.get('captureOperationId') != operation or receipt.get('operationId') != archive_id or
            receipt.get('archive') != members[0] or type(receipt.get('bytes')) is not int or
            not 0 < receipt['bytes'] <= MAX_BYTES or
            not re.fullmatch('[a-f0-9]{64}', receipt.get('sha256', ''))):
        raise ValueError('receipt_mismatch')
    ciphertext = read_cipher_input(members[0], source_owner, MAX_BYTES, source_fd)
    if (not ciphertext.startswith(b'age-encryption.org/v1\n') or len(ciphertext) != receipt['bytes'] or
            hashlib.sha256(ciphertext).hexdigest() != receipt['sha256']):
        raise ValueError('ciphertext_mismatch')
    def same_spool():
        current, opened = spool.lstat(), os.fstat(spool_fd)
        if not stat.S_ISDIR(current.st_mode) or (current.st_dev, current.st_ino) != (opened.st_dev, opened.st_ino):
            raise ValueError('spool_path_changed')
    same_spool()
    for name in members:
        try:
            os.stat(name, dir_fd=spool_fd, follow_symlinks=False)
        except FileNotFoundError:
            continue
        raise ValueError('destination_exists')
    # Shared archive fence. Failed/uncertain copies retain it for attended review.
    os.mkdir('.spool.lock', mode=0o700, dir_fd=spool_fd)
    complete = False
    try:
        used = 0
        for name in os.listdir(spool_fd):
            if name == '.spool.lock':
                continue
            value = os.stat(name, dir_fd=spool_fd, follow_symlinks=False)
            if not stat.S_ISREG(value.st_mode) or value.st_nlink != 1:
                raise ValueError('unexpected_spool_member')
            used += value.st_size
        if used + len(ciphertext) + len(receipt_bytes) > 1073741824:
            raise ValueError('spool_capacity')
        for name, value in [(members[0], ciphertext), (members[1], receipt_bytes)]:
            fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=spool_fd)
            try:
                if os.geteuid() == 0:
                    os.fchown(fd, *target_owner)
                with os.fdopen(os.dup(fd), 'wb') as output:
                    output.write(value)
                    output.flush()
                os.fsync(fd)
            finally:
                os.close(fd)
        os.fsync(spool_fd)
        same_spool()
        complete = True
    finally:
        if complete:
            os.rmdir('.spool.lock', dir_fd=spool_fd)
            os.fsync(spool_fd)
    return {'status': 'ciphertext_handoff_verified', 'operationId': operation,
            'archiveId': archive_id, 'ciphertextSha256': receipt['sha256'],
            'plaintextCopied': False, 'sourceChanged': False, 'repositoryAccessed': False,
            'openbaoChanges': False, 'automaticRetry': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--operation-id', required=True)
    parser.add_argument('--handoff', action='store_true')
    parser.add_argument('--prepare', action='store_true')
    parser.add_argument('--artifact', choices=['baseline', 'audit-after'], default='baseline')
    args = parser.parse_args()
    try:
        paths = layout(args.operation_id)
        if args.prepare:
            if args.handoff or os.geteuid() != 0:
                raise ValueError('exclusive_administrator_preparation_required')
            print(json.dumps(prepare(args.operation_id)))
            return 0
        if not args.handoff:
            print(json.dumps({'status': 'plan_only', **paths, 'filesRead': False,
                              'directoriesCreated': False, 'retainedExecutionAuthorized': False}))
            return 0
        if os.geteuid() != 0:
            raise ValueError('host_administrator_required')
        print(json.dumps(handoff(Path(paths['encrypted' if args.artifact == 'baseline' else 'auditEncrypted']), Path(paths['spool']), args.operation_id)))
        return 0
    except Exception:
        print(json.dumps({'status': 'stopped', 'stage': 'ciphertext_handoff',
                          'secretContentsPrinted': False, 'automaticRetry': False}), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
