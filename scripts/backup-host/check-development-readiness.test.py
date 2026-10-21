"""Disposable public-file checks only; no secrets, root access or network."""
import importlib.util
import os
import pathlib
import tempfile
import unittest

source = pathlib.Path(__file__).with_name('check-development-readiness.py')
spec = importlib.util.spec_from_file_location('readiness', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PublicRecipientTests(unittest.TestCase):
    def test_default_does_not_create_any_file(self):
        with tempfile.TemporaryDirectory() as directory:
            result = module.public_recipient(pathlib.Path(directory), os.getgid(), owner=os.getuid())
            self.assertFalse(result['matchesSuppliedPublicRecipient'])
            self.assertEqual(list(pathlib.Path(directory).iterdir()), [])

    def test_explicit_install_and_repeat_preserve_exact_public_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory)
            self.assertTrue(module.public_recipient(path, os.getgid(), True, os.getuid())['installedNow'])
            before = (path / 'recipient.txt').stat()
            self.assertTrue(module.public_recipient(path, os.getgid(), True, os.getuid())['protectedFilePermissions'])
            self.assertEqual((path / 'recipient.txt').read_bytes(), module.RECIPIENT)
            self.assertEqual((path / 'recipient.txt').stat().st_ino, before.st_ino)

    def test_different_existing_recipient_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory)
            (path / 'recipient.txt').write_text('different public recipient')
            with self.assertRaises(ValueError):
                module.public_recipient(path, os.getgid(), True, os.getuid())
            self.assertEqual((path / 'recipient.txt').read_text(), 'different public recipient')

    def test_file_and_directory_symlinks_are_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory)
            target = path / 'target'
            target.write_bytes(module.RECIPIENT)
            (path / 'recipient.txt').symlink_to(target)
            with self.assertRaises(OSError):
                module.public_recipient(path, os.getgid(), True, os.getuid())
            (path / 'alias').symlink_to(path, target_is_directory=True)
            with self.assertRaises(ValueError):
                module.public_recipient(path / 'alias', os.getgid(), True, os.getuid())


if __name__ == '__main__':
    unittest.main()
