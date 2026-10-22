#!/usr/bin/env python3
"""Fresh native TLS fixture only. Never accesses retained OpenBao or custody."""
import datetime
import json
import os
import pathlib
import shutil
import ssl
import subprocess
import tempfile
import time
import urllib.request
import urllib.error
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
BAO = 'quay.io/openbao/openbao:2.7.1@sha256:6d2b93856e3fcf7b18ad855a0b51eaba474dc8b79cf554379ea32034797d2acf'
TOOLS = 'sha256:4d459195b6509cc5a1f2d5b18eb395a7598d5db4f1939bccd61d3093a653d21e'
os.umask(0o077)
operation = str(uuid.uuid4())
prefix = 'myims-installer-fixture-' + operation[:8]
network, server, helper = prefix + '-net', prefix + '-bao', prefix + '-helper'
work = pathlib.Path(tempfile.mkdtemp(prefix=prefix))
evidence = {'operationId': operation, 'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'scope': 'disposable-native-only', 'openbaoImage': BAO, 'toolingImage': TOOLS, 'checks': []}

def run(args, check=True):
    p = subprocess.run(args, capture_output=True, timeout=90)
    if check and p.returncode:
        raise RuntimeError('fixture_command_failed')
    return p

def check(name, value):
    evidence['checks'].append({'name': name, 'passed': bool(value)})
    if not value: raise RuntimeError(name)

try:
    run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', str(work / 'tls.key'), '-out', str(work / 'ca.crt'), '-days', '1', '-subj', '/CN=endpoint-secrets', '-addext', 'subjectAltName=DNS:endpoint-secrets'])
    for name in ['tls.key', 'ca.crt']: (work / name).chmod(0o644)
    (work / 'server.hcl').write_text('disable_mlock=true\napi_addr="https://endpoint-secrets:8200"\ncluster_addr="https://endpoint-secrets:8201"\nstorage "raft" { path="/bao/data" }\nlistener "tcp" { address="0.0.0.0:8200" tls_cert_file="/bao/config/ca.crt" tls_key_file="/bao/config/tls.key" }\naudit "file" "fixture" { options { file_path="/tmp/audit.jsonl" log_raw="false" } }\n')
    (work / 'server.hcl').chmod(0o644)
    run(['docker','network','create','--internal',network])
    run(['docker','run','-d','--name',server,'--log-driver','none','--network',network,'--network-alias','endpoint-secrets','--user','1003:1003','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--tmpfs','/bao/data:uid=1003,gid=1003,mode=0700','--tmpfs','/tmp:uid=1003,gid=1003',*sum((['--mount', 'type=bind,src='+str(work/name)+',dst=/bao/config/'+name+',readonly'] for name in ['server.hcl','tls.key','ca.crt']),[]),BAO,'server','-config=/bao/config/server.hcl'])
    details=json.loads(run(['docker','inspect',server]).stdout)[0]
    check('no_published_ports',not details['HostConfig']['PortBindings'])
    endpoint='https://'+details['NetworkSettings']['Networks'][network]['IPAddress']+':8200/v1/'
    tls=ssl.create_default_context(cafile=str(work/'ca.crt'))
    tls.check_hostname=False  # Host fixture init only; actual helper verifies endpoint-secrets SAN.
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPSHandler(context=tls))
    def api(path, body=None, token=None):
        evidence['lastFixtureApi']=path
        request=urllib.request.Request(endpoint+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json',**({'X-Vault-Token':token} if token else {})})
        with opener.open(request,timeout=20) as response: return json.loads(response.read() or '{}')
    for attempt in range(100):
        try:
            api('sys/init'); break
        except Exception:
            if attempt==99: raise RuntimeError('fixture_not_ready')
            time.sleep(.1)
    initialized=api('sys/init',{'secret_shares':1,'secret_threshold':1})
    token=initialized['root_token']
    api('sys/unseal',{'key':initialized['keys_base64'][0]})
    for attempt in range(100):
        try:
            if api('sys/health')['sealed'] is False: break
        except Exception:
            if attempt == 99: raise RuntimeError('fixture_activation_timeout')
            time.sleep(.1)
    api('sys/auth/platform-custodian',{'type':'userpass','config':{'default_lease_ttl':'900s','max_lease_ttl':'900s'}},token)
    plan=json.loads((ROOT/'docs/planning/p3-u3a-backup-maintenance-review.json').read_text())
    policy=plan['privilegedPolicyRemediation'][-1]['body']['policy']
    api('sys/policies/acl/platform-deployment-maintainer',{'policy':policy},token)
    for role in plan['completeRoleConfigurationsToVerify']:
        api('auth/token/roles/'+role['name'],role['configuration'],token)
    for change in plan['privilegedPolicyRemediation'][:2]: api(change['path'],change['body'],token)
    password=uuid.uuid4().hex+uuid.uuid4().hex
    (work/'password').write_text(password+'\r\n')
    api('auth/platform-custodian/users/platform-owner-custodian',{'password':password,'token_policies':['platform-deployment-maintainer'],'token_no_default_policy':True,'token_type':'service','token_ttl':'900s','token_max_ttl':'900s','token_explicit_max_ttl':'900s'},token)
    command=['docker','run','--rm','--name',helper,'--log-driver','none','--network',network,'--user',str(os.getuid())+':'+str(os.getgid()),'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory','128m','--pids-limit','64','--tmpfs','/session:mode=0700,uid='+str(os.getuid())+',gid='+str(os.getgid()),'--mount','type=bind,src='+str(ROOT/'scripts/openbao')+',dst=/scripts,readonly','--mount','type=bind,src='+str(work/'password')+',dst=/human/password,readonly','--mount','type=bind,src='+str(work/'ca.crt')+',dst=/trust/ca.crt,readonly','--mount','type=bind,src='+str(ROOT/'docs/planning/p3-u3a-backup-maintenance-review.json')+',dst=/plan/review.json,readonly','--entrypoint','node',TOOLS,'/scripts/review-installer-route.mjs','review-once']
    response=run(command,check=False)
    result=json.loads(response.stdout)
    evidence['helperResult']=result
    check('native_route_review_and_cleanup', response.returncode==0 and result['state']=='verified' and result['cleanup']=='revoked_and_denial_confirmed')
    check('fourteen_complete_role_responses',len(result['routeReview']['roles'])==14 and all(not r['differentConfiguredFields'] for r in result['routeReview']['roles']))
    check('two_exact_proposed_policy_hashes',len(result['routeReview']['policies'])==2 and all(p['matchesProposed'] for p in result['routeReview']['policies']))
    check('direct_installer_and_mappings_not_established',not result['routeReview']['installerEstablished'] and not result['routeReview']['mappingsEstablished'])
    check('no_fixture_secrets_exported',all(secret not in response.stdout.decode() for secret in [password,token,initialized['keys_base64'][0]]))
    audit=run(['docker','exec',server,'cat','/tmp/audit.jsonl']).stdout
    requests=[json.loads(line)['request'] for line in audit.splitlines() if json.loads(line)['type']=='request']
    start=next(i for i,r in enumerate(requests) if r['path']=='auth/platform-custodian/login/platform-owner-custodian')
    observed=requests[start:]
    expected=['auth/platform-custodian/login/platform-owner-custodian','auth/token/lookup-self','sys/capabilities-self',
      *['auth/token/roles/'+r['name'] for r in plan['completeRoleConfigurationsToVerify']],
      *[c['path'] for c in plan['privilegedPolicyRemediation'][:2]],'auth/token/revoke-self','auth/token/lookup-self']
    evidence['observedAuditRequests']=[{'path':r['path'],'operation':r['operation']} for r in observed]
    check('exact_twenty_one_native_requests', [r['path'] for r in observed]==expected)
    check('only_login_capabilities_cleanup_are_posts', [r['operation'] for r in observed]==['update','read','update',*['read']*16,'update','read'])
    evidence['status']='passed'
except Exception as error:
    evidence['status']='failed'
    evidence['failureType']=type(error).__name__
    if isinstance(error, urllib.error.HTTPError):
        evidence['httpStatus']=error.code
        diagnostic=error.read(4096).decode(errors='replace')
        for secret in [locals().get('token'),locals().get('password'), *locals().get('initialized',{}).get('keys_base64',[])]:
            if secret: diagnostic=diagnostic.replace(secret,'[redacted]')
        evidence['fixtureOnlyDiagnostic']=diagnostic
finally:
    for name in [helper,server]: run(['docker','rm','-f',name],check=False)
    run(['docker','network','rm',network],check=False)
    shutil.rmtree(work)
    evidence['cleanup']={'containersAbsent':all(run(['docker','inspect',name],check=False).returncode!=0 for name in [helper,server]),'networkAbsent':run(['docker','network','inspect',network],check=False).returncode!=0,'temporaryKeysAbsent':not work.exists(),'namedVolumesCreated':False}
    if not all(value for key,value in evidence['cleanup'].items() if key!='namedVolumesCreated'): evidence['status']='failed'
    evidence['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
    path=ROOT/'docs/status/p3-u3a-disposable-runs'/ (operation+'.json')
    path.write_text(json.dumps(evidence,indent=2)+'\n')
    print(json.dumps({'status':evidence['status'],'operationId':operation,'checks':len(evidence['checks']),'evidence':str(path.relative_to(ROOT))}))
raise SystemExit(0 if evidence['status']=='passed' else 1)
