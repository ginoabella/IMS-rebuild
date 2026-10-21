#!/usr/bin/env python3
"""Read-only verification of the approved uninitialized development storage stage."""
import datetime
import hashlib
import json
import pathlib
import pwd
import subprocess
import sys
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
NAME = 'myims-backup-development-rest-server-1'
NETWORK = 'myims-backup-development_repository'
VOLUME = 'myims-backup-development_repository'


def inspect(kind, name):
    return json.loads(subprocess.check_output(['docker', kind, 'inspect', name], stderr=subprocess.DEVNULL, timeout=20))[0]


def verify():
    manifest = json.loads((ROOT / 'infra/backup/review-manifest.json').read_text())
    for path, sha in manifest['artifacts'].items():
        assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == sha
    account = pwd.getpwnam('myims-backup-development')
    assert account.pw_uid > 0 and account.pw_gid > 0 and account.pw_shell == '/usr/sbin/nologin'
    identity = str(account.pw_uid) + ':' + str(account.pw_gid)
    service = inspect('container', NAME)
    config, host = service['Config'], service['HostConfig']
    expected_server = 'restic/rest-server:0.14.0@sha256:d2aff06f47eb38637dff580c3e6bce4af98f386c396a25d32eb6727ec96214a5'
    assert config['Image'] == expected_server and service['Image'] == inspect('image', expected_server)['Id']
    assert not host['Privileged'] and host['Memory'] == 268435456 and host['PidsLimit'] == 64
    assert service['State']['Running'] and config['User'] == identity
    assert host['ReadonlyRootfs'] and not host['PortBindings']
    assert host['RestartPolicy']['Name'] == 'no' and host['CapDrop'] == ['ALL']
    assert 'no-new-privileges:true' in host['SecurityOpt']
    for flag in ['--append-only', '--private-repos', '--tls', '--tls-min-ver=1.3', '--max-size=2147483648']:
        assert flag in config['Cmd']
    assert list(service['NetworkSettings']['Networks']) == [NETWORK]
    assert inspect('network', NETWORK)['Internal']
    assert set(host['Tmpfs']) == {'/tmp'} and 'size=16m' in host['Tmpfs']['/tmp']
    mounts = {m['Destination']: m for m in service['Mounts']}
    assert set(mounts) == {'/data', '/run/auth', '/run/tls'}
    assert mounts['/data']['Name'] == VOLUME and mounts['/data']['Type'] == 'volume'
    assert subprocess.check_output(['docker', 'exec', '--user', identity, NAME, 'stat', '-c', '%u:%g', '/data'], text=True).strip() == identity
    for target, directory in [('/run/auth', 'server-auth'), ('/run/tls', 'server-tls')]:
        assert mounts[target]['Source'] == '/srv/myims-backup-development/' + directory and not mounts[target]['RW']
    image = subprocess.check_output(['docker', 'image', 'inspect', manifest['toolingImage'], '--format', '{{.Id}}'], text=True).strip()
    assert image == manifest['testedToolingImageId']
    operation = str(uuid.uuid4())
    helper = 'myims-backup-storage-check-' + operation[:8]
    command = ['docker', 'run', '--rm', '-i', '--name', helper, '--label', 'myims.backup-verification=' + operation,
               '--network', NETWORK, '--user', identity, '--read-only', '--cap-drop', 'ALL',
               '--security-opt', 'no-new-privileges:true', '--mount',
               'type=bind,src=/srv/myims-backup-development/client,dst=/run/client,readonly',
               '--entrypoint', 'node', manifest['toolingImage'], '-']
    try:
        result = subprocess.run(command, input=(ROOT / 'scripts/backup-host/storage-probe.mjs').read_bytes(), capture_output=True, timeout=90)
        assert result.returncode == 0
        probe = json.loads(result.stdout)
        assert probe['status'] == 'passed' and not probe['repositoryInitialized'] and probe['repositoryWrites'] == 0
    finally:
        subprocess.run(['docker', 'rm', '-f', helper], capture_output=True, timeout=15)
    return {'operationId': operation, 'verifiedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'storageRunning': True, 'serviceIdentity': identity, 'isolationVerified': True,
            'probe': probe, 'openbaoAccess': False, 'backupReady': False,
            'helperAbsent': subprocess.run(['docker', 'inspect', helper], capture_output=True, timeout=15).returncode != 0}


if __name__ == '__main__':
    try:
        evidence = verify()
        (ROOT / 'docs/status/p3-u3a-development-storage-verification.json').write_text(json.dumps(evidence, indent=2) + '\n')
        print(json.dumps(evidence))
    except Exception:
        print(json.dumps({'status': 'failed', 'stage': 'read_only_storage_verification'}), file=sys.stderr)
        sys.exit(1)
