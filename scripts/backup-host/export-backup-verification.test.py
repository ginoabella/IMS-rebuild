import hashlib
import importlib.util
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('verification_export',Path(__file__).with_name('export-backup-verification.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)


class Tests(unittest.TestCase):
    def test_public_request_matches_exact_retained_evidence_without_private_io(self):
        with patch.object(module.subprocess,'run',side_effect=AssertionError('network access')):
            request,digest=module.binding()
        self.assertEqual(len(request['archives']),2);self.assertEqual(len(digest),64)

    def test_nonadministrator_refuses_before_docker_or_directory_creation(self):
        with patch.object(module.os,'geteuid',return_value=1002),patch.object(module,'run',side_effect=AssertionError('Docker accessed')),patch.object(module,'prepare',side_effect=AssertionError('directory created')):
            with self.assertRaisesRegex(ValueError,'administrator_required'):module.export({},'f'*64)

    def test_source_bound_request_rejects_changed_snapshot(self):
        data=module.REQUEST.read_bytes()
        with patch.object(module.Path,'read_bytes',autospec=True,side_effect=lambda path: data.replace(b'"format": 1',b'"format": 2') if path==module.REQUEST else original(path)):
            with self.assertRaises(ValueError):module.binding()
        # The saved evidence and request were never modified.

    def copy_context(self):
        original=module.os.fstat
        def custody(fd):
            s=original(fd)
            return SimpleNamespace(st_mode=s.st_mode,st_uid=12010,st_gid=12010,st_nlink=s.st_nlink,
                st_size=s.st_size,st_mtime_ns=s.st_mtime_ns,st_ctime_ns=s.st_ctime_ns)
        return patch.object(module.os,'fstat',side_effect=custody)

    def test_ciphertext_handoff_checks_hash_and_never_overwrites(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);(root/'source').mkdir();(root/'target').mkdir();data=b'age-encryption.org/v1\nsynthetic-ciphertext'
            (root/'source/archive.age').write_bytes(data);(root/'source/archive.age').chmod(0o600)
            src=os.open(root/'source',os.O_RDONLY|os.O_DIRECTORY);dst=os.open(root/'target',os.O_RDONLY|os.O_DIRECTORY)
            try:
                with self.copy_context(),patch.object(module.os,'fchown'):
                    module.copy_ciphertext(src,dst,'archive.age',1024,hashlib.sha256(data).hexdigest(),len(data))
                    with self.assertRaises(FileExistsError):module.copy_ciphertext(src,dst,'archive.age',1024,hashlib.sha256(data).hexdigest(),len(data))
                self.assertEqual((root/'target/archive.age').read_bytes(),data)
                self.assertEqual((root/'target/archive.age').stat().st_mode&0o777,0o600)
            finally:os.close(src);os.close(dst)

    def test_symlink_and_wrong_digest_cannot_complete_handoff(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);(root/'source').mkdir();(root/'target').mkdir();(root/'source/data').write_bytes(b'cipher');(root/'source/data').chmod(0o600)
            (root/'source/link').symlink_to(root/'source/data')
            src=os.open(root/'source',os.O_RDONLY|os.O_DIRECTORY);dst=os.open(root/'target',os.O_RDONLY|os.O_DIRECTORY)
            try:
                with self.copy_context(),patch.object(module.os,'fchown'):
                    with self.assertRaises(OSError):module.copy_ciphertext(src,dst,'link',1024,'f'*64)
                    with self.assertRaisesRegex(ValueError,'input_changed'):module.copy_ciphertext(src,dst,'data',1024,'f'*64)
                self.assertTrue((root/'source/data').exists())
            finally:os.close(src);os.close(dst)


original=module.Path.read_bytes
if __name__=='__main__':unittest.main()
