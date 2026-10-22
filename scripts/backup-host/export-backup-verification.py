#!/usr/bin/env python3
"""Plan by default. Explicit administrator export retrieves only pinned ciphertext
and public receipts from the existing repository. No key, seal or provider IO.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[2]
REQUEST = ROOT/'docs/planning/p3-u3a-fresh-backup-verification-request.json'
STAGING = Path('/srv/myims-backup-development/verification-exports')
TRANSFER = Path('/home/gino/.myims-backup-verification')
TOOLS = 'sha256:3abcd3135ba8a4b7c924792f4ecf760ba6b2020f193338cbba91191eae8d67d1'


def binding():
    data=REQUEST.read_bytes();request=json.loads(data)
    bootstrap=json.loads((ROOT/'infra/backup/bootstrap-request.json').read_text())
    source=Path(bootstrap['statusOutput']).read_bytes();evidence=json.loads(source);backup=evidence['postinstallBackup']
    archives=[{'archiveId':r['archiveId'],'kind':kind,'sha256':r['sha256'],'bytes':r['bytes'],'receiptSha256':r['receiptSha256']}
              for r,kind in zip(backup['verified'],['bootstrap-post-install','recovery-audit'],strict=True)]
    expected={'format':1,'purpose':'independent-post-install-archive-verification','captureOperationId':evidence['operationId'],
        'repositoryId':backup['repositoryId'],'snapshotId':backup['snapshotId'],'sourceEvidenceSha256':hashlib.sha256(source).hexdigest(),
        'sourceCompletedAt':evidence['events'][-1]['at'],'archives':archives}
    if request!=expected or evidence['status']!='installed-and-both-backups-retrieved' or backup['exactSnapshotFileCount']!=4:
        raise ValueError('source_binding')
    return request,hashlib.sha256(data).hexdigest()


def sync(path):
    fd=os.open(path,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    try:os.fsync(fd)
    finally:os.close(fd)


def directory(path,uid):
    s=path.lstat()
    if not stat.S_ISDIR(s.st_mode) or (s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode))!=(uid,uid,0o700):
        raise ValueError('directory_custody')


def prepare(operation):
    # Validate both full chains before creating the two new operation directories.
    for base,owner in [(STAGING,0),(TRANSFER,1002)]:
        for part in base.parents:
            s=part.lstat()
            if not stat.S_ISDIR(s.st_mode) or s.st_mode&0o022:
                raise ValueError('parent_custody')
            if part==Path('/srv/myims-backup-development'):
                directory(part,12010)
            else:
                expected_owner=1002 if part==Path('/home/gino') else 0
                if (s.st_uid,s.st_gid)!=(expected_owner,expected_owner):raise ValueError('parent_owner')
        if os.path.lexists(base):directory(base,owner)
    for base,owner in [(STAGING,0),(TRANSFER,1002)]:
        if not os.path.lexists(base):
            base.mkdir(mode=0o700);os.chown(base,owner,owner);sync(base.parent)
    source=STAGING/operation;target=TRANSFER/operation
    if os.path.lexists(source) or os.path.lexists(target):raise ValueError('operation_exists')
    source.mkdir(mode=0o700);os.chown(source,12010,12010);sync(STAGING)
    target.mkdir(mode=0o700);os.chown(target,1002,1002);sync(TRANSFER)
    return source,target


def copy_ciphertext(source_fd,target_fd,name,maximum,expected_hash,exact_bytes=None):
    source=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=source_fd)
    try:
        before=os.fstat(source)
        if (not stat.S_ISREG(before.st_mode) or (before.st_uid,before.st_gid,stat.S_IMODE(before.st_mode),before.st_nlink)!=(12010,12010,0o600,1) or
                not 0<before.st_size<=maximum or (exact_bytes is not None and before.st_size!=exact_bytes)):
            raise ValueError('input_custody')
        target=os.open(name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=target_fd)
        try:
            os.fchown(target,1002,1002);sha=hashlib.sha256();count=0
            while chunk:=os.read(source,1048576):
                count+=len(chunk)
                if count>maximum:raise ValueError('input_bound')
                sha.update(chunk);offset=0
                while offset<len(chunk):
                    written=os.write(target,chunk[offset:])
                    if written<=0:raise ValueError('short_write')
                    offset+=written
            after=os.fstat(source)
            if count!=before.st_size or sha.hexdigest()!=expected_hash or (before.st_size,before.st_mtime_ns,before.st_ctime_ns)!=(after.st_size,after.st_mtime_ns,after.st_ctime_ns):
                raise ValueError('input_changed')
            os.fsync(target)
        finally:os.close(target)
    finally:os.close(source)


def handoff(source,target,request,request_hash):
    directory(source,12010);directory(target,1002)
    entries=[('verification-request.json',16384,request_hash,None)]
    for a in request['archives']:
        entries.extend([(a['archiveId']+'.age',a['bytes'],a['sha256'],a['bytes']),
                        (a['archiveId']+'.json',4096,a['receiptSha256'],None)])
    if sorted(os.listdir(source))!=sorted(e[0] for e in entries) or os.listdir(target):raise ValueError('export_members')
    source_fd=os.open(source,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    target_fd=os.open(target,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    try:
        for entry in entries:copy_ciphertext(source_fd,target_fd,*entry)
        os.fsync(target_fd)
    finally:os.close(source_fd);os.close(target_fd)


def run(args):
    result=subprocess.run(args,capture_output=True,timeout=300)
    if result.returncode:raise ValueError('retrieval_unconfirmed')
    return result


def export(request,request_hash,operation=None):
    if os.geteuid()!=0:raise ValueError('administrator_required')
    server=json.loads(run(['docker','inspect','myims-backup-development-rest-server-1']).stdout)[0]
    if (server['Image']!='sha256:d2aff06f47eb38637dff580c3e6bce4af98f386c396a25d32eb6727ec96214a5' or
            not server['State']['Running'] or list(server['NetworkSettings']['Networks'])!=['myims-backup-development_repository'] or
            server['Config']['User']!='12010:12010' or not server['HostConfig']['ReadonlyRootfs'] or
            server['HostConfig']['Privileged'] or server['HostConfig']['PortBindings'] or server['HostConfig']['CapDrop']!=['ALL'] or
            'no-new-privileges:true' not in server['HostConfig']['SecurityOpt'] or
            any(flag not in server['Config']['Cmd'] for flag in ['--append-only','--private-repos','--tls','--tls-min-ver=1.3','--max-size=2147483648'])):
        raise ValueError('destination_drift')
    if not json.loads(run(['docker','network','inspect','myims-backup-development_repository']).stdout)[0]['Internal']:
        raise ValueError('network_not_private')
    operation=operation or str(uuid.uuid4());source,target=prepare(operation)
    result=json.loads(run(['docker','run','--rm','--name','myims-backup-verification-'+operation,'--log-driver','none',
        '--network','myims-backup-development_repository','--user','12010:12010','--read-only','--cap-drop','ALL',
        '--security-opt','no-new-privileges:true','--memory','768m','--pids-limit','64','--tmpfs','/tmp:mode=1777,size=384m',
        '--mount','type=bind,src='+str(ROOT/'scripts')+',dst=/scripts,readonly',
        '--mount','type=bind,src='+str(REQUEST)+',dst=/request.json,readonly',
        '--mount','type=bind,src=/srv/myims-backup-development/client,dst=/run/client,readonly',
        '--mount','type=bind,src='+str(source)+',dst=/output',
        '--entrypoint','node',TOOLS,'/scripts/backup-recovery/retrieve.mjs',request_hash]).stdout)
    if result.get('status')!='verification-bundle-retrieved' or result.get('snapshotId')!=request['snapshotId'] or result.get('repositoryWrites')!=0:
        raise ValueError('retrieval_unconfirmed')
    handoff(source,target,request,request_hash)
    return {'status':'ciphertext-verification-exported','operationId':operation,'ownerDirectory':str(target),
        'protectedStaging':str(source),'requestSha256':request_hash,'snapshotId':request['snapshotId'],'files':5,
        'sourcePreserved':True,'repositoryWrites':0,'providerAccessed':False,'privateKeyRead':False,'plaintextWritten':False}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--export',action='store_true');args=parser.parse_args()
    operation=None
    try:
        request,request_hash=binding()
        if args.export:operation=str(uuid.uuid4())
        value=export(request,request_hash,operation) if args.export else {'status':'plan-only','requestSha256':request_hash,
            'snapshotId':request['snapshotId'],'archives':2,'sourceFiles':4,'exportFiles':5,'administratorRequired':True,
            'providerAccessed':False,'repositoryAccessed':False,'privateKeyRead':False,'plaintextWritten':False}
        print(json.dumps(value));return 0
    except Exception:
        print(json.dumps({'status':'verification-export-unconfirmed','operationId':operation,
            'possibleProtectedStaging':str(STAGING/operation) if operation else None,
            'possibleOwnerDirectory':str(TRANSFER/operation) if operation else None,
            'plaintextWritten':False,'privateKeyRead':False,'sourcePreserved':True}));return 1


if __name__=='__main__':raise SystemExit(main())
