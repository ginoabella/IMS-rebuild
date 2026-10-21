#!/usr/bin/env python3
"""Administrator handoff: metadata checks; optionally install ONLY the public age recipient.
Never opens seal keys, repository passwords or SMTP passwords; no network/Docker calls.
"""
import argparse
import grp
import json
import os
import pathlib
import pwd
import stat
import sys

ROOT = pathlib.Path('/srv/myims-backup-development')
SEAL = pathlib.Path('/home/gino/projects/IMS-rebuild/.local/endpoint-credentials/seal.json')
RECIPIENT = b'age1fz9942ksf7frzwc90tmwtqr4qfz857fautmkjjgz7me7mj9xjafsdnaykq\n'


def metadata(path, uid, gid, mode):
    try:
        value = path.lstat()
        return (stat.S_ISREG(value.st_mode) and value.st_nlink == 1 and value.st_uid == uid
                and value.st_gid == gid and stat.S_IMODE(value.st_mode) == mode and value.st_size > 0)
    except OSError:
        return False


def safe_directories(path):
    for directory in [path, *path.parents]:
        value = directory.lstat()
        if not stat.S_ISDIR(value.st_mode) or stat.S_ISLNK(value.st_mode):
            raise ValueError('unsafe_directory')


def public_recipient(directory, gid, install=False, owner=0):
    safe_directories(directory)
    path = directory / 'recipient.txt'
    if path.exists() or path.is_symlink():
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        try:
            details = os.fstat(fd)
            if not stat.S_ISREG(details.st_mode) or details.st_nlink != 1 or details.st_size != len(RECIPIENT):
                raise ValueError('unexpected_recipient_file')
            if os.read(fd, 256) != RECIPIENT:
                raise ValueError('different_recipient_refused')
        finally:
            os.close(fd)
        # Never rewrite an existing key or silently change its custody.
        return {'matchesSuppliedPublicRecipient': True, 'installedNow': False,
                'protectedFilePermissions': metadata(path, owner, gid, 0o440)}
    if not install:
        return {'matchesSuppliedPublicRecipient': False, 'installedNow': False, 'protectedFilePermissions': False}
    # Only create this exact public file; no secrets are opened or copied.
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o440)
    try:
        os.fchown(fd, owner, gid)
        os.fchmod(fd, 0o440)
        if os.write(fd, RECIPIENT) != len(RECIPIENT):
            raise OSError('public_recipient_write_incomplete')
        os.fsync(fd)
    finally:
        os.close(fd)
    fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)
    return {'matchesSuppliedPublicRecipient': True, 'installedNow': True,
            'protectedFilePermissions': metadata(path, owner, gid, 0o440)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--install-public-recipient', action='store_true')
    args = parser.parse_args()
    stage = 'administrator_identity'
    try:
        if os.geteuid() != 0:
            raise ValueError('host_administrator_required')
        service = pwd.getpwnam('myims-backup-development')
        group = grp.getgrnam('myims-backup-development')
        if service.pw_uid != 12010 or service.pw_gid != 12010 or group.gr_gid != 12010:
            raise ValueError('unexpected_service_identity')
        stage = 'approved_directory_metadata'
        for directory in [ROOT, ROOT / 'public', ROOT / 'client', ROOT / 'notification', SEAL.parent]:
            safe_directories(directory)
        stage = 'public_recipient'
        public = public_recipient(ROOT / 'public', group.gr_gid, args.install_public_recipient)
        checks = {
            'publicRecipient': public,
            'openbaoSealFileMetadata': metadata(SEAL, 1003, 1003, 0o600),
            'resticPasswordFileMetadata': metadata(ROOT / 'client/repository.password', 12010, 12010, 0o600),
            'restServerCredentialFileMetadata': metadata(ROOT / 'client/repository.url', 12010, 12010, 0o600),
            'smtpPasswordFileMetadata': metadata(ROOT / 'notification/smtp.password', 0, 0, 0o600),
        }
        passed = all(value is True for key, value in checks.items() if key != 'publicRecipient') and public['matchesSuppliedPublicRecipient'] and public['protectedFilePermissions']
        print(json.dumps({'status': 'local_checks_passed' if passed else 'local_checks_pending',
                          'checks': checks, 'secretContentsRead': False, 'networkRequests': 0,
                          'repositoryInitialized': False, 'openbaoChanges': False,
                          'independentCustodyVerified': False, 'readyForRetainedRecovery': False}))
        return 0 if passed else 1
    except Exception:
        print(json.dumps({'status': 'stopped', 'stage': stage, 'secretContentsRead': False,
                          'networkRequests': 0, 'automaticRetry': False}), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
