#!/usr/bin/env python3
"""Owner-approved development storage install. Default is read-only --plan.

Run --install only as the host administrator. No OpenBao access, repository init,
private age identity generation, timer activation, pruning or recovery is included.
"""
import argparse
import datetime
import grp
import hashlib
import json
import os
import pathlib
import pwd
import secrets
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
DEST = pathlib.Path('/srv/myims-backup-development')
ACCOUNT = 'myims-backup-development'
VOLUME = 'myims-backup-development_repository'
SERVER = 'restic/rest-server:0.14.0@sha256:d2aff06f47eb38637dff580c3e6bce4af98f386c396a25d32eb6727ec96214a5'
QUOTA = 2 * 1024**3  # Controlled pilot only; not the full retention budget.
LABEL = 'owner-installation-approval-2026-10-21'
stage = 'preflight'


def command(args, data=None):
    result = subprocess.run(args, input=data, capture_output=True, timeout=180)
    if result.returncode:
        raise RuntimeError('host_install_command_failed')
    return result.stdout


def private(path, data, uid, gid):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        remaining = memoryview(data)
        while remaining:
            remaining = remaining[os.write(fd, remaining):]
        os.fchown(fd, uid, gid)
        os.fsync(fd)
    finally:
        os.close(fd)


def identity_id():
    for candidate in range(12010, 12110):
        try:
            pwd.getpwuid(candidate)
            continue
        except KeyError:
            pass
        try:
            grp.getgrgid(candidate)
        except KeyError:
            return candidate
    raise RuntimeError('no_unused_service_id')


def plan():
    manifest = json.loads((ROOT / 'infra/backup/review-manifest.json').read_text())
    for name, expected in manifest['artifacts'].items():
        path = ROOT / name
        if path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise RuntimeError('reviewed_source_hash_changed')
    image = command(['docker', 'image', 'inspect', manifest['toolingImage'], '--format', '{{.Id}}']).decode().strip()
    if image != manifest['testedToolingImageId']:
        raise RuntimeError('tested_tooling_image_changed')
    if DEST.exists() or DEST.is_symlink():
        raise RuntimeError('existing_host_target_requires_review')
    for lookup in [pwd.getpwnam, grp.getgrnam]:
        try:
            lookup(ACCOUNT)
            raise RuntimeError('existing_host_account_requires_review')
        except KeyError:
            pass
    for kind, name in [('container', 'myims-backup-development-rest-server-1'), ('network', 'myims-backup-development_repository')]:
        if subprocess.run(['docker', kind, 'inspect', name], capture_output=True, timeout=20).returncode == 0:
            raise RuntimeError('existing_storage_target_requires_review')
    info = json.loads(command(['docker', 'volume', 'inspect', VOLUME]))[0]
    if info.get('Labels', {}).get('myims.backup.authorization') != LABEL or info.get('Labels', {}).get('myims.backup.state') != 'uninitialized':
        raise RuntimeError('unreviewed_volume')
    available = shutil.disk_usage('/srv').free
    if available < 8 * 1024**3:
        raise RuntimeError('insufficient_pilot_headroom')
    uid = identity_id()
    return {'serviceAccount': ACCOUNT, 'uid': uid, 'gid': uid, 'hostRoot': str(DEST),
            'volume': VOLUME, 'repositoryQuotaBytes': QUOTA, 'hostAvailableBytes': available,
            'retentionCapacityAccepted': False, 'testedToolingImageId': image,
            'emailRecipient': 'itsg.notification@sscgi.com', 'emailTransportConfigured': False,
            'smtpServer': 'smtp.office365.com', 'smtpPort': 587,
            'smtpUsername': 'itsg.notification@sscgi.com',
            'smtpPasswordFile': str(DEST / 'notification/smtp.password'),
            'hostAdministratorRequired': True, 'openbaoAccess': False,
            'repositoryInitialization': False, 'schedulingEnabled': False}


def install(configuration):
    global stage
    if os.geteuid() != 0:
        raise RuntimeError('host_administrator_required_no_changes_made')
    uid, gid = configuration['uid'], configuration['gid']
    stage = 'service_identity'
    command(['groupadd', '--system', '--gid', str(gid), ACCOUNT])
    command(['useradd', '--system', '--uid', str(uid), '--gid', str(gid), '--no-create-home',
             '--home-dir', '/nonexistent', '--shell', '/usr/sbin/nologin', ACCOUNT])
    stage = 'host_directories'
    DEST.mkdir(mode=0o700)
    os.chown(DEST, uid, gid)
    folders = ['server-auth', 'server-tls', 'admin-tls', 'notification', 'client', 'public', 'snapshot-input', 'audit-state', 'encrypted-spool', 'receipts']
    for name in folders:
        path = DEST / name
        path.mkdir(mode=0o700)
        os.chown(path, 0 if name in ('admin-tls', 'notification') else uid, 0 if name in ('admin-tls', 'notification') else gid)
    # From here, partial outcomes remain recorded and require exact reconciliation.
    private(DEST / 'installation-started.json', json.dumps(configuration).encode(), 0, 0)
    stage = 'transport_credentials'
    password = secrets.token_hex(32)
    # -i reads the password on stdin; never place it in argv/Docker environment/logs.
    htpasswd = command(['docker', 'run', '--rm', '-i', '--network', 'none', '--read-only',
                        '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
                        '--tmpfs', '/tmp', '--entrypoint', 'htpasswd', SERVER, '-nBi', '-C', '10', 'uploader'], (password + '\n').encode())
    if not htpasswd.startswith(b'uploader:$2'):
        raise RuntimeError('bcrypt_output_invalid')
    private(DEST / 'server-auth/htpasswd', htpasswd.strip() + b'\n', uid, gid)
    private(DEST / 'client/repository.url', ('rest:https://uploader:' + password + '@rest-server:8000/uploader/\n').encode(), uid, gid)
    # Independent recovery escrow must be confirmed before repository initialization.
    private(DEST / 'client/repository.password', (secrets.token_hex(32) + '\n').encode(), uid, gid)
    stage = 'dedicated_development_tls'
    command(['openssl', 'req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-keyout', str(DEST / 'admin-tls/ca.key'),
             '-out', str(DEST / 'admin-tls/ca.crt'), '-days', '3650', '-subj', '/CN=MyIMS development backup CA',
             '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign'])
    command(['openssl', 'req', '-new', '-newkey', 'rsa:3072', '-nodes', '-keyout', str(DEST / 'server-tls/server.key'),
             '-out', str(DEST / 'admin-tls/server.csr'), '-subj', '/CN=rest-server'])
    private(DEST / 'admin-tls/server.ext', b'subjectAltName=DNS:rest-server\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n', 0, 0)
    command(['openssl', 'x509', '-req', '-in', str(DEST / 'admin-tls/server.csr'), '-CA', str(DEST / 'admin-tls/ca.crt'),
             '-CAkey', str(DEST / 'admin-tls/ca.key'), '-CAcreateserial', '-out', str(DEST / 'server-tls/server.crt'),
             '-days', '365', '-sha256', '-extfile', str(DEST / 'admin-tls/server.ext')])
    for name in ['server.key', 'server.crt']:
        os.chmod(DEST / 'server-tls' / name, 0o600)
        os.chown(DEST / 'server-tls' / name, uid, gid)
    private(DEST / 'client/ca.crt', (DEST / 'admin-tls/ca.crt').read_bytes(), uid, gid)
    stage = 'nonsecret_configuration'
    values = {'MYIMS_BACKUP_UID': uid, 'MYIMS_BACKUP_GID': gid, 'MYIMS_BACKUP_REPOSITORY_BYTES': QUOTA,
              'MYIMS_BACKUP_ROOT': str(DEST), 'MYIMS_BACKUP_VOLUME': VOLUME,
              'MYIMS_BACKUP_NETWORK': 'myims-backup-development_repository',
              # Deliberately absent: no real provider/audit mount is inferred.
              'MYIMS_BACKUP_AUDIT_SOURCE': str(DEST / 'pending-audit-source')}
    private(DEST / 'deployment.env', ''.join(k + '=' + str(v) + '\n' for k, v in values.items()).encode(), 0, 0)
    private(DEST / 'notification/smtp.password', b'', 0, 0)
    private(DEST / 'alert-configuration.json', json.dumps({
        'host': 'smtp.office365.com', 'port': 587, 'security': 'starttls',
        'username': 'itsg.notification@sscgi.com', 'sender': 'itsg.notification@sscgi.com',
        'recipients': ['itsg.notification@sscgi.com'],
        'passwordFile': str(DEST / 'notification/smtp.password')}, indent=2).encode(), 0, 0)
    stage = 'empty_volume_ownership'
    command(['docker', 'run', '--rm', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--cap-add', 'CHOWN',
             '--mount', 'type=volume,src=' + VOLUME + ',dst=/data', '--entrypoint', 'sh', SERVER, '-ec',
             'test -z "$(ls -A /data)"; chown ' + str(uid) + ':' + str(gid) + ' /data'])
    stage = 'isolated_storage_start'
    compose = ['docker', 'compose', '--project-name', 'myims-backup-development', '--env-file', str(DEST / 'deployment.env'), '-f', str(ROOT / 'infra/backup/compose.yaml')]
    command([*compose, 'config', '--quiet'])
    command([*compose, '--profile', 'retained-install', 'up', '-d', '--no-build', '--no-deps', 'rest-server'])
    status = json.loads(command(['docker', 'inspect', 'myims-backup-development-rest-server-1']))[0]
    if not status['State']['Running'] or status['HostConfig']['PortBindings']:
        raise RuntimeError('storage_isolation_failed')
    stage = 'read_only_tls_authentication_probe'
    probe = json.loads(command(['docker', 'run', '--rm', '--network', 'myims-backup-development_repository',
                               '--read-only', '--user', str(uid) + ':' + str(gid), '--cap-drop', 'ALL',
                               '--security-opt', 'no-new-privileges:true',
                               '--mount', 'type=bind,src=' + str(DEST / 'client') + ',dst=/run/client,readonly',
                               '--mount', 'type=bind,src=' + str(ROOT / 'scripts/backup-host/storage-probe.mjs') + ',dst=/probe.mjs,readonly',
                               '--entrypoint', 'node', 'myims-backup-tools:development-candidate', '/probe.mjs']))
    if probe.get('status') != 'passed':
        raise RuntimeError('storage_probe_failed')
    record = {**configuration, 'readOnlyProbe': probe, 'installedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'storageRunning': True, 'repositoryInitialized': False, 'backupReady': False,
              'ageRecipientConfigured': False, 'auditSourceConfigured': False,
              'serverCertificatePemSha256': hashlib.sha256((DEST / 'server-tls/server.crt').read_bytes()).hexdigest(),
              'caCertificatePemSha256': hashlib.sha256((DEST / 'client/ca.crt').read_bytes()).hexdigest()}
    private(DEST / 'installation-completed.json', json.dumps(record, indent=2).encode(), 0, 0)
    return record


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--install', action='store_true')
    args = parser.parse_args()
    os.umask(0o077)
    try:
        if args.install and os.geteuid() != 0:
            raise RuntimeError('host_administrator_required_no_changes_made')
        configuration = plan()
        print(json.dumps(install(configuration) if args.install else configuration, indent=2))
    except Exception as error:
        code = str(error) if isinstance(error, RuntimeError) else type(error).__name__
        print(json.dumps({'status': 'failed', 'stage': stage, 'code': code, 'automaticRollback': False}), file=sys.stderr)
        sys.exit(1)
