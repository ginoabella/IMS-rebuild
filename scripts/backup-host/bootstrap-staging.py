"""Administrator-only creation of exact fresh bootstrap staging; no credentials/API IO."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import stat


def prepare(request):
    if os.geteuid() != 0:
        raise ValueError('administrator_required')
    operation = request['operationId']
    import uuid
    if str(uuid.UUID(operation)) != operation:
        raise ValueError('operation')
    spec=importlib.util.spec_from_file_location('bootstrap_stage_request',Path(__file__).with_name('bootstrap-request.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    if request.get('directories')!=module.build_request(operation)['directories']:
        raise ValueError('unreviewed_staging_layout')
    root = Path('/srv/myims-openbao-recovery-development')
    base = root / operation
    backup = Path('/srv/myims-backup-development/bootstrap')
    spool = backup / operation
    if os.path.lexists(base) or os.path.lexists(spool):
        raise ValueError('operation_exists_no_repair')
    for parent in [root, backup]:
        if not parent.exists():
            parent.mkdir(mode=0o700)
        for part in [parent,*parent.parents]:
            s=part.lstat()
            if not stat.S_ISDIR(s.st_mode) or stat.S_ISLNK(s.st_mode) or s.st_uid != 0 or s.st_mode & 0o022:
                raise ValueError('unsafe_parent')
        if stat.S_IMODE(parent.lstat().st_mode) != 0o700:
            raise ValueError('unsafe_parent_mode')
    base.mkdir(mode=0o700);spool.mkdir(mode=0o700)
    (base/'encrypted').mkdir(mode=0o700)
    os.chown(base/'encrypted',1003,1003)
    for key,path in request['directories'].items():
        p=Path(path)
        owner=12010 if key in ['prechangeSpool','postinstallSpool','receipts'] else 1003
        if p.parent not in [base,base/'encrypted',spool]:
            raise ValueError('directory_outside_operation')
        p.mkdir(mode=0o700);os.chown(p,owner,owner)
        fd=os.open(p,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
        try:os.fsync(fd)
        finally:os.close(fd)
    for p in [base/'encrypted',base,spool,root,backup]:
        fd=os.open(p,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
        try:os.fsync(fd)
        finally:os.close(fd)
    return {'status':'fresh-bootstrap-staging-prepared','operationId':operation,'credentialContentsRead':False,'providerAccessed':False}


def handoff_maintenance(request):
    if os.geteuid()!=0:raise ValueError('administrator_required')
    spec=importlib.util.spec_from_file_location('bootstrap_handoff_request',Path(__file__).with_name('bootstrap-request.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    canonical=module.build_request(request['operationId'])
    if request['credentialHandoff']!=canonical['credentialHandoff'] or request['statusOutput']!=canonical['statusOutput']:
        raise ValueError('handoff_scope')
    evidence=json.loads(Path(request['statusOutput']).read_text())
    if (evidence.get('operationId')!=request['operationId'] or evidence.get('status')!='installed-and-both-backups-retrieved' or
            evidence.get('rootRevocationVerified') is not True or evidence.get('normalRestorationVerified') is not True or
            evidence.get('postinstallBackup',{}).get('exactSnapshotFileCount')!=4):
        raise ValueError('installation_not_confirmed')
    scope=request['credentialHandoff'];target=Path(scope['operatorTarget']);parent=target.parent
    if os.path.lexists(target):raise ValueError('target_exists_no_overwrite')
    if parent.exists():
        s=parent.lstat()
        if not stat.S_ISDIR(s.st_mode) or stat.S_ISLNK(s.st_mode) or (s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode))!=(1002,1002,0o700):
            raise ValueError('operator_parent_custody')
    else:
        parent.mkdir(mode=0o700);os.chown(parent,1002,1002)
    fd=os.open(scope['maintenancePasswordSource'],os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
    try:
        before=os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or (before.st_uid,before.st_gid,stat.S_IMODE(before.st_mode),before.st_nlink)!=(1003,1003,0o600,1) or not 43<=before.st_size<=128:
            raise ValueError('password_custody')
        value=os.read(fd,129);after=os.fstat(fd)
        import re
        if len(value)!=before.st_size or (before.st_mtime_ns,before.st_ctime_ns)!=(after.st_mtime_ns,after.st_ctime_ns) or not re.fullmatch(b'[A-Za-z0-9_-]{43,128}',value):raise ValueError('password_format')
    finally:os.close(fd)
    fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    try:os.write(fd,value);os.fchown(fd,1002,1002);os.fsync(fd)
    finally:os.close(fd)
    fd=os.open(parent,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    try:os.fsync(fd)
    finally:os.close(fd)
    return {'status':'maintenance-password-handed-off','operationId':request['operationId'],'sourcePreserved':True,'passwordPrinted':False}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('request');group=parser.add_mutually_exclusive_group();group.add_argument('--prepare',action='store_true');group.add_argument('--handoff-maintenance',action='store_true')
    args=parser.parse_args();request=json.loads(Path(args.request).read_text())
    if args.handoff_maintenance:
        print(json.dumps(handoff_maintenance(request)))
    elif not args.prepare:
        print(json.dumps({'status':'staging-plan-only','operationId':request['operationId'],'directories':request['directories']}))
    else:
        print(json.dumps(prepare(request)))
