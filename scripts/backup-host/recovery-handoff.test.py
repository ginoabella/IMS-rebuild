"""Synthetic ciphertext only; no administrator, retained paths, credentials or network."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('handoff', Path(__file__).with_name('recovery-handoff.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
OP = '00000000-0000-4000-8000-000000000001'
ARCHIVE = '00000000-0000-4000-8000-000000000002'


class HandoffTests(unittest.TestCase):
    def test_prepare_creates_only_empty_declared_directories_and_refuses_reuse(self):
        with tempfile.TemporaryDirectory(prefix='myims-stage-test-') as temporary:
            root = Path(temporary) / 'private'
            root.mkdir(mode=0o700)
            original = module.directory
            def synthetic_directory(path, owner):
                original(path, (os.getuid(), os.getgid()))
            with patch.object(module, 'RECOVERY_ROOT', root), patch.object(module, 'directory', synthetic_directory), patch.object(module.os, 'chown') as chown:
                result = module.prepare(OP)
                self.assertEqual(result['status'], 'empty_staging_prepared')
                self.assertEqual(chown.call_count, 5)
                for child in ['capture', 'encrypted/baseline', 'encrypted/audit-after']:
                    self.assertEqual(list((root / OP / child).iterdir()), [])
                with self.assertRaisesRegex(ValueError, 'operation_exists'):
                    module.prepare(OP)

    def test_prepare_refuses_symlink_root_and_preserves_partial_operation(self):
        with tempfile.TemporaryDirectory(prefix='myims-stage-test-') as temporary:
            root = Path(temporary) / 'private'
            root.symlink_to(Path(temporary), target_is_directory=True)
            with patch.object(module, 'RECOVERY_ROOT', root):
                with self.assertRaises(ValueError):
                    module.prepare(OP)
            root.unlink()
            root.mkdir(mode=0o700)
            (root / OP).mkdir(mode=0o700)
            (root / OP / 'partial').write_text('preserve')
            with patch.object(module, 'RECOVERY_ROOT', root):
                with self.assertRaisesRegex(ValueError, 'operation_exists'):
                    module.prepare(OP)
            self.assertEqual((root / OP / 'partial').read_text(), 'preserve')

    def fixture(self):
        root = tempfile.TemporaryDirectory(prefix='myims-cipher-handoff-')
        self.addCleanup(root.cleanup)
        source, spool = Path(root.name) / 'encrypted', Path(root.name) / 'spool'
        source.mkdir(mode=0o700)
        spool.mkdir(mode=0o700)
        data = b'age-encryption.org/v1\nsynthetic-ciphertext-not-a-real-archive'
        receipt = {'format': 1, 'kind': 'recovery-capture', 'captureOperationId': OP,
                   'operationId': ARCHIVE, 'archive': ARCHIVE + '.age', 'bytes': len(data),
                   'sha256': hashlib.sha256(data).hexdigest()}
        for name, value in [(ARCHIVE + '.age', data), (ARCHIVE + '.json', json.dumps(receipt).encode())]:
            path = source / name
            path.write_bytes(value)
            path.chmod(0o600)
        owner = (os.getuid(), os.getgid())
        return source, spool, owner

    def transfer(self, source, spool, owner):
        return module.handoff(source, spool, OP, owner, owner)

    def test_copy_only_ciphertext_and_receipt_source_unchanged_no_overwrite(self):
        source, spool, owner = self.fixture()
        original = {p.name: p.read_bytes() for p in source.iterdir()}
        result = self.transfer(source, spool, owner)
        self.assertEqual(result['status'], 'ciphertext_handoff_verified')
        self.assertFalse(result['plaintextCopied'])
        self.assertEqual({p.name: p.read_bytes() for p in spool.iterdir()}, original)
        self.assertEqual({p.name: p.read_bytes() for p in source.iterdir()}, original)
        for path in spool.iterdir():
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        with self.assertRaises(ValueError):
            self.transfer(source, spool, owner)

    def test_tampering_wrong_operation_and_extra_secret_refused_before_copy(self):
        for fault in ['ciphertext', 'operation', 'extra-secret', 'hardlink', 'symlink', 'permissions']:
            with self.subTest(fault=fault):
                source, spool, owner = self.fixture()
                archive = source / (ARCHIVE + '.age')
                if fault == 'ciphertext':
                    archive.write_bytes(b'age-encryption.org/v1\ntampered')
                if fault == 'operation':
                    p = source / (ARCHIVE + '.json')
                    value = json.loads(p.read_text())
                    value['captureOperationId'] = ARCHIVE
                    p.write_text(json.dumps(value))
                if fault == 'extra-secret':
                    (source / 'custodian.token').write_text('synthetic-must-not-be-copied')
                if fault == 'hardlink':
                    os.link(archive, source.parent / 'linked')
                if fault == 'symlink':
                    target = source.parent / 'ciphertext'
                    archive.rename(target)
                    archive.symlink_to(target)
                if fault == 'permissions':
                    archive.chmod(0o644)
                with self.assertRaises((ValueError, OSError)):
                    self.transfer(source, spool, owner)
                self.assertEqual(list(spool.iterdir()), [])

    def test_plan_reads_nothing_and_rejects_path_injection(self):
        self.assertTrue(module.layout(OP)['capture'].endswith(OP + '/capture'))
        with self.assertRaises(ValueError):
            module.layout('../escape')

    def test_destination_directory_replacement_is_rejected_without_following_link(self):
        source, spool, owner = self.fixture()
        outside = spool.parent / 'outside'
        outside.mkdir(mode=0o700)
        original = module.read_cipher_input
        def replace_after_read(*args, **kwargs):
            value = original(*args, **kwargs)
            if str(args[0]).endswith('.age'):
                spool.rename(spool.parent / 'original-spool')
                spool.symlink_to(outside, target_is_directory=True)
            return value
        with patch.object(module, 'read_cipher_input', replace_after_read):
            with self.assertRaisesRegex(ValueError, 'spool_path_changed'):
                self.transfer(source, spool, owner)
        self.assertEqual(list(outside.iterdir()), [])
        self.assertEqual(list((spool.parent / 'original-spool').iterdir()), [])

    def test_partial_write_keeps_review_fence_and_never_replaces_source(self):
        source, spool, owner = self.fixture()
        original = module.os.open
        def refuse_receipt(path, *args, **kwargs):
            if str(path) == ARCHIVE + '.json' and args[0] & os.O_WRONLY:
                raise OSError('synthetic receipt write failure')
            return original(path, *args, **kwargs)
        with patch.object(module.os, 'open', refuse_receipt):
            with self.assertRaises(OSError):
                self.transfer(source, spool, owner)
        self.assertEqual(sorted(p.name for p in spool.iterdir()), ['.spool.lock', ARCHIVE + '.age'])
        self.assertEqual(len(list(source.iterdir())), 2)
        with self.assertRaises((ValueError, FileExistsError)):
            self.transfer(source, spool, owner)

    def test_existing_lock_prevents_handoff(self):
        source, spool, owner = self.fixture()
        (spool / '.spool.lock').mkdir(mode=0o700)
        with self.assertRaises(FileExistsError):
            self.transfer(source, spool, owner)
        self.assertEqual([p.name for p in spool.iterdir()], ['.spool.lock'])


if __name__ == '__main__':
    unittest.main()
