#!/usr/bin/env python3
"""Explicit development backup commands. No timer, root recovery, init or retry.

status is read-only. Mutations default to a plan and require --execute plus an
attended host administrator. Runtime state is outside the application/checkout.
"""
import argparse
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import fcntl
import hashlib
import importlib.util
import json
import os
import re
from pathlib import Path
import stat
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = Path('/srv/myims-openbao-recovery-development/backup-operations')
REQUEST = ROOT / 'infra/backup/bootstrap-request.json'


def load(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def sync(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def write(path, value, replace=False):
    """Exclusive durable write; replacement uses a new file and directory fsync."""
    path = Path(path)
    destination = path.with_name(path.name + '.' + str(uuid.uuid4()) + '.tmp') if replace else path
    fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(value, stream)
            stream.flush()
            os.fsync(stream.fileno())
    except BaseException:
        raise
    if replace:
        os.replace(destination, path)
    sync(path.parent)


def private_directory(path, uid=0):
    s = Path(path).lstat()
    if not stat.S_ISDIR(s.st_mode) or (s.st_uid, s.st_gid, stat.S_IMODE(s.st_mode)) != (uid, uid, 0o700):
        raise ValueError('directory_custody')


def read_record(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        s = os.fstat(fd)
        if not stat.S_ISREG(s.st_mode) or s.st_nlink != 1 or s.st_mode & 0o077 or s.st_size > 65536:
            raise ValueError('record_custody')
        value = os.read(fd, 65537)
        if len(value) != s.st_size:
            raise ValueError('record_changed')
        return json.loads(value)
    finally:
        os.close(fd)


def context():
    request = json.loads(REQUEST.read_text())
    evidence = json.loads(Path(request['statusOutput']).read_text())
    handoff = json.loads((ROOT / 'docs/status/p3-u3a-bootstrap-maintenance-handoff.json').read_text())
    if (evidence.get('status') != 'installed-and-both-backups-retrieved' or
            handoff.get('status') != 'maintenance-password-handed-off' or
            evidence['operationId'] != request['operationId'] or handoff['operationId'] != request['operationId'] or
            not all(evidence.get(k) is True for k in ['rootRevocationVerified', 'normalRestorationVerified', 'deadlineCancelled']) or
            not request['ownerApproval']['consumed']):
        raise ValueError('bootstrap_not_closed')
    return request, evidence


def duration_seconds(value):
    match = re.fullmatch(r'([1-9][0-9]*)([smhd])', str(value))
    if not match:
        raise ValueError('credential_lifetime_unconfirmed')
    return int(match[1]) * {'s':1, 'm':60, 'h':3600, 'd':86400}[match[2]]


def credential_lifetime(active):
    # Rotations verify the issued SecretID TTL by accessor lookup before adoption.
    # The initial generation must additionally respect its source-bound mount cap.
    value = active.get('secretIdTtlSeconds', 2592000)
    if type(value) is not int or not 0 < value <= 2592000:
        raise ValueError('credential_lifetime_unconfirmed')
    return timedelta(seconds=value)


def initial_generation(request, evidence):
    # Use the earlier operation start as a conservative local age bound. This is
    # not a live SecretID lookup and does not claim remaining provider use count.
    writes = {item['path']:item.get('body') for item in request['candidate']['writes']}
    maximum = duration_seconds(writes['sys/auth/platform-backup']['config']['max_lease_ttl'])
    intended = duration_seconds(writes['auth/platform-backup/role/platform-raft-snapshot-reader']['secret_id_ttl'])
    return {'operationId': request['operationId'], 'credentials': request['directories']['snapshotCredentials'],
            'secretIdTtlSeconds':min(maximum, intended),
            'accessorFile': request['directories']['installState'] + '/snapshot-secret.json',
            'createdAt': evidence['events'][0]['at']}


@contextmanager
def exclusive(runtime):
    private_directory(runtime)
    fd = os.open(runtime / 'operation.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        s = os.fstat(fd)
        if not stat.S_ISREG(s.st_mode) or (s.st_uid, s.st_gid, stat.S_IMODE(s.st_mode), s.st_nlink) != (0, 0, 0o600, 1):
            raise ValueError('lock_custody')
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError('operation_in_progress') from None
        if os.path.lexists(runtime / 'pending.json'):
            raise ValueError('unresolved_operation_no_retry')
        yield
    finally:
        os.close(fd)


class Commands:
    def __init__(self, request, evidence, runtime=RUNTIME):
        self.request, self.evidence, self.runtime = request, evidence, Path(runtime)
        self.image = request['candidateToolsImage']['imageId']
        self.normal_network = 'myims-rebuild-dev_endpoint-credentials'
        self.backup_network = 'myims-backup-development_repository'

    def run(self, args, timeout=240, check=True):
        result = subprocess.run(args, capture_output=True, timeout=timeout, cwd=ROOT)
        if check and result.returncode:
            raise RuntimeError('helper_unconfirmed')
        return result

    def preflight(self):
        for name, expected in self.request['artifacts'].items():
            if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != expected:
                raise ValueError('bootstrap_dependency_source_changed')
        current = json.loads(self.run(['docker', 'inspect', self.request['currentProviderDockerMetadata']['name']]).stdout)[0]
        expected = self.request['currentProviderDockerMetadata']
        mounts = [{'type': m['Type'], 'name': m.get('Name'), 'source': m['Source'],
                   'destination': m['Destination'], 'readWrite': m['RW']} for m in current['Mounts']]
        if sorted(mounts, key=lambda m:m['destination']) != sorted(expected['mounts'], key=lambda m:m['destination']):
            raise ValueError('provider_mount_drift')
        load('bootstrap-controller').validate_closed_provider(current, {'name': expected['name'], 'imageId': expected['imageId'],
            'network': self.normal_network, 'mounts': current['Mounts']}, self.evidence)
        server = json.loads(self.run(['docker', 'inspect', 'myims-backup-development-rest-server-1']).stdout)[0]
        h = server['HostConfig']
        if (server['Image'] != 'sha256:d2aff06f47eb38637dff580c3e6bce4af98f386c396a25d32eb6727ec96214a5' or
                not server['State']['Running'] or server['Config']['User'] != '12010:12010' or
                not h['ReadonlyRootfs'] or h['Privileged'] or h['PortBindings'] or h['CapDrop'] != ['ALL'] or
                'no-new-privileges:true' not in h['SecurityOpt'] or
                list(server['NetworkSettings']['Networks']) != [self.backup_network] or
                any(flag not in server['Config']['Cmd'] for flag in ['--append-only', '--private-repos', '--tls', '--tls-min-ver=1.3', '--max-size=2147483648'])):
            raise ValueError('repository_service_drift')
        for network in [self.normal_network, self.backup_network]:
            if not json.loads(self.run(['docker', 'network', 'inspect', network]).stdout)[0]['Internal']:
                raise ValueError('network_not_private')
        if os.statvfs('/srv').f_bavail * os.statvfs('/srv').f_frsize < 2147483648:
            raise ValueError('capacity')

    def generation(self):
        path = self.runtime / 'active.json'
        if os.path.lexists(path):
            active = read_record(path)
            operation = str(uuid.UUID(active['operationId']))
            base = self.runtime / operation
            if active['credentials'] != str(base / 'credentials') or active['accessorFile'] != str(base / 'rotation-state/accessor.json'):
                raise ValueError('active_generation_scope')
            return active
        return initial_generation(self.request, self.evidence)

    def status(self):
        value = {'status': 'development-backup-status', 'bootstrapComplete': True,
                 'schedulingActive': False, 'schedulingReadiness': 'incomplete',
                 'providerApiAccessed': False, 'credentialContentsRead': False,
                 'remainingUseCount': 'unknown', 'externalAlertDelivery': 'not-performed'}
        try:
            self.preflight()
            value['hostMetadata'] = 'verified'
        except Exception:
            value['hostMetadata'] = 'unconfirmed'
        # The root-owned enclosing directory hides even the existence of runtime
        # records. Never interpret an inaccessible path as an unused installation.
        if os.geteuid() != 0:
            value.update(runtimeState='administrator-required', attentionRequired=True,
                lastBootstrapRetrievalAt=self.evidence['events'][-1]['at'])
            return value
        try:
            if self.runtime.exists():
                private_directory(self.runtime)
            active = self.generation()
            origin = datetime.fromisoformat(active['createdAt'])
            now = datetime.now(timezone.utc)
            if origin.tzinfo is None or origin > now:
                raise ValueError('generation_clock')
            value.update(credentialGeneration=active['operationId'],
                rotationReminderDue=now >= origin + min(timedelta(days=23), credential_lifetime(active)),
                credentialAgeLimitReached=now >= origin + credential_lifetime(active),
                credentialAgeBasis='conservative-local-issuance-and-ttl-bound',
                credentialLifetimeSeconds=int(credential_lifetime(active).total_seconds()),
                pendingOperation=(read_record(self.runtime / 'pending.json') if (self.runtime / 'pending.json').exists() else None),
                lastOperation=(read_record(self.runtime / 'last.json') if (self.runtime / 'last.json').exists() else None),
                lastSuccessfulBackup=(read_record(self.runtime / 'last-backup.json') if (self.runtime / 'last-backup.json').exists() else {
                    'snapshotId':self.evidence['postinstallBackup']['snapshotId'],
                    'retrievedAt':self.evidence['events'][-1]['at'], 'source':'bootstrap'}),
                lastBootstrapRetrievalAt=self.evidence['events'][-1]['at'])
        except PermissionError:
            value['runtimeState'] = 'administrator-required'
        except Exception:
            value['runtimeState'] = 'unconfirmed'
        value['attentionRequired'] = (value['hostMetadata'] != 'verified' or 'runtimeState' in value or
            bool(value.get('pendingOperation')) or bool(value.get('rotationReminderDue')) or
            bool(value.get('credentialAgeLimitReached')) or
            (value.get('lastOperation') or {}).get('status') == 'requires-attended-reconciliation-no-retry')
        return value

    def save(self, phase, **metadata):
        self.record.update(metadata)
        self.record['phase'] = phase
        self.record['updatedAt'] = datetime.now(timezone.utc).isoformat()
        write(self.work / 'status.json', self.record, replace=True)

    def directory(self, name, uid):
        path = self.work / name
        path.mkdir(mode=0o700)
        os.chown(path, uid, uid)
        sync(self.work)
        return str(path)

    def ports(self):
        config = {'scripts': str(ROOT / 'scripts'), 'repositoryId': self.request['repositoryId'],
                  'client': '/srv/myims-backup-development/client',
                  'recipient': '/srv/myims-backup-development/public/recipient.txt',
                  'auditVolume': 'myims-rebuild-dev_endpoint-secrets-audit',
                  'journal': str(self.work / 'journal')}
        self.p = load('bootstrap-host-ports').HostPorts(self, config, lambda:None)
        self.p.journal = load('bootstrap-controller').Journal(config['journal'], self.op)
        return self.p

    def repository_check(self, ports):
        result = ports._container('existing-repository', 'backup/repository-check.mjs', [self.request['repositoryId']],
            [(ports.config['client'], '/run/client', True, 'bind')], network=self.backup_network, user='12010:12010')
        if result.get('status') != 'existing-repository-verified':
            raise ValueError('repository_unconfirmed')

    def backup(self, active):
        p = self.ports()
        p.config.update({k:self.directory(name, uid) for k,name,uid in [
            ('postSnapshot','snapshot',1003),('postEncrypted','encrypted',1003),('postAudit','audit',1003),
            ('snapshotState','capture-state',1003),('postinstallSpool','spool',12010),('receipts','receipts',12010)]})
        p.config['snapshotCredentials'] = active['credentials']
        self.repository_check(p)
        p.archive_post_cleanup_audit()
        p.capture_post_install()
        return {'status':'backup-retrieved', 'snapshotId':self.record['postinstallBackup']['snapshotId'],
                'retrievedAt':datetime.now(timezone.utc).isoformat(), 'exactSnapshotFileCount':4,
                'tokenCleanupConfirmed':True}

    def rotation_helper(self, action, active, candidate):
        mounts = [(active['credentials'], '/current', True, 'bind'),
            (self.request['credentialHandoff']['operatorTarget'], '/password', True, 'bind'),
            (str(self.work / 'rotation-state'), '/stage', False, 'bind')]
        if action == 'issue':
            mounts += [(candidate, '/candidate', False, 'bind')]
        else:
            mounts += [(active['accessorFile'], '/old-accessor', True, 'bind')]
        # Root helper has only DAC_OVERRIDE for the two differently owned input
        # files; no seal, installer token, repository credential or data volume.
        return self.p._container('rotation-' + action, 'backup-operations/rotation.mjs', [action], mounts,
            network=self.normal_network, user='0:0', caps=('DAC_OVERRIDE',))

    def rotate(self, active):
        self.ports()
        self.directory('rotation-state', 0)
        candidate = self.directory('credentials', 0)
        result = self.rotation_helper('issue', active, candidate)
        if result.get('status') != 'replacement-verified' or result.get('maintenanceRevoked403') is not True or result.get('workloadRevoked403') is not True:
            raise ValueError('replacement_unconfirmed')
        # Only the verified replacement is adopted. Preserve every old generation.
        self.adopt_credential_custody(candidate)
        generation = {'operationId':self.op, 'credentials':candidate,
                      'accessorFile':str(self.work / 'rotation-state/accessor.json'), 'createdAt':result['createdAt']}
        self.save('replacement_verified_before_adoption')
        write(self.runtime / 'active.json', generation, replace=True)
        self.save('replacement_adopted_previous_retirement_pending')
        retired = self.rotation_helper('retire', active, candidate)
        if retired.get('status') != 'previous-retired' or retired.get('maintenanceRevoked403') is not True or retired.get('oldLoginDenied') is not True:
            raise ValueError('retirement_unconfirmed')
        return {'status':'credentials-rotated', 'newGeneration':self.op, 'previousLoginDenied':True,
                'maintenanceRevoked403':True, 'replacementWorkloadRevoked403':True}

    def adopt_credential_custody(self, candidate):
        # Persist data and final inode custody before publishing the pointer.
        private_directory(candidate)
        if sorted(p.name for p in Path(candidate).iterdir()) != ['approle.json', 'ca.crt']:
            raise ValueError('replacement_files')
        for name in ['approle.json', 'ca.crt']:
            path = Path(candidate) / name
            fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
            try:
                s = os.fstat(fd)
                if not stat.S_ISREG(s.st_mode) or (s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode),s.st_nlink) != (0,0,0o600,1):
                    raise ValueError('replacement_custody')
                os.fchown(fd, 1003, 1003)
                os.fsync(fd)
            finally:
                os.close(fd)
        os.chown(candidate, 1003, 1003)
        sync(candidate)

    def execute(self, command):
        if command not in ['run-now', 'credential-rotate']:
            raise ValueError('command')
        if os.geteuid() != 0:
            raise ValueError('administrator_required')
        # Root-owned real ancestor chain only; never alter installed custody.
        for path in self.runtime.parents:
            s = path.lstat()
            if not stat.S_ISDIR(s.st_mode) or s.st_uid != 0 or s.st_mode & 0o022:
                raise ValueError('runtime_parent_custody')
        if not os.path.lexists(self.runtime):
            self.runtime.mkdir(mode=0o700)
            sync(self.runtime.parent)
        with exclusive(self.runtime):
            self.preflight()
            active = self.generation()
            if command == 'run-now':
                created = datetime.fromisoformat(active['createdAt'])
                if created.tzinfo is None or not timedelta(0) <= datetime.now(timezone.utc)-created < credential_lifetime(active):
                    raise ValueError('rotate_before_capture')
            self.op = str(uuid.uuid4())
            self.work = self.runtime / self.op
            self.work.mkdir(mode=0o700)
            write(self.runtime / 'pending.json', {'operationId':self.op, 'command':command, 'status':'started'})
            self.record = {'operationId':self.op, 'command':command, 'status':'started'}
            try:
                result = self.backup(active) if command == 'run-now' else self.rotate(active)
                self.record.update(result)
                self.save('complete')
                if command == 'run-now':
                    write(self.runtime / 'last-backup.json', {'operationId':self.op, **result}, replace=True)
                write(self.runtime / 'last.json', self.record, replace=True)
                (self.runtime / 'pending.json').unlink()
                sync(self.runtime)
                return {'operationId':self.op, **result, 'schedulingActive':False}
            except BaseException:
                self.record['status'] = 'requires-attended-reconciliation-no-retry'
                self.save('failed_or_interrupted')
                write(self.runtime / 'last.json', self.record, replace=True)
                # Keep pending after any ambiguity. No retry, retirement, rollback,
                # or another run until attended read-only reconciliation.
                raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['status', 'run-now', 'credential-rotate'])
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    try:
        request, evidence = context()
        commands = Commands(request, evidence)
        if args.command == 'status':
            if args.execute:
                raise ValueError('status_is_read_only')
            value = commands.status()
        elif not args.execute:
            value = {'status':'plan-only', 'command':args.command, 'executionEnabled':False,
                     'administratorRequired':True, 'schedulingActive':False, 'automaticRetry':False,
                     'providerAccessed':False, 'credentialContentsRead':False}
        else:
            value = commands.execute(args.command)
        print(json.dumps(value))
    except Exception as error:
        safe = {'administrator_required','operation_in_progress','unresolved_operation_no_retry','rotate_before_capture'}
        print(json.dumps({'status':'operation-unconfirmed', 'code':str(error) if str(error) in safe else 'details-suppressed',
                          'automaticRetry':False, 'schedulingActive':False}))
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
