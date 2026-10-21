"""Synthetic escrow files only; no retained credentials, Docker or root access."""
import importlib.util
import base64
import io
import json
import os
import pathlib
import tarfile
import tempfile
import unittest
from unittest import mock

source = pathlib.Path(__file__).with_name('export-openbao-seal-recovery.py')
spec = importlib.util.spec_from_file_location('escrow', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class EscrowTests(unittest.TestCase):
    def test_only_seal_and_integrity_manifest_are_archived(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory)
            for name in module.FILES:
                (path / name).write_text(json.dumps({'key':base64.b64encode(b'synthetic-seal-share'.ljust(32,b'x')).decode()}))
                (path / name).chmod(0o600)
            (path / 'repository.password').write_text('must-never-be-included')
            result = module.recovery_archive(path, os.getuid(), os.getgid())
            with tarfile.open(fileobj=io.BytesIO(result)) as archive:
                self.assertEqual(set(archive.getnames()), set(module.FILES) | {'manifest.json'})
                manifest = json.load(archive.extractfile('manifest.json'))
                self.assertEqual(set(manifest['files']), set(module.FILES))
                self.assertNotIn(b'must-never-be-included', result)

    def test_symlink_and_permissive_secret_file_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory)
            (path / 'target').write_text('synthetic')
            (path / 'link').symlink_to(path / 'target')
            with self.assertRaises(OSError):
                module.read_seal_file(path / 'link', os.getuid(), os.getgid())
            (path / 'target').chmod(0o644)
            with self.assertRaises(ValueError):
                module.read_seal_file(path / 'target', os.getuid(), os.getgid())

    def test_non_age_output_cannot_create_recovery_file(self):
        with tempfile.TemporaryDirectory() as directory:
            fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
            try:
                with self.assertRaises(ValueError): module.write_ciphertext(fd, b'synthetic-plaintext')
                self.assertEqual(list(pathlib.Path(directory).iterdir()), [])
            finally:
                os.close(fd)

    def test_existing_export_is_never_replaced(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / 'openbao-seal-recovery.age'
            path.write_bytes(b'existing')
            fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
            try:
                with self.assertRaises(FileExistsError): module.write_ciphertext(fd, b'age-encryption.org/v1\nfixture')
                self.assertEqual(path.read_bytes(), b'existing')
            finally:
                os.close(fd)

    def test_default_plan_performs_no_secret_read_or_encryption(self):
        with mock.patch('sys.argv', ['export-openbao-seal-recovery.py']), mock.patch.object(module, 'recovery_archive') as read, mock.patch.object(module.subprocess, 'run') as encrypt, mock.patch('builtins.print'):
            self.assertEqual(module.main(), 0)
            read.assert_not_called()
            encrypt.assert_not_called()


    def test_malformed_or_unexpected_seal_schema_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path=pathlib.Path(directory)
            for value in [{'key':'invalid'}, {'key':base64.b64encode(b'too-short').decode()}, {'key':base64.b64encode(b'x'*32).decode(),'extra':'not-approved'}]:
                (path/'seal.json').write_text(json.dumps(value))
                (path/'seal.json').chmod(0o600)
                with self.assertRaises(ValueError): module.recovery_archive(path,os.getuid(),os.getgid())


if __name__ == '__main__': unittest.main()
