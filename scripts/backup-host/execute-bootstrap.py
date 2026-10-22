#!/usr/bin/env python3
"""Explicit one-operation bootstrap launcher. Default validates public packaging only.
No historical capture approval, repository initialization or routine startup path.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).parent


def load(name, filename):
    spec=importlib.util.spec_from_file_location(name,HERE/filename)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module


def validate_request(request, execute=False):
    import uuid
    op=request['operationId']
    if str(uuid.UUID(op))!=op or request.get('candidate',{}).get('operationId')!=op:
        raise ValueError('operation')
    forbidden=['repositoryInitializationAuthorized','timerActivationAuthorized','productionAuthorized','destructiveCleanupAuthorized']
    if any(request.get(k) is not False for k in forbidden) or request.get('automaticRetries')!=0 or request.get('maximumIsolationSeconds')!=840:
        raise ValueError('unexpected_scope')
    package=load('bootstrap_request_validation','bootstrap-request.py').build_request(op)
    for key in ['candidate','directories','hostWork','statusOutput','repositoryId','candidateToolsImage',
                'currentProviderDockerMetadata','previousOperationEvidence','previousOperationEvidenceSha256',
                'recoveryConfigurationSha256','credentialHandoff','artifacts','reviewPackageSha256']:
        if request.get(key)!=package[key]:
            raise ValueError('package_or_source_changed')
    approval=request['ownerApproval']
    if execute:
        if (request.get('retainedExecutionAuthorized') is not True or request.get('rootRecoveryAuthorized') is not True or
                approval.get('approved') is not True or approval.get('approvedBy')!='gino' or
                not approval.get('authorizationReference') or approval.get('consumed') is not False or
                approval.get('executionStarted') is not False or request.get('stagingPrepared') is not True or
                approval.get('approvedPackageSha256')!=request['reviewPackageSha256']):
            raise ValueError('exact_execution_approval_unavailable')
        now=datetime.now(timezone.utc)
        start=datetime.fromisoformat(approval['notBefore']);end=datetime.fromisoformat(approval['notAfter'])
        if start.tzinfo is None or end.tzinfo is None or not start<=now<=end or (end-start).total_seconds()>900:
            raise ValueError('approval_window')
        if Path(request['hostWork']).exists() or Path(request['statusOutput']).exists():
            raise ValueError('operation_replay_refused')
    return package


def _run(args):
    p=subprocess.run(args,cwd=ROOT,capture_output=True,timeout=60)
    if p.returncode:raise RuntimeError('host_preflight_unavailable')
    return p


def preflight(request):
    # Approval is checked before any Docker/custody access.
    validate_request(request,True)
    expected=request['currentProviderDockerMetadata']
    current=json.loads(_run(['docker','inspect',expected['name']]).stdout)[0]
    mounts=[{'type':v['Type'],'name':v.get('Name'),'source':v['Source'],'destination':v['Destination'],'readWrite':v['RW']} for v in current['Mounts']]
    if sorted(mounts,key=lambda v:v['destination'])!=sorted(expected['mounts'],key=lambda v:v['destination']):raise ValueError('provider_mount_drift')
    old_path=ROOT/request['previousOperationEvidence']
    if hashlib.sha256(old_path.read_bytes()).hexdigest()!=request['previousOperationEvidenceSha256']:raise ValueError('closure_evidence_changed')
    previous=json.loads(old_path.read_text())
    core=load('bootstrap_preflight_core','bootstrap-controller.py')
    core.validate_closed_provider(current,{'name':expected['name'],'imageId':expected['imageId'],
        'network':'myims-rebuild-dev_endpoint-credentials','mounts':current['Mounts']},previous)
    image=request['candidateToolsImage']['imageId']
    if json.loads(_run(['docker','image','inspect',image]).stdout)[0]['Id']!=image:raise ValueError('tools_image')
    server=json.loads(_run(['docker','inspect','myims-backup-development-rest-server-1']).stdout)[0]
    host=server['HostConfig']
    if (server['Image']!='sha256:d2aff06f47eb38637dff580c3e6bce4af98f386c396a25d32eb6727ec96214a5' or
            not server['State']['Running'] or server['Config']['User']!='12010:12010' or
            host['PortBindings'] or host['Privileged'] or not host['ReadonlyRootfs'] or host['CapDrop']!=['ALL'] or
            'no-new-privileges:true' not in host['SecurityOpt'] or
            list(server['NetworkSettings']['Networks'])!=['myims-backup-development_repository'] or
            any(flag not in server['Config']['Cmd'] for flag in ['--append-only','--private-repos','--tls','--tls-min-ver=1.3','--max-size=2147483648'])):
        raise ValueError('repository_service_drift')
    for network in ['myims-rebuild-dev_endpoint-credentials','myims-backup-development_repository']:
        if not json.loads(_run(['docker','network','inspect',network]).stdout)[0]['Internal']:raise ValueError('network_not_private')
    if os.statvfs('/srv').f_bavail*os.statvfs('/srv').f_frsize<2147483648:raise ValueError('capacity')
    # Exact staging metadata only; never read a seal or repository credential.
    program="const fs=require('node:fs');const map=JSON.parse(process.argv[1]);for(const [p,u]of Object.entries(map)){const s=fs.lstatSync(p);if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==u||s.gid!==u||(s.mode&511)!==448||fs.readdirSync(p).length)throw Error()}const s=fs.lstatSync('/seal');if(!s.isFile()||s.isSymbolicLink()||s.uid!==1003||s.gid!==1003||(s.mode&511)!==384||s.nlink!==1)throw Error();for(const p of ['repository.url','repository.password','ca.crt']){const s=fs.lstatSync('/client/'+p);if(!s.isFile()||s.isSymbolicLink()||s.uid!==12010||s.gid!==12010||(s.mode&63)!==0||s.nlink!==1)throw Error()}console.log(JSON.stringify({stagingMetadataVerified:true,credentialContentsRead:false}));"
    args=['docker','run','--rm','--log-driver','none','--network','none','--user','0:0','--read-only','--cap-drop','ALL',
          '--cap-add','DAC_OVERRIDE','--security-opt','no-new-privileges:true']
    metadata={}
    for key,path in request['directories'].items():
        target='/stage/'+key;metadata[target]=12010 if key in ['prechangeSpool','postinstallSpool','receipts'] else 1003
        args+=['--mount','type=bind,src='+path+',dst='+target+',readonly']
    args+=['--mount','type=bind,src='+str(ROOT/'.local/endpoint-credentials/seal.json')+',dst=/seal,readonly',
           '--mount','type=bind,src=/srv/myims-backup-development/client,dst=/client,readonly',
           '--entrypoint','node',image,'-e',program,json.dumps(metadata)]
    _run(args)
    # Runtime/application containers must not already hold these private directories.
    ids=_run(['docker','ps','-q']).stdout.decode().split()
    for c in json.loads(_run(['docker','inspect',*ids]).stdout):
        for m in c['Mounts']:
            path=Path(m['Source'])
            for private in request['directories'].values():
                p=Path(private)
                if path==p or path in p.parents:raise ValueError('private_staging_already_mounted')
    return current


def controller_for(request, request_path):
    module=load('bootstrap_capture_primitives','execute-development-capture.py')
    module.MANIFEST, module.STATUS=request_path,Path(request['statusOutput'])
    with module.STATUS.open('x') as f:
        f.write('{}');f.flush();os.fsync(f.fileno())
    controller=module.Executor()
    controller.record['operationId']=controller.op
    controller.work=Path(request['hostWork'])
    controller.image=request['candidateToolsImage']['imageId']
    controller.env['MYIMS_OPENBAO_RECOVERY_CONFIG']=str(controller.work/'recovery.hcl')
    controller.cap=['docker','compose','-p','myims-bootstrap-'+controller.op,'-f',str(controller.work/'capture.json')]
    return controller


def prepare_host(controller, request):
    # Constructor and preflight have not generated credentials or changed services.
    for parent in [controller.work.parent.parent,controller.work.parent]:
        if not parent.exists():parent.mkdir(mode=0o700)
        s=parent.lstat()
        if not parent.is_dir() or parent.is_symlink() or s.st_uid!=os.getuid() or s.st_mode&0o077:raise ValueError('host_work_custody')
    controller.work.mkdir(mode=0o700)
    normal=(ROOT/'infra/openbao/server.hcl').read_text()
    temporary=normal.replace('disable_unauthed_generate_root_endpoints = true','disable_unauthed_generate_root_endpoints = false')
    if hashlib.sha256(temporary.encode()).hexdigest()!=request['recoveryConfigurationSha256']:raise ValueError('recovery_config')
    with (controller.work/'recovery.hcl').open('x') as f:f.write(temporary)
    (controller.work/'recovery.hcl').chmod(0o644)
    candidate=controller.work/'candidate.json'
    with candidate.open('x') as f:json.dump(request['candidate'],f)
    candidate.chmod(0o644)
    rendered=json.loads(controller.run(['docker','compose','-f','infra/backup/compose.recovery-capture.yaml',
        '--profile','manual-capture','--profile','manual-restoration','config','--format','json']).stdout)
    services={name:rendered['services'][name] for name in ['capture-helper','restoration-helper']}
    for name,service in services.items():
        service.pop('profiles',None);service['logging']={'driver':'none'}
        if name=='capture-helper':
            service['volumes'] += [
              {'type':'bind','source':str(ROOT/'scripts'),'target':'/bootstrap','read_only':True,'bind':{'create_host_path':False}},
              {'type':'bind','source':str(candidate),'target':'/candidate.json','read_only':True,'bind':{'create_host_path':False}},
              *[{'type':'bind','source':request['directories'][key],'target':target,'bind':{'create_host_path':False}} for key,target in
                [('snapshotCredentials','/snapshot-credentials'),('maintenance','/maintenance-output'),('installState','/install-state')]]]
    rendered['services']=services
    with (controller.work/'capture.json').open('x') as f:json.dump(rendered,f)
    # Exclusive durable execution fence before arming/isolation; no repository init.
    with (controller.work/'execution-started.json').open('x') as f:
        json.dump({'operationId':controller.op,'startedAt':datetime.now(timezone.utc).isoformat()},f);f.flush();os.fsync(f.fileno())
    for p in [controller.work,controller.work.parent]:
        fd=os.open(p,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
        try:os.fsync(fd)
        finally:os.close(fd)
    controller.save('bootstrap_host_prepared',status='in-progress')


def execute(request, request_path):
    preflight(request)
    controller=controller_for(request,request_path)
    host=load('bootstrap_execution_ports','bootstrap-host-ports.py')
    core=load('bootstrap_execution_core','bootstrap-controller.py')
    config={**request['directories'],'repositoryId':request['repositoryId'],'scripts':str(ROOT/'scripts'),
        'journal':str(controller.work/'journal'),'client':'/srv/myims-backup-development/client',
        'recipient':'/srv/myims-backup-development/public/recipient.txt','auditVolume':'myims-rebuild-dev_endpoint-secrets-audit',
        'actionScript':'/bootstrap/openbao/bootstrap-action.mjs','artifacts':request['artifacts'],
        'executionNotAfter':request['ownerApproval']['notAfter'],
        'candidatePath':str(controller.work/'candidate.json'),'expectedCandidate':request['candidate']}
    ports=host.HostPorts(controller,config,lambda:prepare_host(controller,request))
    try:
        core.bootstrap_flow(ports)
        controller.save('bootstrap_complete',status='installed-and-both-backups-retrieved',timerActivated=False,credentialHandoffPending=True)
    except BaseException:
        controller.save('stopped',status='requires-attended-reconciliation-no-retry')
        raise


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('request');parser.add_argument('--execute',action='store_true')
    args=parser.parse_args();os.umask(0o077)
    try:
        path=Path(args.request).resolve();request=json.loads(path.read_text())
        validate_request(request,args.execute)
        if args.execute:execute(request,path)
        else:print(json.dumps({'status':'public-package-validated-execution-disabled','operationId':request['operationId'],'providerAccessed':False,'custodyRead':False}))
        return 0
    except Exception:
        print(json.dumps({'status':'bootstrap-refused-or-stopped','automaticRetry':False,'detailsSuppressed':True}))
        return 1


if __name__=='__main__':raise SystemExit(main())
