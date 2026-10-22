"""Controller safety sequencing only; no Docker, network or retained paths."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import contextlib
import io

spec = importlib.util.spec_from_file_location('executor', Path(__file__).with_name('execute-development-capture.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Ports:
    def __init__(self, fail=None):
        self.events, self.fail = [], fail

    def __getattr__(self, name):
        def call():
            self.events.append(name)
            if name == self.fail:
                raise RuntimeError('injected')
        return call


class ControllerTests(unittest.TestCase):
    def test_refused_replay_never_overwrites_completed_evidence(self):
        class Refused:
            op = 'synthetic'
            def preflight(self):
                raise RuntimeError('consumed')
            def save(self, *args, **kwargs):
                raise AssertionError('completed evidence overwritten')
        with patch.object(module, 'Executor', Refused), patch('sys.argv', ['controller', '--execute']), contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(module.main(), 1)
        self.assertIn('preflight_refused_no_execution', output.getvalue())

    def test_order_and_closed_authority_before_offline_encryption(self):
        p = Ports()
        module.capture_flow(p)
        self.assertEqual(p.events, ['initialize', 'arm', 'isolate', 'unseal', 'recover', 'capture', 'finish', 'restore', 'cancel_guard', 'close_helpers', 'archive_baseline', 'archive_audit'])

    def test_capture_or_recovery_failure_always_finishes_same_root_and_restores(self):
        for fail in ['capture', 'recover']:
            p = Ports(fail)
            with self.assertRaises(RuntimeError):
                module.capture_flow(p)
            self.assertEqual(p.events[-5:], ['finish', 'restore', 'cancel_guard', 'close_helpers', 'archive_audit'])
            self.assertNotIn('archive_baseline', p.events)

    def test_unknown_cleanup_never_restores_cancels_or_archives(self):
        p = Ports('finish')
        with self.assertRaises(RuntimeError):
            module.capture_flow(p)
        self.assertEqual(p.events[-1], 'finish')
        self.assertNotIn('cancel_guard', p.events)

    def test_early_failure_or_failed_restoration_never_cancels_guard(self):
        for fail in ['initialize', 'arm', 'isolate', 'unseal', 'restore']:
            p = Ports(fail)
            with self.assertRaises(RuntimeError):
                module.capture_flow(p)
            self.assertNotIn('cancel_guard', p.events)
            self.assertNotIn('archive_audit', p.events)


if __name__ == '__main__':
    unittest.main()
