"""Synthetic contract/security tests only: no network or real email."""
import importlib.util
import contextlib
import io
import json
import pathlib
import smtplib
import ssl
import unittest
from unittest import mock

source = pathlib.Path(__file__).with_name('send-alert.py')
spec = importlib.util.spec_from_file_location('backup_alert', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AlertTests(unittest.TestCase):
    def run_probe(self, failure=None, event='backup_failed', submit=True):
        calls = []
        stages = []
        class Client:
            def __init__(self, host, port, timeout):
                calls.append('connect')
                self.secure = False
            def __enter__(self): return self
            def __exit__(self, *_): pass
            def ehlo(self): calls.append('ehlo')
            def starttls(self, context):
                calls.append('starttls')
                self_test.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
                self_test.assertTrue(context.check_hostname)
                self_test.assertGreaterEqual(context.minimum_version, ssl.TLSVersion.TLSv1_2)
                if failure == 'tls': raise ssl.SSLError('synthetic')
                self.secure = True
            def login(self, username, password):
                self_test.assertTrue(self.secure)
                self_test.assertEqual(password, 'synthetic-password')
                calls.append('login')
                if failure == 'auth': raise smtplib.SMTPAuthenticationError(535, b'synthetic')
            def send_message(self, message):
                calls.append('send')
                self_test.assertNotIn('synthetic-password', message.as_string())
                if failure == 'uncertain': raise smtplib.SMTPServerDisconnected('synthetic')
                return {'synthetic@example.invalid': (550, b'synthetic')} if failure == 'recipient' else {}
        self_test = self
        config = {'host':'smtp.office365.com','port':587,'username':module.USER,'sender':module.USER,'recipients':[module.USER]}
        if failure:
            with self.assertRaises(Exception): module.deliver(config, 'synthetic-password', event, 'synthetic-event', Client, stages.append, submit=submit)
        else:
            module.deliver(config, 'synthetic-password', event, 'synthetic-event', Client, stages.append, submit=submit)
        self.assertEqual(stages[0], 'smtp_connect')
        self.assertEqual(stages[-1], ('smtp_quit' if submit else 'smtp_disconnect') if not failure else {'tls': 'smtp_starttls', 'auth': 'smtp_authentication', 'uncertain': 'smtp_submission', 'recipient': 'smtp_submission'}[failure])
        return calls
    def test_explicit_delivery_test_uses_same_tls_path(self):
        self.assertEqual(self.run_probe(event='notification_test')[-1], 'send')
    def test_authentication_check_never_submits_mail(self):
        self.assertEqual(self.run_probe(submit=False), ['connect','ehlo','starttls','ehlo','login'])
    def test_verified_tls_before_authentication(self):
        self.assertEqual(self.run_probe(), ['connect','ehlo','starttls','ehlo','login','send'])
    def test_no_credentials_after_tls_failure(self):
        self.assertEqual(self.run_probe('tls'), ['connect','ehlo','starttls'])
    def test_no_message_after_auth_failure(self):
        self.assertNotIn('send', self.run_probe('auth'))
    def test_uncertain_delivery_has_no_automatic_retry(self):
        self.assertEqual(self.run_probe('uncertain').count('connect'), 1)
    def test_refused_recipient_is_failure(self):
        self.run_probe('recipient')
    def test_missing_password_and_unsafe_metadata_fail_before_network(self):
        for password, event_id in [('', 'safe'), ('synthetic\nsecret', 'safe'), ('synthetic', 'invalid\nheader')]:
            with self.assertRaises(ValueError): module.deliver({}, password, 'backup_failed', event_id)

    def check_failure_output(self, stage, error, submitted, reason):
        output = io.StringIO()
        def fail(*args, **kwargs):
            kwargs['progress'](stage)
            raise error
        with mock.patch.object(module, 'configuration', return_value={'passwordFile': 'synthetic'}), mock.patch.object(module, 'protected', return_value=b'synthetic-password'), mock.patch.object(module, 'deliver', side_effect=fail) as delivery, mock.patch('sys.argv', ['send-alert.py', '--send', '--event', 'notification_test']), contextlib.redirect_stderr(output):
            self.assertEqual(module.main(), 1)
        delivery.assert_called_once()
        self.assertNotIn('synthetic-password', output.getvalue())
        records = [json.loads(line) for line in output.getvalue().splitlines()]
        self.assertEqual(records[0], {'status': 'running', 'stage': stage})
        self.assertEqual(records[-1]['messageSubmitted'], submitted)
        self.assertEqual(records[-1]['reason'], reason)
        self.assertFalse(records[-1]['automaticRetry'])
        return records[-1]
    def test_auth_rejection_reports_safe_code_without_server_text(self):
        result = self.check_failure_output('smtp_authentication', smtplib.SMTPAuthenticationError(535, b'synthetic-password'), False, 'authentication_rejected')
        self.assertEqual(result['smtpCode'], 535)
    def test_submission_timeout_stays_uncertain_without_retry(self):
        self.check_failure_output('smtp_submission', TimeoutError('synthetic-password'), 'unconfirmed', 'timeout')
    def test_quit_failure_preserves_confirmed_submission(self):
        self.check_failure_output('smtp_quit', smtplib.SMTPServerDisconnected('synthetic-password'), True, 'connection_closed')


if __name__ == '__main__': unittest.main()
