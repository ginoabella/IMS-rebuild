#!/usr/bin/env python3
"""Read-only local evidence for an attended failed run-now reconciliation.

No credentials, provider/repository API, pending removal or retry. Output never
authorizes closure: missing cleanup receipts remain explicitly unconfirmed.
"""
import argparse
from contextlib import contextmanager
from datetime import datetime
import json
import os
from pathlib import Path
import re
import stat
import uuid

RUNTIME = Path('/srv/myims-openbao-recovery-development/backup-operations')


def require(condition):
    if not condition:
        raise ValueError('inspection_refused')


def custody(s, uid, directory=False):
    require((stat.S_ISDIR(s.st_mode) if directory else stat.S_ISREG(s.st_mode)))
    require((s.st_uid, s.st_gid, stat.S_IMODE(s.st_mode)) ==
            (uid, uid, 0o700 if directory else 0o600))
    if not directory:
        require(s.st_nlink == 1)


@contextmanager
def directory(path, uid, parent=None):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
    try:
        custody(os.fstat(fd), uid, True)
        yield fd
    finally:
        os.close(fd)


def read(fd, name, uid, limit=65536):
    source = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=fd)
    try:
        before = os.fstat(source)
        custody(before, uid)
        require(before.st_size <= limit)
        data = os.read(source, limit + 1)
        after = os.fstat(source)
        require(len(data) == before.st_size == after.st_size)
        require((before.st_mtime_ns, before.st_ctime_ns) ==
                (after.st_mtime_ns, after.st_ctime_ns))
        return data
    finally:
        os.close(source)


def inventory(parent, name, uid):
    with directory(name, uid, parent) as fd:
        names = os.listdir(fd)
        require(len(names) <= 4096)
        total = 0
        for entry in names:
            s = os.stat(entry, dir_fd=fd, follow_symlinks=False)
            custody(s, uid)
            total += s.st_size
        return {'files':len(names), 'bytes':total}


def capture_records(parent):
    records = []
    with directory('capture-state', 1003, parent) as fd:
        names = os.listdir(fd)
        require(len(names) <= 4096)
        for name in sorted(names):
            match = re.fullmatch(r'(attempt|result)-([a-f0-9-]{36})\.json', name)
            require(match is not None)
            kind, operation = match.groups()
            require(str(uuid.UUID(operation)) == operation)
            value = json.loads(read(fd, name, 1003))
            expected = ({'operationId','startedAt'} if kind == 'attempt' else
                        {'operationId','cleanupConfirmed','outcome','finishedAt'})
            require(isinstance(value, dict) and set(value) == expected)
            require(value['operationId'] == operation)
            stamp = value['startedAt'] if kind == 'attempt' else value['finishedAt']
            require(isinstance(stamp, str) and datetime.fromisoformat(stamp).tzinfo is not None)
            if kind == 'result':
                require(value['cleanupConfirmed'] is True and value['outcome'] in ['captured','failed'])
            records.append({'kind':kind, **value})
    return records


def inspect(operation, runtime=RUNTIME):
    require(os.geteuid() == 0)
    require(str(uuid.UUID(operation)) == operation)
    for ancestor in Path(runtime).parents:
        s = ancestor.lstat()
        require(stat.S_ISDIR(s.st_mode) and s.st_uid == 0 and not s.st_mode & 0o022)
    with directory(runtime, 0) as root:
        pending = json.loads(read(root, 'pending.json', 0))
        require(pending == {'operationId':operation, 'command':'run-now', 'status':'started'})
        with directory(operation, 0, root) as work:
            with directory('journal', 0, work) as journal:
                data = read(journal, 'events.jsonl', 0, 1048576)
            require(data.endswith(b'\n'))
            events = [json.loads(line) for line in data.splitlines()]
            require(0 < len(events) <= 4096)
            for event in events:
                require(isinstance(event, dict) and set(event) == {'operationId','event','index','at'})
                require(event['operationId'] == operation and event['index'] is None)
                require(isinstance(event['event'], str) and re.fullmatch(r'[a-z-]{1,64}', event['event']))
                require(isinstance(event['at'], str) and datetime.fromisoformat(event['at']).tzinfo is not None)
            records = capture_records(work)
            files = {name:inventory(work, name, uid) for name,uid in [
                ('snapshot',1003),('encrypted',1003),('audit',1003),('spool',12010),('receipts',12010)]}
    attempts = {r['operationId'] for r in records if r['kind'] == 'attempt'}
    results = {r['operationId'] for r in records if r['kind'] == 'result'}
    return {'status':'local-backup-operation-inspected', 'operationId':operation,
            'journal':events, 'captureRecords':records, 'inventory':files,
            'cleanupReceiptsComplete':bool(attempts) and attempts == results,
            'snapshotOutputEmpty':files['snapshot']['files'] == 0,
            'uploadStageRecorded':any('-upload-' in e['event'] for e in events),
            'providerApiAccessed':False, 'credentialContentsRead':False,
            'repositoryAccessed':False, 'pendingStateChanged':False,
            'safeToRetry':False, 'requiresAttendedReconciliation':True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation_id')
    args = parser.parse_args()
    try:
        print(json.dumps(inspect(args.operation_id)))
    except Exception:
        print(json.dumps({'status':'local-inspection-unconfirmed', 'detailsSuppressed':True,
                          'pendingStateChanged':False, 'safeToRetry':False}))
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
