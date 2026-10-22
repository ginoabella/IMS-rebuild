#!/usr/bin/env python3
"""Attended one-operation development capture. Explicit --execute only; no startup hook.

No key, root token or raw inventory is transported to this host process. Root stays
in the isolated helper tmpfs. Host logs contain sanitized statuses and hashes only.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / 'infra/backup/recovery-capture-request.json'
STATUS = ROOT / 'docs/status/p3-u3a-development-capture-execution.json'
OPERATION = '24096f3d-bf41-4ec2-9e12-95e2057c115d'


def capture_flow(p):
    """No capture failure skips root cleanup; no uncertain cleanup cancels guard."""
    p.initialize()
    p.arm()
    p.isolate()
    try:
        p.unseal()
    except Exception:
        p.restore_without_unseal()
        raise
    capture_error = None
    try:
        p.recover()
        p.capture()
    except Exception as error:
        capture_error = error
    finally:
        # The same operation's finisher is the only allowed root cleanup.
        p.finish()
    p.restore()
    p.cancel_guard()
    p.close_helpers()
    if capture_error is None:
        p.archive_baseline()
    p.archive_audit()
    if capture_error is not None:
        raise RuntimeError('capture_incomplete_but_root_cleanup_and_restoration_verified')


class Executor:
    def __init__(self):
        self.m = json.loads(MANIFEST.read_text())
        self.op = self.m['operationId']
        self.image = self.m['candidateToolsImage']['imageId']
        self.env = {**os.environ, 'MYIMS_OPENBAO_RECOVERY_OPERATION': self.op}
        self.base = ['docker', 'compose', '-p', 'myims-rebuild-dev', '-f', 'infra/docker/compose.yaml', '-f', 'infra/docker/compose.credentials.yaml']
        self.cap = ['docker', 'compose', '-f', 'infra/backup/compose.recovery-capture.yaml']
        self.provider = self.m['currentProviderDockerMetadata']['name']
        self.normal_network = 'myims-rebuild-dev_endpoint-credentials'
        self.isolated_network = 'myims-rebuild-dev_openbao-recovery'
        self.backup_network = 'myims-backup-development_repository'
        self.backup_root = Path('/srv/myims-backup-development')
        self.recovery_overlay = 'infra/docker/compose.openbao-recovery.yaml'
        self.restoration_overlay = 'infra/docker/compose.openbao-restoration.yaml'
        self.work = ROOT / '.local/recovery-capture' / self.op
        self.guard = None
        self.helper = None
        self.record = json.loads(STATUS.read_text())
        self.record.update({'phase': 'host_preflight', 'status': 'in-progress', 'events': [], 'rootRevocationVerified': False, 'normalRestorationVerified': False})

    def save(self, phase, **values):
        self.record.update(values)
        self.record['phase'] = phase
        self.record['events'].append({'phase': phase, 'at': dt.datetime.now(dt.timezone.utc).isoformat()})
        STATUS.write_text(json.dumps(self.record, indent=2) + '\n')
        print(json.dumps({'phase': phase, 'operationId': self.op}), flush=True)

    def run(self, args, timeout=45, check=True):
        result = subprocess.run(args, cwd=ROOT, env=self.env, capture_output=True, timeout=timeout)
        if check and result.returncode:
            # Never forward command diagnostics, response bodies or authenticated URLs.
            raise RuntimeError('command_failed_at_' + self.record['phase'])
        return result

    def inspect(self, kind, name):
        return json.loads(self.run(['docker', kind, 'inspect', name]).stdout)[0]

    def validate_provider(self, phase):
        a = self.inspect('container', self.provider)
        expected = self.m['currentProviderDockerMetadata']
        if not a['State']['Running'] or a['Image'] != expected['imageId'] or a['Config']['User'] != '1003:1003':
            raise RuntimeError('provider_identity_or_state')
        h = a['HostConfig']
        if not h['ReadonlyRootfs'] or h['Privileged'] or h['PortBindings'] or h['CapDrop'] != ['ALL'] or 'no-new-privileges:true' not in h['SecurityOpt']:
            raise RuntimeError('provider_hardening')
        isolation = phase == 'isolated'
        normal = phase == 'before'
        network = self.isolated_network if isolation else self.normal_network
        if list(a['NetworkSettings']['Networks']) != [network] or not self.inspect('network', network)['Internal']:
            raise RuntimeError('provider_network')
        restart = 'unless-stopped' if normal else 'no'
        if h['RestartPolicy']['Name'] != restart:
            raise RuntimeError('provider_restart_policy')
        labels = a['Config']['Labels']
        if (normal and 'myims.openbao.recovery.operation' in labels) or (not normal and labels.get('myims.openbao.recovery.operation') != self.op):
            raise RuntimeError('provider_operation_ownership')
        mounts = [{'type': v['Type'], 'name': v.get('Name'), 'source': v['Source'], 'destination': v['Destination'], 'readWrite': v['RW']} for v in a['Mounts']]
        wanted = [dict(v) for v in expected['mounts']]
        if isolation:
            next(v for v in wanted if v['destination'] == '/bao/config/server.hcl')['source'] = str(self.work / 'recovery.hcl')
        if sorted(mounts, key=lambda v: v['destination']) != sorted(wanted, key=lambda v: v['destination']):
            raise RuntimeError('provider_mounts')
        return a

    def preflight(self):
        if (self.op != OPERATION or not self.m['retainedExecutionAuthorized'] or not self.m['rootRecoveryAuthorized'] or
                not self.m['repositoryInitializationAuthorized'] or self.m['ownerApproval']['consumed'] or self.m['ownerApproval']['executionStarted']):
            raise RuntimeError('approval_not_available')
        for name in ['policyAuthRoleWritesAuthorized', 'snapshotIdentityProvisioningAuthorized', 'custodianChangeAuthorized', 'productionAuthorized', 'destructiveCleanupAuthorized']:
            if self.m[name]:
                raise RuntimeError('unexpected_authority')
        if not self.m['hostAccessDependency']['stagingPrepared'] or self.work.exists():
            raise RuntimeError('staging_or_existing_execution')
        for name, digest in self.m['artifacts'].items():
            if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != digest:
                raise RuntimeError('reviewed_artifact_changed')
        evidence = json.loads((ROOT / 'docs/status/p3-u3a-repository-initializer-evidence.json').read_text())
        if evidence['status'] != 'passed' or evidence['initializerSha256'] != hashlib.sha256((ROOT / 'scripts/backup/repository-initialize.mjs').read_bytes()).hexdigest():
            raise RuntimeError('initializer_native_evidence')
        controller_evidence = json.loads((ROOT / 'docs/status/p3-u3a-native-controller-evidence.json').read_text())
        if (controller_evidence['status'] != 'passed' or not all(controller_evidence['cleanup'].values()) or
                controller_evidence['controllerSha256'] != hashlib.sha256(Path(__file__).read_bytes()).hexdigest()):
            raise RuntimeError('controller_native_evidence')
        self.validate_provider('before')
        server = self.inspect('container', 'myims-backup-development-rest-server-1')
        if (server['Image'] != 'sha256:d2aff06f47eb38637dff580c3e6bce4af98f386c396a25d32eb6727ec96214a5' or
                not server['State']['Running'] or server['Config']['User'] != '12010:12010' or
                list(server['NetworkSettings']['Networks']) != ['myims-backup-development_repository'] or
                not server['HostConfig']['ReadonlyRootfs'] or server['HostConfig']['PortBindings'] or
                '--append-only' not in server['Config']['Cmd'] or '--max-size=2147483648' not in server['Config']['Cmd']):
            raise RuntimeError('backup_service_preflight')
        host = server['HostConfig']
        if (host['Privileged'] or host['Memory'] != 268435456 or host['PidsLimit'] != 64 or
                host['CapDrop'] != ['ALL'] or 'no-new-privileges:true' not in host['SecurityOpt'] or
                host['RestartPolicy']['Name'] != 'no' or not self.inspect('network', self.backup_network)['Internal'] or
                not all(flag in server['Config']['Cmd'] for flag in ['--private-repos', '--tls', '--tls-min-ver=1.3'])):
            raise RuntimeError('backup_hardening_preflight')
        mounts = {v['Destination']: v for v in server['Mounts']}
        if (set(mounts) != {'/data', '/run/auth', '/run/tls'} or
                mounts['/data'].get('Name') != 'myims-backup-development_repository' or
                mounts['/data']['Type'] != 'volume' or not mounts['/data']['RW']):
            raise RuntimeError('backup_repository_mount')
        for target, leaf in [('/run/auth', 'server-auth'), ('/run/tls', 'server-tls')]:
            if mounts[target]['Source'] != str(self.backup_root / leaf) or mounts[target]['RW']:
                raise RuntimeError('backup_credential_mount')
        if os.statvfs('/srv').f_bavail * os.statvfs('/srv').f_frsize < 2147483648:
            raise RuntimeError('pilot_capacity')
        # Recheck exact private input/output metadata immediately before execution.
        # This process sees booleans and audit length, never seal contents.
        staging = self.m['hostStaging']
        program = "const fs=require('node:fs');for(const p of ['/capture','/baseline','/audit-after']){const s=fs.lstatSync(p);if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==1003||s.gid!==1003||(s.mode&511)!==448||fs.readdirSync(p).length)throw Error()}const k=fs.lstatSync('/seal');if(!k.isFile()||k.isSymbolicLink()||k.uid!==1003||k.gid!==1003||(k.mode&511)!==384||k.nlink!==1||k.size<1||k.size>16384)throw Error();const a=fs.lstatSync('/audit/endpoint.json');if(!a.isFile()||a.isSymbolicLink()||a.size<1||a.size>134217728)throw Error();console.log(JSON.stringify({emptyStaging:true,sealMetadata:true,sealContentsRead:false,auditBytes:a.size}));"
        command = ['docker', 'run', '--rm', '--network', 'none', '--user', '1003:1003', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true']
        for source, target in [(staging['capture'], '/capture'), (staging['encrypted'], '/baseline'), (staging['auditEncrypted'], '/audit-after'), (str(ROOT / '.local/endpoint-credentials/seal.json'), '/seal')]:
            command += ['--mount', 'type=bind,src=' + source + ',dst=' + target + ',readonly']
        command += ['--mount', 'type=volume,src=myims-rebuild-dev_endpoint-secrets-audit,dst=/audit,readonly', '--entrypoint', 'node', self.image, '-e', program]
        self.record['freshStagingMetadata'] = json.loads(self.run(command).stdout)
        self.record['preflightVerified'] = True

    def initialize(self):
        self.save('repository_initialization')
        self.work.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        for parent in [ROOT / '.local', self.work.parent]:
            value = parent.lstat()
            if not parent.is_dir() or parent.is_symlink() or value.st_uid != os.getuid() or value.st_mode & 0o077:
                raise RuntimeError('host_execution_custody')
        self.work.mkdir(mode=0o700)
        normal = (ROOT / 'infra/openbao/server.hcl').read_text()
        setting = 'disable_unauthed_generate_root_endpoints = true'
        if normal.count(setting) != 1:
            raise RuntimeError('configuration_setting')
        temporary = normal.replace(setting, 'disable_unauthed_generate_root_endpoints = false')
        if hashlib.sha256(temporary.encode()).hexdigest() != self.m['recoveryConfigurationSha256']:
            raise RuntimeError('temporary_configuration_hash')
        with (self.work / 'recovery.hcl').open('x') as output:
            output.write(temporary)
        (self.work / 'recovery.hcl').chmod(0o644)
        self.env['MYIMS_OPENBAO_RECOVERY_CONFIG'] = str(self.work / 'recovery.hcl')
        # This fresh host intent prevents replay even if the launcher fails later.
        with (self.work / 'execution-started.json').open('x') as output:
            json.dump({'operationId': self.op, 'startedAt': dt.datetime.now(dt.timezone.utc).isoformat()}, output)
            output.flush()
            os.fsync(output.fileno())
        # Commit the operation namespace before any provider/repository mutation.
        # A launcher/host interruption must not make this operation appear fresh.
        for path in [self.work, self.work.parent, ROOT / '.local']:
            fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            try:
                os.fsync(fd)
            finally:
                os.close(fd)
        command = ['docker', 'run', '--rm', '--name', 'myims-recovery-repository-init-' + self.op,
                   '--label', 'myims.backup.capture.operation=' + self.op, '--network', self.backup_network,
                   '--user', '12010:12010', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
                   '--tmpfs', '/tmp:mode=1777,size=384m', '--memory', '768m', '--pids-limit', '64',
                   '--mount', 'type=bind,src=' + str(self.backup_root / 'client') + ',dst=/run/client,readonly',
                   '--mount', 'type=bind,src=' + str(self.backup_root / 'receipts') + ',dst=/receipts',
                   '--mount', 'type=bind,src=' + str(ROOT / 'scripts/backup/repository-initialize.mjs') + ',dst=/opt/scripts/backup/repository-initialize.mjs,readonly',
                   '--entrypoint', 'node', self.image, '/opt/scripts/backup/repository-initialize.mjs', self.op]
        result = json.loads(self.run(command, timeout=90).stdout)
        if result.get('status') != 'repository_initialized':
            raise RuntimeError('repository_initialization_unconfirmed')
        self.save('repository_initialized', repositoryInitialized=True, repository=result)

    def arm(self):
        self.save('arming_deadline')
        deadline = dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=840)
        self.guard = json.loads(self.run(['node', 'scripts/openbao/recovery-deadline.mjs', 'start', self.op, deadline.isoformat()]).stdout)
        self.record['deadlineGuard'] = self.guard
        self.assert_guard()

    def assert_guard(self):
        self.run(['node', 'scripts/openbao/recovery-deadline.mjs', 'assert-ready', self.op, self.guard['directory']])

    def isolate(self):
        self.assert_guard()
        self.save('isolating_provider', providerIsolationStarted=True)
        self.run([*self.base, '-f', self.recovery_overlay, 'up', '-d', '--no-deps', '--no-build', '--pull', 'never', 'endpoint-secrets'])
        self.assert_guard()
        self.validate_provider('isolated')
        self.run([*self.cap, 'up', '-d', '--no-deps', '--no-build', '--pull', 'never', 'capture-helper'])
        self.helper = self.run([*self.cap, 'ps', '-q', 'capture-helper']).stdout.decode().strip()
        if len(self.helper) != 64:
            raise RuntimeError('capture_helper_identity')

    def helper_script(self, script, timeout=45):
        return json.loads(self.run(['docker', 'exec', self.helper, 'node', '/opt/scripts/openbao/' + script, self.op], timeout=timeout).stdout)

    def wait_listener(self, restoration=False):
        # Passive TLS status only. Never reads the seal key or authenticates.
        program = "const fs=require('node:fs'),https=require('node:https');const r=https.get('https://endpoint-secrets:8200/v1/sys/seal-status',{ca:fs.readFileSync('/seal/ca.crt')},s=>{let d='';s.on('data',b=>{d+=b;if(d.length>32768)r.destroy()});s.on('end',()=>{try{const v=JSON.parse(d);if(s.statusCode!==200||v.initialized!==true||typeof v.sealed!=='boolean')throw Error();console.log(JSON.stringify({ready:true}))}catch{process.exitCode=1}})});r.setTimeout(2000,()=>r.destroy());r.on('error',()=>{process.exitCode=1});"
        for _ in range(20):
            self.assert_guard()
            cmd = [*self.cap, 'run', '--rm', '--no-deps', '--entrypoint', 'node', 'restoration-helper', '-e', program] if restoration else ['docker', 'exec', self.helper, 'node', '-e', program]
            if self.run(cmd, timeout=15, check=False).returncode == 0:
                return
            time.sleep(.3)
        raise RuntimeError('passive_tls_listener_not_ready')

    def unseal(self):
        self.save('initial_unseal')
        self.wait_listener()
        result = json.loads(self.run(['docker', 'exec', self.helper, 'node', '/opt/scripts/openbao/recovery-unseal.mjs', 'unseal'], timeout=115).stdout)
        if result.get('state') != 'unsealed_active':
            raise RuntimeError('initial_unseal_unconfirmed')
        self.save('initial_unseal_verified', retainedKeyUsabilityVerified=True)

    def recover(self):
        self.assert_guard()
        self.save('one_root_generation_attempt', rootGenerationAttempted=True)
        self.m['ownerApproval']['consumed'] = True
        self.m['ownerApproval']['executionStarted'] = True
        MANIFEST.write_text(json.dumps(self.m, indent=2) + '\n')
        program = "const fs=require('node:fs');process.umask(0o077);fs.writeFileSync('/recovery/confirmed.json',JSON.stringify({operationId:process.argv[1],executeRecovery:true,confirmedAt:new Date().toISOString()}),{mode:0o600,flag:'wx'});"
        self.run(['docker', 'exec', self.helper, 'node', '-e', program, self.op])
        if self.helper_script('recover-custodian.mjs')['state'] != 'recovered_in_tmpfs':
            raise RuntimeError('root_recovery_unconfirmed')

    def capture(self):
        self.assert_guard()
        self.save('native_capture')
        if self.helper_script('recovery-backup.mjs', timeout=240)['state'] != 'backup_and_inventory_preserved':
            raise RuntimeError('capture_unconfirmed')
        self.save('native_capture_complete', captureComplete=True)

    def finish(self):
        self.save('same_operation_root_finalization')
        if self.helper_script('finish-recovery.mjs')['state'] != 'root_revoked':
            raise RuntimeError('root_revocation_unconfirmed')
        self.save('root_revocation_verified', rootRevocationVerified=True)

    def restore(self):
        self.assert_guard()
        self.save('normal_configuration_restoration')
        self.run([*self.base, '-f', self.restoration_overlay, 'up', '-d', '--no-deps', '--no-build', '--pull', 'never', 'endpoint-secrets'])
        self.assert_guard()
        self.validate_provider('restored')
        self.wait_listener(restoration=True)
        for action, expected in [('unseal', 'unsealed_active'), ('verify-protected', 'protected_active_generation_denied')]:
            result = json.loads(self.run([*self.cap, 'run', '--rm', '--no-deps', 'restoration-helper', action], timeout=115).stdout)
            if result.get('state') != expected:
                raise RuntimeError('normal_protection_unconfirmed')
        self.assert_guard()
        self.save('normal_restoration_verified', normalRestorationVerified=True)

    def restore_without_unseal(self):
        # A rejected/uncertain initial key operation never causes another key
        # request. Restore protected HCL/network and leave availability unresolved.
        self.assert_guard()
        self.save('protected_restoration_without_another_key_attempt')
        self.run([*self.base, '-f', self.restoration_overlay, 'up', '-d', '--no-deps', '--no-build', '--pull', 'never', 'endpoint-secrets'])
        self.validate_provider('restored')
        self.save('protected_configuration_restored_availability_unconfirmed', protectedConfigurationRestored=True)

    def cancel_guard(self):
        if not self.record['rootRevocationVerified'] or not self.record['normalRestorationVerified']:
            raise RuntimeError('unsafe_guard_cancellation')
        self.run(['node', 'scripts/openbao/recovery-deadline.mjs', 'cancel', self.op, self.guard['directory']])
        self.save('deadline_cancelled', deadlineCancelled=True)
        self.run(['docker', 'update', '--restart=unless-stopped', self.provider])
        if self.inspect('container', self.provider)['HostConfig']['RestartPolicy']['Name'] != 'unless-stopped':
            raise RuntimeError('normal_restart_policy_unconfirmed')
        self.save('normal_restart_policy_restored', normalRestartPolicyRestored=True)

    def close_helpers(self):
        self.run(['docker', 'rm', '-f', self.helper])
        self.save('revoked_root_helper_removed', captureHelperRemoved=True)
        network = self.isolated_network
        if self.inspect('network', network)['Containers']:
            raise RuntimeError('unexpected_recovery_network_member')
        self.run(['docker', 'network', 'rm', network])

    def archive_baseline(self):
        self.save('offline_baseline_encryption')
        result = json.loads(self.run([*self.cap, 'run', '--rm', '--no-deps', 'archive-capture'], timeout=120).stdout)
        if result.get('status') != 'passed':
            raise RuntimeError('baseline_encryption_unconfirmed')
        self.save('baseline_encrypted', baselineArchive=result)

    def archive_audit(self):
        self.save('offline_post_cleanup_audit_encryption')
        result = json.loads(self.run([*self.cap, 'run', '--rm', '--no-deps', 'archive-audit'], timeout=120).stdout)
        if result.get('status') != 'passed':
            raise RuntimeError('audit_encryption_unconfirmed')
        self.save('audit_encrypted', postCleanupAuditArchive=result)

    def contain_failure(self):
        if self.guard and not self.record.get('deadlineCancelled'):
            # Signal only our exact detached guard; it stops its exact labeled provider.
            try:
                self.assert_guard()
                os.kill(self.guard['watcherPid'], signal.SIGTERM)
                self.record['containmentRequested'] = True
            except Exception:
                # Expiry can race a Compose replacement. Independently contain
                # only this exact approved name/image/operation, never a guessed ID.
                current = self.inspect('container', self.provider)
                if (current['Image'] != self.m['currentProviderDockerMetadata']['imageId'] or
                        current['Config']['Labels'].get('myims.openbao.recovery.operation') != self.op):
                    raise RuntimeError('containment_ownership_uncertain')
                if current['State']['Running']:
                    self.run(['docker', 'stop', '--time', '5', current['Id']], timeout=20)
                self.record['exactOperationProviderStopped'] = not self.inspect('container', self.provider)['State']['Running']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    os.umask(0o077)
    p = Executor()
    execution_started = False
    try:
        p.preflight()
        if not args.execute:
            print(json.dumps({'status': 'host_preflight_passed', 'operationId': p.op, 'providerChanged': False, 'repositoryInitialized': False}))
            return 0
        execution_started = True
        capture_flow(p)
        p.save('awaiting_ciphertext_handoff', status='capture-encrypted-awaiting-administrator-handoff', plaintextStagingPreserved=True)
        return 0
    except Exception as error:
        if not execution_started:
            # Refusing a consumed/stale approval must preserve the completed
            # operation's evidence instead of replacing it with a fresh failure.
            print(json.dumps({'status': 'preflight_refused_no_execution', 'operationId': p.op, 'existingEvidenceChanged': False, 'automaticRetry': False}))
            return 1
        try:
            p.contain_failure()
        except Exception:
            p.record['containmentUnconfirmed'] = True
        code = str(error) if isinstance(error, RuntimeError) else type(error).__name__
        p.save('stopped', status='stopped-requires-attended-review', failureCode=code, automaticRetry=False)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
