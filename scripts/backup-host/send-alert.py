#!/usr/bin/env python3
"""Explicit backup-only SMTP alert helper. Default validates config; --send sends.
No secret is accepted on argv/env. No automatic retry after uncertain delivery.
"""
import argparse
import datetime
import email.message
import json
import os
import pathlib
import re
import smtplib
import socket
import ssl
import stat
import sys
import uuid

DEFAULT = '/srv/myims-backup-development/alert-configuration.json'
PASSWORD = '/srv/myims-backup-development/notification/smtp.password'
USER = 'itsg.notification@sscgi.com'
EVENTS = ('notification_test', 'backup_failed', 'audit_gap', 'capacity_warning', 'capacity_critical', 'freshness_failed', 'credential_expiring', 'repository_verification_failed')


def protected(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        details = os.fstat(fd)
        if not stat.S_ISREG(details.st_mode) or details.st_mode & 0o077 or details.st_size > 16384:
            raise ValueError('invalid_custody')
        return os.read(fd, 16385)
    finally:
        os.close(fd)


def configuration(path):
    value = json.loads(protected(path))
    if (set(value) != {'host', 'port', 'security', 'username', 'sender', 'recipients', 'passwordFile'} or
            value['host'] != 'smtp.office365.com' or value['port'] != 587 or
            value['security'] != 'starttls' or value['username'] != USER or value['sender'] != USER or
            value['recipients'] != [USER] or value['passwordFile'] != PASSWORD):
        raise ValueError('invalid_smtp_scope')
    return value


def deliver(config, password, event, event_id, smtp_factory=smtplib.SMTP, progress=lambda stage: None, submit=True):
    if event not in EVENTS or not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}', event_id):
        raise ValueError('invalid_alert_metadata')
    if not password or '\n' in password or '\r' in password:
        raise ValueError('invalid_password_input')
    message = email.message.EmailMessage()
    message['From'] = config['sender']
    message['To'] = ', '.join(config['recipients'])
    message['Subject'] = 'MyIMS development backup: ' + event
    message['Message-ID'] = '<' + str(uuid.uuid4()) + '@sscgi.com>'
    message.set_content('Backup event: ' + event + '\nEvent reference: ' + event_id + '\nObserved at: ' + datetime.datetime.now(datetime.timezone.utc).isoformat() + '\nInspect protected local operational records.\n')
    context = ssl.create_default_context()
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    # No credentials before verified STARTTLS; no plaintext/auth downgrade or retry.
    progress('smtp_connect')
    with smtp_factory(config['host'], config['port'], timeout=15) as client:
        progress('smtp_ehlo')
        client.ehlo()
        progress('smtp_starttls')
        client.starttls(context=context)
        progress('smtp_tls_ehlo')
        client.ehlo()
        progress('smtp_authentication')
        client.login(config['username'], password)
        if not submit:
            progress('smtp_disconnect')
            return
        progress('smtp_submission')
        refused = client.send_message(message)
        if refused:
            raise smtplib.SMTPRecipientsRefused(refused)
        progress('smtp_quit')


def failure_kind(error):
    # Classifications only: SMTP replies and exception text may contain secrets.
    if isinstance(error, smtplib.SMTPAuthenticationError): return 'authentication_rejected'
    if isinstance(error, ssl.SSLCertVerificationError): return 'tls_certificate_rejected'
    if isinstance(error, ssl.SSLError): return 'tls_failed'
    if isinstance(error, socket.gaierror): return 'dns_failed'
    if isinstance(error, TimeoutError): return 'timeout'
    if isinstance(error, smtplib.SMTPNotSupportedError): return 'smtp_feature_unavailable'
    if isinstance(error, smtplib.SMTPRecipientsRefused): return 'recipient_rejected'
    if isinstance(error, smtplib.SMTPResponseException): return 'smtp_rejected'
    if isinstance(error, smtplib.SMTPServerDisconnected): return 'connection_closed'
    if isinstance(error, OSError): return 'local_or_network_error'
    return 'validation_or_delivery_failed'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', default=DEFAULT)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--send', action='store_true')
    mode.add_argument('--check-smtp', action='store_true', help='Check verified TLS and authentication without submitting email')
    parser.add_argument('--event', choices=EVENTS)

    parser.add_argument('--event-id', default=str(uuid.uuid4()))
    args = parser.parse_args()
    if args.send and not args.event:
        parser.error('--send requires an explicit --event; use notification_test for a delivery test')
    stage = 'smtp_configuration'
    def progress(value):
        nonlocal stage
        stage = value
        print(json.dumps({'status': 'running', 'stage': stage}), file=sys.stderr, flush=True)
    try:
        config = configuration(pathlib.Path(args.config))
        password = protected(config['passwordFile']).decode().rstrip('\r\n')
        if not password:
            raise ValueError('password_not_configured')
        if args.send or args.check_smtp:
            deliver(config, password, args.event or 'notification_test', args.event_id, progress=progress, submit=args.send)
        print(json.dumps({'status': 'passed', 'configurationValid': True, 'smtpAuthenticationVerified': args.send or args.check_smtp, 'messageSubmitted': args.send,
                          'mailboxDeliveryVerified': False, 'automaticRetry': False}))
        return 0
    except Exception as error:
        # Never print exception/body/password. QUIT failure cannot undo acceptance.
        submitted = True if stage == 'smtp_quit' else ('unconfirmed' if stage == 'smtp_submission' else False)
        result = {'status': 'failed', 'stage': stage, 'reason': failure_kind(error),
                  'messageSubmitted': submitted, 'mailboxDeliveryVerified': False, 'automaticRetry': False}
        if isinstance(error, smtplib.SMTPResponseException) and isinstance(error.smtp_code, int):
            result['smtpCode'] = error.smtp_code
        print(json.dumps(result), file=sys.stderr, flush=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
