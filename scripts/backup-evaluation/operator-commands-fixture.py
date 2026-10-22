"""Extra disposable checks called only with the native TLS/Raft fixture's objects.
Host UID changes use a narrowly mounted helper because the test driver is not root.
No retained configuration, paths or credentials are used.
"""
import importlib.util
import json
import os
from pathlib import Path
import uuid


def exercise(root, work, config, controller, helper, check):
    spec = importlib.util.spec_from_file_location('operator_fixture_commands', root/'scripts/backup-host/backup-operations.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    spec2 = importlib.util.spec_from_file_location('operator_fixture_ports', root/'scripts/backup-host/bootstrap-host-ports.py')
    ports_module = importlib.util.module_from_spec(spec2)
    spec2.loader.exec_module(ports_module)
    runtime = work/'operator-runs'
    runtime.mkdir(mode=0o700)
    # Synthetic password has exactly the real owner's file custody. Helper reads
    # the existing fixture value without printing or copying it into test output.
    helper('operator-password-owner', ['-e', "const fs=require('node:fs');fs.chownSync('/password',1002,1002)"],
           ['-v',str(work/'maintenance/password')+':/password'], user='0:0', caps=['CHOWN'])
    request = {'candidateToolsImage':{'imageId':controller.image}, 'repositoryId':config['repositoryId'],
               'credentialHandoff':{'operatorTarget':str(work/'maintenance/password')}}

    class FixtureCommands(module.Commands):
        def directory(self, name, uid):
            path = self.work/name
            path.mkdir(mode=0o700)
            helper('operator-own-'+name, ['-e', "require('node:fs').chownSync('/owned',Number(process.argv[1]),Number(process.argv[1]))",str(uid)],
                   ['-v',str(path)+':/owned'], user='0:0', caps=['CHOWN'])
            return str(path)

        def ports(self):
            mounted = {**config, 'journal':str(self.work/'journal')}
            self.p = ports_module.HostPorts(self, mounted, lambda:None)
            self.p.journal = module.load('bootstrap-controller').Journal(mounted['journal'], self.op)
            return self.p

        def adopt_credential_custody(self, candidate):
            helper('operator-adopt', ['-e', "const fs=require('node:fs');for(const p of ['/candidate/approle.json','/candidate/ca.crt','/candidate']){const fd=fs.openSync(p,'r');fs.fchownSync(fd,1003,1003);fs.fsyncSync(fd);fs.closeSync(fd)}"],
                   ['-v',candidate+':/candidate'],user='0:0',caps=['CHOWN','DAC_OVERRIDE'])

    command = FixtureCommands(request, {}, runtime)
    command.normal_network, command.backup_network = controller.normal_network, controller.backup_network
    spawned = []

    def start(name):
        command.op = str(uuid.uuid4())
        command.work = runtime/command.op
        command.work.mkdir(mode=0o700)
        command.record = {'command':name,'operationId':command.op}

    active = {'credentials':config['snapshotCredentials'], 'accessorFile':str(work/'install-state/snapshot-secret.json')}
    try:
        start('run-now')
        first = command.backup(active)
        spawned.extend(command.p.containers)
        check('operator_run_now_scoped_capture_encryption_exact_retrieval',first['status']=='backup-retrieved' and first['exactSnapshotFileCount']==4)
        start('credential-rotate')
        rotated = command.rotate(active)
        spawned.extend(command.p.containers)
        check('operator_rotation_verified_adopted_retired_and_both_human_sessions_revoked', rotated['status']=='credentials-rotated' and rotated['previousLoginDenied'] and rotated['maintenanceRevoked403'])
        new = command.generation()
        check('operator_atomic_active_pointer_preserves_previous_custody',new['operationId']==command.op and Path(active['credentials']).exists())
        start('run-now')
        second = command.backup(new)
        spawned.extend(command.p.containers)
        check('operator_rotated_identity_produces_distinct_retrieved_snapshot',second['status']=='backup-retrieved' and second['snapshotId']!=first['snapshotId'])
        check('operator_commands_no_root_recovery_or_scheduling', 'rootGenerationAttempted' not in command.record and 'deadlineGuard' not in command.record)
        return spawned
    finally:
        # --rm helpers normally are already gone; include exact names for the
        # outer fixture cleanup even when a command fails midway.
        if hasattr(command,'p'):
            spawned.extend(command.p.containers)
        controller.record['operatorFixtureContainers']=spawned
