"""Guarded bootstrap orchestration; no retained launcher or implicit authorization.

Ports are operation-bound host adapters. Native fixture supplies real adapters;
retained adapters/approval remain separate. This module never generates a root
credential, mounts custody, or invokes a provider on import.
"""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re

UUID = re.compile(r'^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$')
SHA = re.compile(r'^[a-f0-9]{64}$')


def backup_gate(proof, operation, repository, now):
    """Accept only retrieved, hash-verified ciphertext for this pre-change capture."""
    if (not UUID.fullmatch(operation) or not SHA.fullmatch(repository) or
            proof.get('operationId') != operation or proof.get('repositoryId') != repository or
            proof.get('status') != 'retrieval-verified' or proof.get('providerWrites') != 0 or
            not SHA.fullmatch(proof.get('snapshotId', '')) or
            proof.get('readOnlyVerification') is not True):
        raise ValueError('backup_proof_binding')
    captured = datetime.fromisoformat(proof['capturedAt'])
    verified = datetime.fromisoformat(proof['verifiedAt'])
    if (captured.tzinfo is None or verified.tzinfo is None or
            not 0 <= (now - captured).total_seconds() <= 900 or
            not captured <= verified <= now):
        raise ValueError('backup_proof_freshness')
    archives = proof.get('archives')
    if (not isinstance(archives, list) or len(archives) != 2 or
            {a.get('kind') for a in archives} != {'recovery-capture', 'recovery-audit'} or
            any(a.get('captureOperationId') != operation or
                not UUID.fullmatch(a.get('operationId', '')) or
                not SHA.fullmatch(a.get('sha256', '')) or
                type(a.get('bytes')) is not int or not 0 < a['bytes'] <= 402653184 or
                a.get('retrievedSha256') != a['sha256'] or
                a.get('retrievedBytes') != a['bytes'] for a in archives) or
            len({a['operationId'] for a in archives}) != 2):
        raise ValueError('backup_proof_archives')
    return hashlib.sha256(json.dumps(proof, sort_keys=True).encode()).hexdigest()


def validate_closed_provider(current, expected, previous):
    """Accept only the recorded, protected provider from the closed operation."""
    if (current.get('Name', '').lstrip('/') != expected['name'] or
            current.get('Image') != expected['imageId'] or not current.get('State', {}).get('Running') or
            current.get('Config', {}).get('Labels', {}).get('myims.openbao.recovery.operation') != previous['operationId'] or
            not all(previous.get(k) is True for k in ['rootRevocationVerified', 'normalRestorationVerified', 'deadlineCancelled'])):
        raise ValueError('prior_operation_not_closed')
    host = current['HostConfig']
    if (host.get('RestartPolicy', {}).get('Name') != 'unless-stopped' or
            host.get('PortBindings') or not host.get('ReadonlyRootfs') or host.get('Privileged') or
            host.get('CapDrop') != ['ALL'] or 'no-new-privileges:true' not in host.get('SecurityOpt', []) or
            list(current['NetworkSettings']['Networks']) != [expected['network']] or
            current.get('Mounts') != expected['mounts']):
        raise ValueError('current_provider_drift')


class Journal:
    """Exclusive fsynced intent; no replay and no private response payloads."""
    def __init__(self, directory, operation):
        if not UUID.fullmatch(operation):
            raise ValueError('operation')
        self.directory = Path(directory)
        self.directory.mkdir(mode=0o700)
        self.operation = operation
        self.append('operation-started')
        for parent in [self.directory, self.directory.parent]:
            fd = os.open(parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            try:
                os.fsync(fd)
            finally:
                os.close(fd)

    def append(self, event, index=None):
        if not re.fullmatch(r'[a-z-]{1,64}', event) or (index is not None and (type(index) is not int or not 0 <= index < 9)):
            raise ValueError('journal_event')
        path = self.directory / 'events.jsonl'
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND | os.O_NOFOLLOW, 0o600)
        try:
            value = {'operationId': self.operation, 'event': event, 'index': index,
                     'at': datetime.now(timezone.utc).isoformat()}
            os.write(fd, (json.dumps(value) + '\n').encode())
            os.fsync(fd)
        finally:
            os.close(fd)


def bootstrap_flow(p):
    """Every possible privileged interruption reaches cleanup or containment.

    A failed/unconfirmed revoke or restoration cannot cancel the independent guard.
    Partial mutations are never retried or rolled back automatically.
    """
    p.prepare()
    p.arm()
    failure = None
    try:
        p.isolate()
        try:
            p.unseal()
        except BaseException:
            p.restore_without_unseal()
            raise
        try:
            p.recover()
            p.review_prestate()
            p.capture()
            p.archive_baseline()
            p.archive_prechange_audit()
            proof = p.upload_and_verify()
            digest = backup_gate(proof, p.operation, p.repository_id, p.now())
            p.record_backup_gate(digest)
            # Recheck actual elapsed time immediately before mutation, not just
            # when receipt retrieval completed. The installer rechecks per write.
            p.assert_guard()
            backup_gate(proof, p.operation, p.repository_id, p.now())
            p.install(proof)
            p.accept()
        except BaseException as error:
            failure = error
        finally:
            # Root generation can succeed even when its response is lost.
            # Same-operation finisher reconciles/cancels the attempt, revokes any
            # known owned root, and confirms denial. Never a replacement root.
            p.finish()
        p.restore()
        p.cancel_guard()
        p.close_helpers()
    except BaseException:
        p.contain_failure()
        raise
    # These stages use scoped identities only, after root and recovery networking
    # have been removed. Failure here must not restart privileged bootstrap.
    p.archive_post_cleanup_audit()
    if failure is not None:
        raise RuntimeError('bootstrap-incomplete-protection-restored-no-retry') from None
    p.capture_post_install()
