#!/usr/bin/env python3
"""Disposable paired native restore only. No configurable retained targets/keys.
Actual migration-owned reservation provenance is compared without granting use.
"""
import argparse
import base64
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import ssl
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import uuid

ROOT=Path(__file__).resolve().parents[2]
BAO='quay.io/openbao/openbao:2.7.1@sha256:6d2b93856e3fcf7b18ad855a0b51eaba474dc8b79cf554379ea32034797d2acf'
POSTGRES='postgis/postgis:17-3.5@sha256:01a6a70e41e6c4467c8f55f6063555ed72db2d6662cd0d571040d42eadaeb6f6'
TOOLS='sha256:3abcd3135ba8a4b7c924792f4ecf760ba6b2020f193338cbba91191eae8d67d1'
spec=importlib.util.spec_from_file_location('joint_reconcile',ROOT/'scripts/backup-recovery/reconcile.py')
recovery=importlib.util.module_from_spec(spec);spec.loader.exec_module(recovery)


def owned_resource(metadata,operation,container=False):
    labels=metadata.get('Config',{}).get('Labels') if container else metadata.get('Labels')
    return isinstance(labels,dict) and labels.get('myims.joint-fixture')==operation


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    os.umask(0o077)
    operation=str(uuid.uuid4());prefix='myims-joint-eval-'+operation[:8]
    work=Path(tempfile.mkdtemp(prefix=prefix+'-'));containers=[];volumes=[];networks=[];known_tokens=[]
    evidence={'operationId':operation,'retainedAccess':False,'fixtureOnly':True,'checks':[],'status':'in-progress'}
    migrations=sorted((ROOT/'infra/database/migrations').glob('*/migration.sql'))
    artifacts=['scripts/backup-evaluation/check-joint-recovery.py','scripts/backup-recovery/reconcile.py',
        'scripts/backup-recovery/joint-fixture-archive.mjs','scripts/backup-recovery/verify.mjs',
        'scripts/backup/archive.mjs','scripts/trunk-owner-foundation-fixture.sql',*[str(p.relative_to(ROOT)) for p in migrations]]
    evidence['sourceSha256']={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in artifacts}
    phase='setup';deadline=time.monotonic()+600

    def run(args,data=None,check=True):
        if time.monotonic()>deadline:raise RuntimeError('fixture_deadline')
        result=subprocess.run(args,input=data,capture_output=True,timeout=90)
        if check and result.returncode:raise RuntimeError('fixture_command_unconfirmed')
        return result

    def record(name,passed):
        evidence['checks'].append({'name':name,'passed':bool(passed)})
        if not passed:raise RuntimeError('fixture_assertion_failed')

    def helper(suffix,args,data=None,mounts=(),network='none',user='1003:1003',caps=()):
        name=prefix+'-'+suffix;containers.append(name)
        return run(['docker','run','--rm','-i','--name',name,'--label','myims.joint-fixture='+operation,
            '--network',network,'--user',user,'--read-only','--cap-drop','ALL',
            *sum([['--cap-add',v] for v in caps],[]),'--security-opt','no-new-privileges:true',
            '--memory','768m','--pids-limit','64','--tmpfs','/tmp:mode=1777,size=384m',*mounts,
            '--mount','type=bind,src='+str(ROOT/'scripts')+',dst=/scripts,readonly',
            '--entrypoint','node',TOOLS,*args],data)

    def pg_start(suffix):
        name=prefix+'-'+suffix;containers.append(name)
        run(['docker','run','-d','--name',name,'--label','myims.joint-fixture='+operation,
            '--network','none','--read-only','--tmpfs','/var/lib/postgresql/data:mode=0700',
            '--tmpfs','/var/run/postgresql','--tmpfs','/tmp','-e','POSTGRES_HOST_AUTH_METHOD=trust',POSTGRES])
        for _ in range(200):
            if run(['docker','exec',name,'pg_isready','-h','127.0.0.1','-U','postgres'],check=False).returncode==0:break
            time.sleep(.15)
        else:raise RuntimeError('fixture_postgres_unavailable')
        run(['docker','exec',name,'createdb','-U','postgres','joint_fixture'])
        return name

    def sql(container,query,check=True):
        return run(['docker','exec','-i',container,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1',
                    '-v','VERBOSITY=sqlstate','-U','postgres','-d','joint_fixture'],query.encode(),check)

    def owner_rows(container):
        value=sql(container,"SET SESSION AUTHORIZATION myims_runtime; SELECT coalesce(json_agg(r),'[]') FROM (SELECT node_id AS \"nodeId\",installation_id AS \"installationId\",binding_id AS \"bindingId\",peer_id AS \"peerId\",purposes,owner_revision AS \"ownerRevision\",generation_id AS \"generationId\",generation_ordinal AS \"generationOrdinal\",material_version AS \"materialVersion\",operation_id AS \"operationId\",reservation_state AS \"reservationState\" FROM public.trunk_credential_owner_references ORDER BY generation_id) r;").stdout
        return json.loads(value)

    tls=None
    def api(address,path,body=None,token=None,method=None,binary=False):
        if time.monotonic()>deadline:raise RuntimeError('fixture_deadline')
        evidence['lastFixtureRequest']=path
        request=urllib.request.Request(address+'/v1/'+path,data=body if isinstance(body,bytes) else None if body is None else json.dumps(body).encode(),
            headers={'Content-Type':'application/octet-stream' if isinstance(body,bytes) else 'application/json',**({'X-Vault-Token':token} if token else {})},method=method)
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPSHandler(context=tls))
        with opener.open(request,timeout=min(15,max(.1,deadline-time.monotonic()))) as response:
            data=response.read(134217729)
            if len(data)>134217728:raise RuntimeError('fixture_response_bound')
            return data if binary else json.loads(data or '{}')

    def deny(address,path,body=None,token=None,expected=(403,)):
        try:api(address,path,body,token)
        except urllib.error.HTTPError as error:
            if error.code in expected:return True
        return False

    def bao_start(suffix):
        network=prefix+'-'+suffix+'-net'
        if run(['docker','network','inspect',network],check=False).returncode==0:raise RuntimeError('fixture_network_exists')
        networks.append(network)
        run(['docker','network','create','--internal','--label','myims.joint-fixture='+operation,network])
        owned=[]
        for purpose in ['raft','audit']:
            volume=prefix+'-'+suffix+'-'+purpose
            if run(['docker','volume','inspect',volume],check=False).returncode==0:raise RuntimeError('fixture_volume_exists')
            volumes.append(volume);owned.append(volume)
            run(['docker','volume','create','--label','myims.joint-fixture='+operation,volume])
            helper('own-'+suffix+'-'+purpose,['-e',"const fs=require('node:fs');fs.chmodSync('/owned',448);fs.chownSync('/owned',1003,1003)"],
                   mounts=['-v',volume+':/owned'],user='0:0',caps=['CHOWN'])
        config=work/(suffix+'.hcl')
        config.write_text('disable_mlock=true\napi_addr="https://endpoint-secrets:8200"\ncluster_addr="https://endpoint-secrets:8201"\nstorage "raft" { path="/bao/data" node_id="joint-fixture" }\nlistener "tcp" { address="0.0.0.0:8200" tls_cert_file="/config/server.crt" tls_key_file="/config/server.key" disable_unauthed_generate_root_endpoints=true }\naudit "file" "endpoint" { options { file_path="/bao/audit/endpoint.json" log_raw="false" } }\n')
        config.chmod(0o644)
        name=prefix+'-'+suffix;containers.append(name)
        run(['docker','run','-d','--name',name,'--label','myims.joint-fixture='+operation,
            '--network',network,'--network-alias','endpoint-secrets','--user','1003:1003','--read-only','--cap-drop','ALL',
            '--security-opt','no-new-privileges:true','--tmpfs','/tmp:uid=1003,gid=1003,mode=0700',
            '-v',owned[0]+':/bao/data','-v',owned[1]+':/bao/audit','-v',str(config)+':/config/server.hcl:ro',
            '-v',str(work/'server.crt')+':/config/server.crt:ro','-v',str(work/'server.key')+':/config/server.key:ro',
            BAO,'server','-config=/config/server.hcl'])
        current=json.loads(run(['docker','inspect',name]).stdout)[0]
        address='https://'+current['NetworkSettings']['Networks'][network]['IPAddress']+':8200'
        for _ in range(150):
            try:
                if not api(address,'sys/init')['initialized']:break
            except (OSError,urllib.error.URLError):pass
            time.sleep(.15)
        else:raise RuntimeError('fixture_bao_unavailable')
        initialized=api(address,'sys/init',{'secret_shares':1,'secret_threshold':1})
        api(address,'sys/unseal',{'key':initialized['keys_base64'][0]})
        wait_active(address)
        return {'name':name,'network':network,'address':address,'seal':initialized['keys_base64'][0],'root':initialized['root_token'],'audit':owned[1]}

    def wait_active(address):
        for _ in range(300):
            try:
                if api(address,'sys/health').get('sealed') is False:return
            except (OSError,urllib.error.URLError):pass
            time.sleep(.15)
        raise RuntimeError('fixture_bao_not_active')

    password=uuid.uuid4().hex
    @contextmanager
    def reader(address):
        token=api(address,'auth/joint-reader/login/recovery-reader',{'password':password})['auth']['client_token'];known_tokens.append(token)
        try:
            data=api(address,'auth/token/lookup-self',token=token)['data']
            if data['policies']!=['joint-fixture-reader'] or data['explicit_max_ttl']!=60 or not 0<data['ttl']<=60 or data.get('identity_policies') or data.get('period',0)!=0:
                raise RuntimeError('fixture_reader_scope')
            yield token
        finally:
            api(address,'auth/token/revoke-self',{},token)
            if not deny(address,'auth/token/lookup-self',token=token):raise RuntimeError('fixture_reader_cleanup')

    def inventory(address):
        result=[]
        with reader(address) as token:
            def listing(path,folder):
                values=api(address,'myims-trunk/metadata/'+path,token=token,method='LIST')['data']['keys']
                if not isinstance(values,list) or len(values)>10000 or len(set(values))!=len(values) or any(not recovery.valid_uuid(v[:-1] if folder else v) or (folder and not v.endswith('/')) for v in values):raise RuntimeError('fixture_inventory_malformed')
                return values
            for installation in listing('installations/',True):
                for binding in listing('installations/'+installation+'bindings/',True):
                    prefix_path='installations/'+installation+'bindings/'+binding+'generations/'
                    for generation in listing(prefix_path,False):
                        key=prefix_path+generation
                        meta=api(address,'myims-trunk/metadata/'+key,token=token)['data']
                        value=api(address,'myims-trunk/data/'+key+'?version=1',token=token)['data']
                        projection={k:value['data'][k] for k in recovery.IDENTITY}
                        if (projection['installationId'],projection['bindingId'],projection['generationId'])!=(installation[:-1],binding[:-1],generation):raise RuntimeError('fixture_inventory_path_mismatch')
                        result.append({**projection,'providerVersion':meta['current_version'],'destroyed':value['metadata']['destroyed'],'deletionTime':value['metadata']['deletion_time']})
        return result

    try:
        for image in [BAO,POSTGRES,TOOLS]:run(['docker','image','inspect',image])
        run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',str(work/'server.key'),'-out',str(work/'server.crt'),
             '-days','1','-subj','/CN=endpoint-secrets','-addext','subjectAltName=DNS:endpoint-secrets'])
        for name in ['server.crt','server.key']:(work/name).chmod(0o644)
        tls=ssl.create_default_context(cafile=str(work/'server.crt'));tls.check_hostname=False # Raw-IP synthetic host probes only.
        phase='postgres_source';pg_source=pg_start('pg-source')
        sql(pg_source,'CREATE TABLE public._prisma_migrations(id text PRIMARY KEY);')
        for migration in migrations:sql(pg_source,migration.read_text())
        sql(pg_source,(ROOT/'scripts/trunk-owner-foundation-fixture.sql').read_text())
        owners=owner_rows(pg_source)
        record('actual_migrations_and_retained_terminal_owner_provenance',len(owners)==1 and owners[0]['reservationState']=='cancelled')
        roles=json.loads(sql(pg_source,"SELECT json_agg(r) FROM (SELECT rolname,rolinherit,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname LIKE 'myims_%' ORDER BY rolname) r;").stdout)
        audit_count=sql(pg_source,'SELECT count(*) FROM public.audit_events;').stdout
        phase='openbao_source';source=bao_start('bao-source');address=source['address'];root=source['root']
        api(address,'sys/mounts/myims-trunk',{'type':'kv','options':{'version':'2'}},root)
        read_policy='\n'.join('path "'+p+'" { capabilities = '+json.dumps(c)+' }' for p,c in [
            ('myims-trunk/data/installations/*',['read']),('myims-trunk/metadata/installations/*',['read','list']),
            ('sys/storage/raft/snapshot',['read']),('auth/token/lookup-self',['read']),('auth/token/revoke-self',['update'])])
        api(address,'sys/policies/acl/joint-fixture-reader',{'policy':read_policy},root)
        api(address,'sys/auth/joint-reader',{'type':'userpass'},root)
        api(address,'auth/joint-reader/users/recovery-reader',{'password':password,'token_policies':['joint-fixture-reader'],'token_no_default_policy':True,
            'token_ttl':60,'token_max_ttl':60,'token_explicit_max_ttl':60,'token_type':'service'},root)
        mutate_policy='path "myims-trunk/data/installations/*" { capabilities=["create","update"] }\npath "auth/token/lookup-self" { capabilities=["read"] }\npath "auth/token/revoke-self" { capabilities=["update"] }'
        api(address,'sys/policies/acl/joint-fixture-mutator',{'policy':mutate_policy},root)
        mutator=api(address,'auth/token/create',{'policies':['joint-fixture-mutator'],'no_default_policy':True,'no_parent':True,'ttl':'300s','explicit_max_ttl':'300s','renewable':False},root)['auth']['client_token'];known_tokens.append(mutator)
        material={k:owners[0][k] for k in recovery.IDENTITY};material.update(username='synthetic-user',password=uuid.uuid4().hex,realm='fixture.invalid')
        key='myims-trunk/data/installations/'+material['installationId']+'/bindings/'+material['bindingId']+'/generations/'+material['generationId']
        api(address,key,{'options':{'cas':0},'data':material},mutator)
        api(address,'auth/token/revoke-self',{},root)
        record('initial_root_revoked_before_snapshot_and_fresh_scoped_reader_cleanup',deny(address,'auth/token/lookup-self',token=root) and len(inventory(address))==1)
        phase='paired_capture';capture_started=time.monotonic()
        pg_dump=run(['docker','exec',pg_source,'pg_dump','-U','postgres','-d','joint_fixture','-Fc']).stdout
        with reader(address) as token:snapshot=api(address,'sys/storage/raft/snapshot',token=token,binary=True)
        checkpoint={'format':1,'fixtureOnly':True,'operationId':operation,'quiescedFixtureWrites':True,
            'postgresSha256':hashlib.sha256(pg_dump).hexdigest(),'openbaoSha256':hashlib.sha256(snapshot).hexdigest()}
        audit=helper('read-audit',['-e',"process.stdout.write(require('node:fs').readFileSync('/audit/endpoint.json'))"],mounts=['-v',source['audit']+':/audit:ro']).stdout
        packed=helper('encrypted-pair',['/scripts/backup-recovery/joint-fixture-archive.mjs'],json.dumps({'fixtureOnly':True,'files':{
            'postgres.dump':base64.b64encode(pg_dump).decode(),'snapshot.snap':base64.b64encode(snapshot).decode(),
            'checkpoint.json':base64.b64encode(json.dumps(checkpoint).encode()).decode(),'audit.jsonl':base64.b64encode(audit).decode()}}).encode())
        unpacked=json.loads(packed.stdout);restored_files={n:base64.b64decode(v) for n,v in unpacked['files'].items()}
        recovery.verify_pair(json.loads(restored_files['checkpoint.json']),restored_files['postgres.dump'],restored_files['snapshot.snap'],operation)
        record('quiescent_pair_encrypted_decrypted_and_hash_bound',unpacked['status']=='fixture-pair-encrypted-decrypted')
        evidence['fixtureCaptureSeconds']=round(time.monotonic()-capture_started,3)
        phase='intentional_post_checkpoint_drift'
        api(address,key,{'options':{'cas':1},'data':{**material,'generationOrdinal':2}},mutator)
        orphan={**material,'generationId':str(uuid.uuid4()),'operationId':str(uuid.uuid4())}
        orphan_key=key.rsplit('/',1)[0]+'/'+orphan['generationId']
        api(address,orphan_key,{'options':{'cas':0},'data':orphan},mutator)
        api(address,'auth/token/revoke-self',{},mutator)
        if not deny(address,'auth/token/lookup-self',token=mutator):raise RuntimeError('fixture_mutator_cleanup')
        with reader(address) as token:later_snapshot=api(address,'sys/storage/raft/snapshot',token=token,binary=True)
        try:recovery.verify_pair(checkpoint,pg_dump,later_snapshot,operation)
        except ValueError:record('mixed_checkpoint_hash_pair_rejected_before_restore',True)
        else:raise RuntimeError('mixed_pair_accepted')
        phase='postgres_restore';restore_started=time.monotonic();pg_target=pg_start('pg-restored')
        for role in roles:
            if not re.fullmatch(r'myims_[a-z_]+',role['rolname']) or any(role[k] for k in ['rolsuper','rolcreatedb','rolcreaterole','rolreplication','rolbypassrls']):raise RuntimeError('fixture_role_scope')
            sql(pg_target,'CREATE ROLE '+role['rolname']+' '+('LOGIN' if role['rolcanlogin'] else 'NOLOGIN')+' '+('INHERIT' if role['rolinherit'] else 'NOINHERIT')+' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;')
        run(['docker','exec','-i',pg_target,'pg_restore','--exit-on-error','-U','postgres','-d','joint_fixture'],restored_files['postgres.dump'])
        restored_owners=owner_rows(pg_target)
        denied_table=sql(pg_target,'SET SESSION AUTHORIZATION myims_runtime;SELECT * FROM public.trunk_credential_generations;',check=False)
        denied_role=sql(pg_target,'SET SESSION AUTHORIZATION myims_runtime;SET ROLE myims_trunk_owner;',check=False)
        record('postgres_native_restore_preserves_owner_rows_audit_and_runtime_denials',restored_owners==owners and sql(pg_target,'SELECT count(*) FROM public.audit_events;').stdout==audit_count and denied_table.returncode!=0 and b'42501' in denied_table.stderr and denied_role.returncode!=0 and b'42501' in denied_role.stderr)
        reports={}
        for suffix,content in [('bao-restored',restored_files['snapshot.snap']),('bao-mixed-fixture',later_snapshot)]:
            phase=suffix;target=bao_start(suffix)
            info=json.loads(run(['docker','inspect',target['name']]).stdout)[0]
            if info['Config']['Labels'].get('myims.joint-fixture')!=operation or list(info['NetworkSettings']['Networks'])!=[target['network']] or info['HostConfig']['PortBindings']:raise RuntimeError('fixture_restore_target_scope')
            # Exactly one destructive restore POST per newly created fixture target.
            api(target['address'],'sys/storage/raft/snapshot-force',content,target['root'])
            run(['docker','restart',target['name']])
            target['address']='https://'+json.loads(run(['docker','inspect',target['name']]).stdout)[0]['NetworkSettings']['Networks'][target['network']]['IPAddress']+':8200'
            for _ in range(150):
                try:
                    if api(target['address'],'sys/seal-status')['sealed']:break
                except (OSError,urllib.error.URLError):pass
                time.sleep(.15)
            else:raise RuntimeError('fixture_restore_not_sealed')
            if not deny(target['address'],'sys/unseal',{'key':base64.b64encode(os.urandom(32)).decode()},expected=(400,)):
                raise RuntimeError('wrong_seal_accepted')
            api(target['address'],'sys/unseal',{'key':source['seal']});wait_active(target['address'])
            if not deny(target['address'],'auth/token/lookup-self',token=target['root']):raise RuntimeError('target_root_survived_restore')
            # Restores may revive captured bounded sessions. Account for every
            # known owned token without using them for reads or installation.
            transported=0
            checked_tokens=len(known_tokens)
            for token in list(known_tokens):
                if not deny(target['address'],'auth/token/lookup-self',token=token):
                    api(target['address'],'auth/token/revoke-self',{},token);transported+=1
                    if not deny(target['address'],'auth/token/lookup-self',token=token):raise RuntimeError('transported_token_cleanup')
            evidence.setdefault('transportedSessionCleanup',{})[suffix]={'knownSessionsChecked':checked_tokens,'revoked':transported,'allRemainingLookupDenied403':True}
            restored_material=inventory(target['address'])
            reports[suffix]=recovery.reconcile(restored_owners,restored_material,complete=True)
            with reader(target['address']) as token:
                if not deny(target['address'],'sys/storage/raft/snapshot-force',b'invalid',token) or not deny(target['address'],'sys/policies/acl/fixture',{'policy':''},token):raise RuntimeError('reader_mutation_allowed')
            source_ip=address.split('://')[1].split(':')[0]
            probe=helper('isolation-'+suffix,['-e',"const s=require('node:net').connect({host:process.argv[1],port:8200});s.setTimeout(1000);s.once('connect',()=>{s.destroy();process.exit(1)});s.once('error',()=>process.exit(0));s.once('timeout',()=>{s.destroy();process.exit(0)});",source_ip],network=target['network'])
            record(suffix+'_native_restore_source_seal_fresh_auth_and_network_isolation',probe.returncode==0 and transported>=0)
        record('matching_pair_reconciles_terminal_provenance_without_runtime_authority',reports['bao-restored']['identityReconciliationPassed'] and reports['bao-restored']['runtimeUseAllowed'] is False and reports['bao-restored']['matched']==1)
        negative=reports['bao-mixed-fixture'];codes={code for row in negative['differences'] for code in row.get('codes',[])}
        record('deliberately_mixed_native_restore_reports_version_drift_and_orphan',not negative['identityReconciliationPassed'] and {'provider-version-not-one','material-without-owner'}<=codes)
        record('source_remains_drifted_and_separate_from_restored_pair',not recovery.reconcile(owners,inventory(address),complete=True)['identityReconciliationPassed'])
        evidence['fixtureRestoreAndReconciliationSeconds']=round(time.monotonic()-restore_started,3)
        evidence['reports']=reports;evidence['checkpoint']=checkpoint
        record('exercised_source_hashes_unchanged',all(hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==v for p,v in evidence['sourceSha256'].items()))
        evidence['status']='passed'
    except Exception as error:
        evidence['status']='failed';evidence['failure']={'phase':phase,'type':type(error).__name__,'code':str(error) if isinstance(error,RuntimeError) and re.fullmatch('[a-z_]+',str(error)) else 'details-suppressed'}
        if isinstance(error,urllib.error.HTTPError):evidence['failure']['httpStatus']=error.code
    finally:
        # Only exact UUID-labeled resources created by this driver are removed.
        for name in containers:
            inspected=subprocess.run(['docker','inspect',name],capture_output=True)
            if inspected.returncode==0 and owned_resource(json.loads(inspected.stdout)[0],operation,container=True):
                subprocess.run(['docker','rm','-f',name],capture_output=True,timeout=30)
        for kind,names in [('volume',volumes),('network',networks)]:
            for name in names:
                inspected=subprocess.run(['docker',kind,'inspect',name],capture_output=True)
                if inspected.returncode==0 and owned_resource(json.loads(inspected.stdout)[0],operation):
                    subprocess.run(['docker',kind,'rm',name],capture_output=True,timeout=30)
        shutil.rmtree(work)
        evidence['cleanup']={'containersAbsent':all(subprocess.run(['docker','inspect',n],capture_output=True).returncode!=0 for n in containers),
            'volumesAbsent':all(subprocess.run(['docker','volume','inspect',n],capture_output=True).returncode!=0 for n in volumes),
            'networksAbsent':all(subprocess.run(['docker','network','inspect',n],capture_output=True).returncode!=0 for n in networks),
            'privateFixtureRemoved':not work.exists()}
        if not all(evidence['cleanup'].values()):evidence['status']='failed'
        evidence['completedAt']=datetime.now(timezone.utc).isoformat()
        for path in [ROOT/'docs/status/p3-u3a-joint-recovery-native.json',ROOT/'docs/status/p3-u3a-disposable-runs'/(operation+'.json')]:path.write_text(json.dumps(evidence,indent=2)+'\n')
        print(json.dumps(evidence))
    return 0 if evidence['status']=='passed' else 1


if __name__=='__main__':raise SystemExit(main())
