"""Read-only failure inspection, secret exclusion and hostile-path contracts."""
from contextlib import ExitStack
import importlib.util
import json
import os
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('inspection', Path(__file__).with_name('inspect-backup-operation.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
OP = 'ec0b8e2d-49d9-45e3-930e-6b769b58f103'
CAPTURE = 'f581c3c3-b082-468c-a8f5-40083f0df9fe'


class Tests(unittest.TestCase):
    def record(self, path, value):
        path.write_text(json.dumps(value))
        path.chmod(0o600)

    def fixture(self, root):
        root.chmod(0o700)
        work = root / OP
        work.mkdir(mode=0o700)
        for name in ['journal','capture-state','snapshot','encrypted','audit','spool','receipts']:
            (work/name).mkdir(mode=0o700)
        self.record(root/'pending.json', {'operationId':OP,'command':'run-now','status':'started'})
        self.record(work/'capture-state'/('attempt-'+CAPTURE+'.json'),
                    {'operationId':CAPTURE,'startedAt':'2026-10-22T23:54:11.850Z'})
        event={'operationId':OP,'event':'scoped-postinstall-capture-started','index':None,'at':'2026-10-22T23:54:11.800Z'}
        journal=work/'journal/events.jsonl'
        journal.write_text(json.dumps(event)+'\n')
        journal.chmod(0o600)
        return work

    def simulated_custody(self):
        # Host test driver is unprivileged. Check actual filesystem types/modes
        # while simulating the installed UID boundary; custody itself tested below.
        stack=ExitStack()
        original=m.custody
        original_stat=m.Path.lstat
        def ancestors(path):
            s=original_stat(path)
            return SimpleNamespace(st_mode=s.st_mode & ~0o022,st_uid=0)
        stack.enter_context(patch.object(m.os,'geteuid',return_value=0))
        stack.enter_context(patch.object(m,'custody',side_effect=lambda s,uid,directory=False:original(s,os.getuid(),directory)))
        stack.enter_context(patch.object(m.Path,'lstat',ancestors))
        return stack

    def test_incomplete_capture_stays_unconfirmed_and_all_inputs_unchanged(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);work=self.fixture(root)
            snapshot=work/'snapshot/fixture.snap'
            snapshot.write_bytes(b'sensitive-snapshot-material');snapshot.chmod(0o600)
            before={p.relative_to(root):p.read_bytes() for p in root.rglob('*') if p.is_file()}
            with self.simulated_custody(): report=m.inspect(OP,root)
            self.assertFalse(report['cleanupReceiptsComplete'])
            self.assertFalse(report['snapshotOutputEmpty'])
            self.assertFalse(report['uploadStageRecorded'])
            self.assertFalse(report['safeToRetry'])
            self.assertFalse(report['pendingStateChanged'])
            self.assertNotIn('sensitive-snapshot-material',json.dumps(report))
            self.assertEqual(before,{p.relative_to(root):p.read_bytes() for p in root.rglob('*') if p.is_file()})

    def test_extra_secret_fields_refuse_instead_of_echoing(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);work=self.fixture(root)
            self.record(work/'capture-state'/('attempt-'+CAPTURE+'.json'),
                        {'operationId':CAPTURE,'startedAt':'2026-10-22T23:54:11.850Z','token':'never-echo'})
            with self.simulated_custody(),self.assertRaisesRegex(ValueError,'inspection_refused'):
                m.inspect(OP,root)

    def test_symlinked_state_directory_refuses_before_reading_target(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);work=self.fixture(root)
            state=work/'capture-state';state.rename(work/'preserved-state');state.symlink_to(work/'preserved-state',target_is_directory=True)
            with self.simulated_custody(),self.assertRaises(OSError):m.inspect(OP,root)

    def test_truncated_journal_refuses(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);work=self.fixture(root)
            (work/'journal/events.jsonl').write_text('{')
            with self.simulated_custody(),self.assertRaises(ValueError):m.inspect(OP,root)

    def test_nonadministrator_refuses_before_filesystem_access(self):
        with patch.object(m.os,'geteuid',return_value=1002),patch.object(m.os,'open',side_effect=AssertionError('read too early')):
            with self.assertRaises(ValueError):m.inspect(OP)

    def test_custody_rejects_wrong_owner_public_mode_links_and_special_files(self):
        for overrides in [{'st_uid':1002},{'st_gid':1002},{'st_mode':0o100644},{'st_nlink':2},{'st_mode':0o010600}]:
            fields={'st_uid':1003,'st_gid':1003,'st_mode':0o100600,'st_nlink':1}
            fields.update(overrides)
            with self.assertRaises(ValueError):m.custody(SimpleNamespace(**fields),1003)


if __name__ == '__main__':
    unittest.main()
