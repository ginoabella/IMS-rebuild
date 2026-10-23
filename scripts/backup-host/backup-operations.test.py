"""Local host-state contracts; provider mutation is exercised separately natively."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('operations', Path(__file__).with_name('backup-operations.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Tests(unittest.TestCase):
    def test_bootstrap_lifetime_respects_mount_ceiling_not_requested_30_days(self):
        request=json.loads(module.REQUEST.read_text())
        evidence={'events':[{'at':'2026-10-22T07:38:00+00:00'}]}
        active=module.initial_generation(request,evidence)
        self.assertEqual(active['secretIdTtlSeconds'],300)
        self.assertEqual(module.credential_lifetime(active).total_seconds(),300)
        for invalid in [0,-1,True,'300',2592001]:
            with self.assertRaises(ValueError):module.credential_lifetime({'secretIdTtlSeconds':invalid})

    def test_status_reports_expired_short_initial_secretid_without_provider_login(self):
        with tempfile.TemporaryDirectory() as d:
            c=module.Commands({'candidateToolsImage':{'imageId':'fixture'}},
                {'events':[{'at':'2026-10-22T00:00:00+00:00'}], 'postinstallBackup':{'snapshotId':'fixture'}},Path(d))
            c.generation=lambda:{'operationId':'fixture','createdAt':'2000-01-01T00:00:00+00:00','secretIdTtlSeconds':300}
            with patch.object(module.os,'geteuid',return_value=0),patch.object(c,'preflight'),patch.object(module,'private_directory'):
                value=c.status()
            self.assertTrue(value['credentialAgeLimitReached'])
            self.assertTrue(value['rotationReminderDue'])
            self.assertTrue(value['attentionRequired'])
            self.assertEqual(value['credentialLifetimeSeconds'],300)
            self.assertFalse(value['providerApiAccessed'])

    def test_nonadministrator_refuses_before_any_host_or_provider_action(self):
        c = module.Commands({'candidateToolsImage':{'imageId':'fixture'}}, {})
        with patch.object(module.os, 'geteuid', return_value=1002), patch.object(c, 'preflight', side_effect=AssertionError('preflight too early')):
            with self.assertRaisesRegex(ValueError, 'administrator_required'):
                c.execute('run-now')

    def test_unprivileged_status_does_not_mistake_hidden_state_for_absence(self):
        c=module.Commands({'candidateToolsImage':{'imageId':'fixture'}}, {'events':[{'at':'2026-10-22T00:00:00+00:00'}]})
        with patch.object(module.os,'geteuid',return_value=1002),patch.object(c,'preflight'),patch.object(module,'read_record',side_effect=AssertionError('private state read')):
            value=c.status()
        self.assertEqual(value['runtimeState'],'administrator-required')
        self.assertTrue(value['attentionRequired'])
        self.assertNotIn('pendingOperation',value)
        self.assertNotIn('credentialGeneration',value)

    def test_symlink_record_refuses_without_reading_target(self):
        with tempfile.TemporaryDirectory() as d:
            base=Path(d); (base/'secret').write_text('not-json-sensitive-value'); (base/'alias').symlink_to(base/'secret')
            with self.assertRaises(OSError):module.read_record(base/'alias')

    def test_exclusive_records_never_overwrite_and_atomic_update_stays_private(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'state.json';module.write(p,{'generation':1})
            with self.assertRaises(FileExistsError):module.write(p,{'generation':2})
            module.write(p,{'generation':3},replace=True)
            self.assertEqual(module.read_record(p),{'generation':3})
            self.assertEqual(p.stat().st_mode&0o777,0o600)
            self.assertEqual(len(list(Path(d).iterdir())),1)

    def test_concurrent_lock_and_durable_pending_refuse_new_operation(self):
        original=module.os.fstat
        def root_metadata(fd):
            s=original(fd)
            return SimpleNamespace(st_uid=0,st_gid=0,st_mode=s.st_mode,st_nlink=s.st_nlink,st_size=s.st_size)
        with tempfile.TemporaryDirectory() as d, patch.object(module,'private_directory'), patch.object(module.os,'fstat',side_effect=root_metadata):
            runtime=Path(d)
            with module.exclusive(runtime):
                with self.assertRaisesRegex(ValueError,'operation_in_progress'):
                    with module.exclusive(runtime):self.fail('second lock acquired')
            module.write(runtime/'pending.json',{'status':'interrupted'})
            with self.assertRaisesRegex(ValueError,'unresolved_operation_no_retry'):
                with module.exclusive(runtime):self.fail('uncertain operation bypassed')

    def setup_rotation(self, root, fault=None):
        c=module.Commands({'candidateToolsImage':{'imageId':'fixture'}}, {}, root)
        c.op='99999999-9999-4999-8999-999999999999';c.work=root/c.op;c.work.mkdir(mode=0o700);c.record={}
        old={'operationId':'old','credentials':'old-protected-directory','accessorFile':'old-accessor','createdAt':'2026-10-22T00:00:00+00:00'}
        module.write(root/'active.json',old)
        phases=[]
        def directory(name,uid):
            p=c.work/name;p.mkdir(mode=0o700);return str(p)
        def helper(action,active,candidate):
            phases.append(action)
            self.assertEqual(active,old)
            if action=='issue':
                self.assertEqual(module.read_record(root/'active.json'),old)
                if fault=='issue':raise RuntimeError('issuance reply lost')
                return {'status':'replacement-verified','maintenanceRevoked403':True,'workloadRevoked403':True,'createdAt':'2026-10-22T01:00:00+00:00'}
            adopted=module.read_record(root/'active.json')
            self.assertEqual(adopted['operationId'],c.op)
            if fault=='retire':raise RuntimeError('retirement reply lost')
            return {'status':'previous-retired','maintenanceRevoked403':True,'oldLoginDenied':True}
        c.ports=lambda:None;c.directory=directory;c.rotation_helper=helper;c.adopt_credential_custody=lambda path:phases.append('custody')
        return c,old,phases

    def test_replacement_adopted_only_after_verification_before_retirement(self):
        with tempfile.TemporaryDirectory() as d:
            c,old,phases=self.setup_rotation(Path(d))
            self.assertEqual(c.rotate(old)['status'],'credentials-rotated')
            self.assertEqual(phases,['issue','custody','retire'])
            self.assertEqual(c.generation()['operationId'],c.op)

    def test_lost_issuance_never_adopts_or_retires(self):
        with tempfile.TemporaryDirectory() as d:
            c,old,phases=self.setup_rotation(Path(d),'issue')
            with self.assertRaises(RuntimeError):c.rotate(old)
            self.assertEqual(phases,['issue']);self.assertEqual(module.read_record(Path(d)/'active.json'),old)

    def test_lost_retirement_preserves_adopted_generation_and_pending_phase(self):
        with tempfile.TemporaryDirectory() as d:
            c,old,phases=self.setup_rotation(Path(d),'retire')
            with self.assertRaises(RuntimeError):c.rotate(old)
            self.assertEqual(c.generation()['operationId'],c.op)
            self.assertEqual(c.record['phase'],'replacement_adopted_previous_retirement_pending')
            self.assertEqual(phases,['issue','custody','retire'])

    def execution_fixture(self, root):
        from contextlib import ExitStack
        c=module.Commands({'candidateToolsImage':{'imageId':'fixture'}}, {}, root/'runtime')
        c.preflight=lambda:None
        from datetime import datetime,timezone
        c.generation=lambda:{'createdAt':datetime.now(timezone.utc).isoformat()}
        original_stat=module.Path.lstat;original_fstat=module.os.fstat
        ancestors={c.runtime,*c.runtime.parents}
        def stat_for_test(path):
            s=original_stat(path)
            if path in ancestors:return SimpleNamespace(st_uid=0,st_gid=0,st_mode=(s.st_mode&~0o777)| (0o700 if path==c.runtime else 0o755))
            return s
        def fstat_for_test(fd):
            s=original_fstat(fd)
            return SimpleNamespace(st_uid=0,st_gid=0,st_mode=s.st_mode,st_nlink=s.st_nlink,st_size=s.st_size)
        stack=ExitStack()
        stack.enter_context(patch.object(module.os,'geteuid',return_value=0))
        stack.enter_context(patch.object(module.Path,'lstat',stat_for_test))
        stack.enter_context(patch.object(module.os,'fstat',fstat_for_test))
        return c,stack

    def test_failure_durably_fences_next_execution_without_retry(self):
        with tempfile.TemporaryDirectory() as d:
            c,stack=self.execution_fixture(Path(d))
            with stack,patch.object(c,'backup',side_effect=RuntimeError('lost upload reply')) as backup:
                with self.assertRaises(RuntimeError):c.execute('run-now')
                self.assertEqual(module.read_record(c.runtime/'last.json')['status'],'requires-attended-reconciliation-no-retry')
                self.assertTrue((c.runtime/'pending.json').exists())
                with self.assertRaisesRegex(ValueError,'unresolved_operation_no_retry'):c.execute('run-now')
                self.assertEqual(backup.call_count,1)

    def test_success_closes_pending_and_preserves_last_successful_backup_across_rotation(self):
        with tempfile.TemporaryDirectory() as d:
            c,stack=self.execution_fixture(Path(d))
            with stack,patch.object(c,'backup',return_value={'status':'backup-retrieved','snapshotId':'fixture','retrievedAt':'2026-10-22T00:00:00+00:00'}),patch.object(c,'rotate',return_value={'status':'credentials-rotated'}):
                c.execute('run-now');saved=module.read_record(c.runtime/'last-backup.json')
                c.execute('credential-rotate')
                self.assertEqual(module.read_record(c.runtime/'last-backup.json'),saved)
                self.assertEqual(module.read_record(c.runtime/'last.json')['status'],'credentials-rotated')
                self.assertFalse((c.runtime/'pending.json').exists())

    def test_short_secretid_refuses_capture_even_before_intended_30_day_cutoff(self):
        from datetime import datetime,timedelta,timezone
        with tempfile.TemporaryDirectory() as d:
            c,stack=self.execution_fixture(Path(d))
            c.generation=lambda:{'createdAt':(datetime.now(timezone.utc)-timedelta(minutes=6)).isoformat(),'secretIdTtlSeconds':300}
            with stack,patch.object(c,'backup',side_effect=AssertionError('expired credential used')):
                with self.assertRaisesRegex(ValueError,'rotate_before_capture'):c.execute('run-now')
                self.assertFalse((c.runtime/'pending.json').exists())

    def test_local_age_limit_refuses_capture_before_any_attempt(self):
        with tempfile.TemporaryDirectory() as d:
            c,stack=self.execution_fixture(Path(d));c.generation=lambda:{'createdAt':'2000-01-01T00:00:00+00:00'}
            with stack,patch.object(c,'backup',side_effect=AssertionError('expired credential used')):
                with self.assertRaisesRegex(ValueError,'rotate_before_capture'):c.execute('run-now')
                self.assertFalse((c.runtime/'pending.json').exists())


if __name__=='__main__':unittest.main()
