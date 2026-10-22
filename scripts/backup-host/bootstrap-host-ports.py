"""Operation-bound host adapters for bootstrap_controller.bootstrap_flow.
No CLI, credential reads or provider actions on import/construction. The launcher
must verify authorization, source/image hashes, custody and exact provider state.
"""
from datetime import datetime, timezone
import importlib.util
import hashlib
import json
import re
from pathlib import Path

HERE = Path(__file__).parent

def _module(name, file):
    spec = importlib.util.spec_from_file_location(name, HERE / file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value

core = _module('bootstrap_core_ports', 'bootstrap-controller.py')
bridge = _module('bootstrap_guard_bridge_ports', 'guard-bridge.py')


class HostPorts:
    def __init__(self, controller, config, prepare):
        self.c, self.config, self.prepare_adapter = controller, config, prepare
        self.operation, self.repository_id = controller.op, config['repositoryId']
        self.containers, self.pre_receipts, self.post_receipts = [], [], []
        self.proof = None
        self.stage_sequence = 0
        self.guard_checks = 0

    def __getattr__(self, name):
        return getattr(self.c, name)

    def now(self):
        return datetime.now(timezone.utc)

    def prepare(self):
        self.prepare_adapter()
        if self.config.get('candidatePath') and json.loads(Path(self.config['candidatePath']).read_text())!=self.config['expectedCandidate']:
            raise RuntimeError('candidate_changed')
        self.journal = core.Journal(self.config['journal'], self.operation)
        self.journal.append('existing-repository-required')
        checked=self._container('existing-repository','backup/repository-check.mjs',[self.repository_id],
            [(self.config['client'],'/run/client',True,'bind')],network=self.c.backup_network,user='12010:12010')
        if checked.get('status')!='existing-repository-verified' or checked.get('repositoryId')!=self.repository_id or checked.get('repositoryWrites')!=0:
            raise RuntimeError('existing_repository_unconfirmed')

    def _container(self, stage, script, args, mounts, network='none', user='1003:1003', caps=(), groups=()):
        self.stage_sequence += 1
        name = 'myims-bootstrap-' + self.operation + '-' + str(self.stage_sequence)
        self.containers.append(name)
        command = ['docker', 'run', '--rm', '--name', name, '--log-driver', 'none',
            '--label', 'myims.bootstrap.operation=' + self.operation, '--network', network,
            '--user', user, '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
            '--memory', '768m', '--pids-limit', '64', '--tmpfs', '/tmp:mode=1777,size=384m',
            '--mount', 'type=bind,src=' + self.config['scripts'] + ',dst=/bootstrap,readonly']
        for cap in caps:
            command += ['--cap-add', cap]
        for group in groups:
            command += ['--group-add', group]
        for source, target, readonly, kind in mounts:
            command += ['--mount', 'type=' + kind + ',src=' + str(source) + ',dst=' + target + (',readonly' if readonly else '')]
        command += ['--entrypoint', 'node', self.c.image, '/bootstrap/' + script, *args]
        self.journal.append(stage + '-started')
        self.c.save(stage+'_started')
        response=self.c.run(command,timeout=240,check=False)
        if response.returncode:
            try:
                value=json.loads(response.stderr or response.stdout)
                safe={k:v for k,v in value.items() if k in ['status','stage'] and isinstance(v,str) and re.fullmatch('[a-z_-]{1,80}',v)}
            except Exception:
                safe={'status':'details-suppressed'}
            self.c.save(stage+'_refused',helperCommandFailure=safe)
            raise RuntimeError('bootstrap_stage_refused')
        value = json.loads(response.stdout)
        self.journal.append(stage + '-verified')
        return value

    def _archive(self, command, source, output, stage, kind='bind'):
        result = self._container(stage, 'backup/main.mjs', [command, '/input', '/output', '/recipient', self.operation],
            [(source, '/input', True, kind), (output, '/output', False, 'bind'),
             (self.config['recipient'], '/recipient', True, 'bind')], groups=('12010',))
        if result.get('status') != 'passed':
            raise RuntimeError('archive_unconfirmed')
        return result

    def archive_baseline(self):
        self._archive('archive-recovery', self.config['capture'], self.config['baseline'], 'baseline-encryption')

    def archive_prechange_audit(self):
        self._archive('archive-recovery-audit', self.config['auditVolume'], self.config['preAudit'], 'prechange-audit', 'volume')

    def archive_post_cleanup_audit(self):
        self._archive('archive-recovery-audit', self.config['auditVolume'], self.config['postAudit'], 'post-cleanup-audit', 'volume')

    def _handoff(self, source, stage):
        return self._container(stage + '-handoff', 'backup/ciphertext-handoff.mjs', ['/source', '/spool', self.operation],
            [(source, '/source', True, 'bind'), (self.config[stage + 'Spool'], '/spool', False, 'bind')],
            user='0:0', caps=('CHOWN', 'DAC_OVERRIDE'))

    def _upload(self, stage, receipts):
        mounts = [(self.config[stage + 'Spool'], '/input', True, 'bind'),
                  (self.config['client'], '/run/client', True, 'bind'),
                  (self.config['receipts'], '/receipts', False, 'bind')]
        uploaded = self._container(stage + '-upload', 'backup/main.mjs', ['upload', '/input', '/run/client', '/receipts'],
            mounts, network=self.c.backup_network, user='12010:12010')
        if uploaded.get('status') != 'passed':
            raise RuntimeError('upload_uncertain_no_retry')
        expected = [{k: r[k] for k in ['operationId', 'sha256', 'bytes']} for r in receipts]
        result = self._container(stage + '-retrieval', 'backup/verify-bootstrap-upload.mjs',
            [uploaded['operationId'], self.repository_id, self.operation, json.dumps(expected), stage],
            [(s,t,True,k) for s,t,_,k in mounts], network=self.c.backup_network, user='12010:12010')
        if (result.get('status') != 'uploaded_ciphertext_retrieval_verified' or result.get('repositoryWrites') != 0 or
                result.get('providerAccessed') is not False or result.get('stage') != stage):
            raise RuntimeError('retrieval_unconfirmed')
        self.c.save(stage + '_upload_retrieval_verified', **{stage + 'Backup': result})
        return result

    def capture(self):
        self.captured_at = self.now().isoformat()
        self.c.capture()

    def upload_and_verify(self):
        self.pre_receipts = [self._handoff(self.config['baseline'], 'prechange'), self._handoff(self.config['preAudit'], 'prechange')]
        verified = self._upload('prechange', self.pre_receipts)
        self.proof = {'operationId': self.operation, 'repositoryId': self.repository_id,
            'snapshotId': verified['snapshotId'], 'status': 'retrieval-verified', 'providerWrites': 0,
            'readOnlyVerification': True, 'capturedAt': self.captured_at, 'verifiedAt': self.now().isoformat(),
            'archives': [{**r, 'retrievedSha256': r['sha256'], 'retrievedBytes': r['bytes']} for r in self.pre_receipts]}
        return self.proof

    def record_backup_gate(self, digest):
        self.c.save('backup_gate_verified', backupGateSha256=digest)

    def _action(self, action):
        self.c.assert_guard()
        response = self.c.run(['docker', 'exec', self.c.helper, 'node', self.config['actionScript'], action, self.operation], timeout=180, check=False)
        if response.returncode:
            try:
                error = json.loads(response.stderr)
                refusal = {k:error[k] for k in ['stage','code'] if isinstance(error.get(k),str) and re.fullmatch('[a-z-]{1,80}',error[k])}
            except Exception:
                refusal = {'code':'details-suppressed'}
            self.c.save('helper_refused',helperRefusal=refusal)
            raise RuntimeError('bootstrap_action_refused')
        result = json.loads(response.stdout)
        self.c.assert_guard()
        return result

    def review_prestate(self):
        result = self._action('review')
        if result.get('status') != 'prestate-reviewed':
            raise RuntimeError('prestate_review_unconfirmed')
        self.c.save('semantic_prestate_reviewed', prestateReview=result)

    def install(self, proof):
        def check():
            if self.config.get('candidatePath') and json.loads(Path(self.config['candidatePath']).read_text())!=self.config['expectedCandidate']:
                raise RuntimeError('candidate_changed')
            root=Path(self.config['scripts']).parent
            for name,expected in self.config.get('artifacts',{}).items():
                if hashlib.sha256((root/name).read_bytes()).hexdigest()!=expected:
                    raise RuntimeError('reviewed_source_changed')
            if self.config.get('executionNotAfter') and self.now()>datetime.fromisoformat(self.config['executionNotAfter']):
                raise RuntimeError('execution_window_expired')
            self.c.assert_guard()
            core.backup_gate(proof, self.operation, self.repository_id, self.now())
            self.guard_checks += 1
        result = bridge.guarded_command(['docker', 'exec', '-i', self.c.helper, 'node', self.config['actionScript'], 'install', self.operation],
            self.operation, check)
        self.c.save('nine_writes_acknowledged', installation=result)

    def accept(self):
        if self._action('accept').get('status') != 'bootstrap-acceptance-passed':
            raise RuntimeError('acceptance_unconfirmed')

    def capture_post_install(self):
        result = self._container('scoped-postinstall-capture', 'backup/snapshot.mjs', ['/credentials', '/output', '/state'],
            [(self.config['snapshotCredentials'], '/credentials', True, 'bind'),
             (self.config['postSnapshot'], '/output', False, 'bind'), (self.config['snapshotState'], '/state', False, 'bind')],
            network=self.c.normal_network)
        if result.get('status') != 'passed' or result.get('tokenCleanupConfirmed') is not True:
            raise RuntimeError('postinstall_capture_unconfirmed')
        encrypted = self._container('postinstall-encryption', 'backup/archive-post-install.mjs', ['/input', '/output', '/recipient', self.operation],
            [(self.config['postSnapshot'], '/input', True, 'bind'), (self.config['postEncrypted'], '/output', False, 'bind'),
             (self.config['recipient'], '/recipient', True, 'bind')], groups=('12010',))
        if encrypted.get('status') != 'post-install-encrypted':
            raise RuntimeError('postinstall_encryption_unconfirmed')
        self.post_receipts = [self._handoff(self.config['postEncrypted'], 'postinstall'), self._handoff(self.config['postAudit'], 'postinstall')]
        self._upload('postinstall', self.post_receipts)
