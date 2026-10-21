#!/usr/bin/env python3
"""Host-administrator Restic escrow export. Default is plan-only; --export reads
three approved client files and writes one age-encrypted recovery package.
No OpenBao/seal/SMTP input, repository initialization, network or deletion.
"""
import argparse
import hashlib
import io
import json
import os
import pathlib
import stat
import subprocess
import sys
import tarfile

ROOT = pathlib.Path('/srv/myims-backup-development')
DESTINATION = pathlib.Path('/home/gino/.myims-recovery-transfer')
IMAGE = 'sha256:4d459195b6509cc5a1f2d5b18eb395a7598d5db4f1939bccd61d3093a653d21e'
RECIPIENT = 'age1fz9942ksf7frzwc90tmwtqr4qfz857fautmkjjgz7me7mj9xjafsdnaykq'
FILES = ('repository.url', 'repository.password', 'ca.crt')


def read_client_file(path, uid=12010, gid=12010):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        value = os.fstat(fd)
        if (not stat.S_ISREG(value.st_mode) or value.st_nlink != 1 or
                value.st_uid != uid or value.st_gid != gid or
                stat.S_IMODE(value.st_mode) != 0o600 or not 0 < value.st_size <= 16384):
            raise ValueError('unexpected_client_file_metadata')
        data = os.read(fd, 16385)
        if len(data) != value.st_size:
            raise ValueError('client_file_changed')
        return data
    finally:
        os.close(fd)


def recovery_archive(directory, uid=12010, gid=12010):
    for parent in [directory, *directory.parents]:
        if not stat.S_ISDIR(parent.lstat().st_mode):
            raise ValueError('unsafe_directory')
    data = {name: read_client_file(directory / name, uid, gid) for name in FILES}
    manifest = {'version': 1, 'purpose': 'Restic repository recovery credentials only; no seal/private age/SMTP material',
                'files': {name: {'bytes': len(value), 'sha256': hashlib.sha256(value).hexdigest()} for name, value in data.items()}}
    data['manifest.json'] = json.dumps(manifest, sort_keys=True).encode()
    archive = io.BytesIO()
    with tarfile.open(fileobj=archive, mode='w') as target:
        for name, value in data.items():
            entry = tarfile.TarInfo(name)
            entry.mode, entry.size = 0o600, len(value)
            target.addfile(entry, io.BytesIO(value))
    return archive.getvalue()


def write_ciphertext(directory_fd, ciphertext):
    if not ciphertext.startswith(b'age-encryption.org/v1\n') or len(ciphertext) > 131072:
        raise ValueError('invalid_encrypted_output')
    fd = os.open('restic-recovery.age', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=directory_fd)
    try:
        os.fchown(fd, 1002, 1002)
        os.fchmod(fd, 0o600)
        with os.fdopen(os.dup(fd), 'wb') as output:
            output.write(ciphertext)
            output.flush()
            os.fsync(output.fileno())
    finally:
        os.close(fd)
    os.fsync(directory_fd)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--export', action='store_true')
    args = parser.parse_args()
    stage = 'plan'
    try:
        if not args.export:
            print(json.dumps({'status': 'plan_only', 'sourceFiles': [str(ROOT / 'client' / name) for name in FILES],
                              'encryptedOutput': str(DESTINATION / 'restic-recovery.age'), 'secretContentsRead': False}))
            return 0
        stage = 'administrator_and_destination'
        if os.geteuid() != 0:
            raise ValueError('host_administrator_required')
        if DESTINATION.is_symlink():
            raise ValueError('unsafe_destination')
        try:
            DESTINATION.mkdir(mode=0o700)
            os.chown(DESTINATION, 1002, 1002)
        except FileExistsError:
            pass
        directory_fd = os.open(DESTINATION, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            value = os.fstat(directory_fd)
            if value.st_uid != 1002 or value.st_gid != 1002 or stat.S_IMODE(value.st_mode) != 0o700:
                raise ValueError('unexpected_destination_custody')
            try:
                os.stat('restic-recovery.age', dir_fd=directory_fd, follow_symlinks=False)
                raise ValueError('existing_export_requires_review')
            except FileNotFoundError:
                pass
            stage = 'approved_restic_input'
            archive = recovery_archive(ROOT / 'client')
            stage = 'network_disabled_age_encryption'
            result = subprocess.run(['docker', 'run', '--rm', '-i', '--network', 'none', '--log-driver', 'none',
                                     '--user', '1002:1002', '--read-only', '--cap-drop', 'ALL',
                                     '--security-opt', 'no-new-privileges:true', '--memory', '128m', '--pids-limit', '64',
                                     '--entrypoint', 'age', IMAGE, '-r', RECIPIENT],
                                    input=archive, capture_output=True, timeout=30)
            if result.returncode != 0:
                raise ValueError('encryption_failed')
            stage = 'exclusive_encrypted_export'
            write_ciphertext(directory_fd, result.stdout)
            print(json.dumps({'status': 'encrypted_export_created', 'encryptedOutput': str(DESTINATION / 'restic-recovery.age'),
                              'ciphertextSha256': hashlib.sha256(result.stdout).hexdigest(),
                              'secretContentsPrinted': False, 'sealOrPrivateAgeKeyRead': False,
                              'offHostCopyVerified': False, 'repositoryInitialized': False, 'openbaoChanges': False}))
        finally:
            os.close(directory_fd)
        return 0
    except Exception:
        print(json.dumps({'status': 'stopped', 'stage': stage, 'secretContentsPrinted': False,
                          'automaticRetry': False}), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
