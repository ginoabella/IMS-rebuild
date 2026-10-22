#!/usr/bin/env python3
"""Actual attended-controller methods against fresh synthetic services only.
No retained mounts, credentials, provider, repository, or source graph activation.
"""
import argparse
import re
import hashlib
from datetime import datetime, timezone
import importlib.util
import json
import os
from pathlib import Path
import shutil
import ssl
import subprocess
import tempfile
import time
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[2]
TOOLS = 'sha256:3abcd3135ba8a4b7c924792f4ecf760ba6b2020f193338cbba91191eae8d67d1'
BAO = 'quay.io/openbao/openbao:2.7.1@sha256:6d2b93856e3fcf7b18ad855a0b51eaba474dc8b79cf554379ea32034797d2acf'
SERVER = 'restic/rest-server:0.14.0@sha256:d2aff06f47eb38637dff580c3e6bce4af98f386c396a25d32eb6727ec96214a5'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--lost-response-after-write',type=int,choices=range(9))
options=parser.parse_args()
op = str(uuid.uuid4())
prefix = 'myims-bootstrap-eval-' + op[:8]
work = Path(tempfile.mkdtemp(prefix=prefix + '-'))
containers, volumes, networks = ['myims-recovery-repository-init-' + op], [], []
evidence = {'operationId': op, 'retainedAccess': False, 'checks': [], 'status': 'in-progress'}
SOURCES = ['scripts/backup-host/bootstrap-controller.py','scripts/backup-host/bootstrap-host-ports.py','scripts/backup-host/guard-bridge.py',
 'scripts/openbao/bootstrap-action.mjs','scripts/openbao/bootstrap-prestate.mjs','scripts/openbao/guard-gate.mjs','scripts/openbao/bootstrap-provision.mjs',
 'scripts/backup/archive.mjs','scripts/backup/archive-post-install.mjs','scripts/backup/ciphertext-handoff.mjs','scripts/backup/verify-bootstrap-upload.mjs','scripts/backup/repository-check.mjs',
 'scripts/backup-evaluation/bootstrap-run-action.mjs']
evidence['sourceSha256']={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in SOURCES}
controller = None
provider = None
initial = None
stage = "fixture-setup"


def run(args, data=None, check=True):
    result = subprocess.run(args, input=data, capture_output=True, timeout=120)
    if check and result.returncode:
        raise RuntimeError('fixture_command_failed')
    return result


def check(name, value):
    evidence['checks'].append({'name': name, 'passed': bool(value)})
    if not value:
        raise RuntimeError('fixture_assertion_failed')


def helper(name, args, mounts=(), data=None, user='1003:1003', caps=()):
    target = prefix + '-' + name
    containers.append(target)
    return run(['docker', 'run', '--rm', '-i', '--name', target, '--network', 'none', '--user', user,
                '--read-only', '--cap-drop', 'ALL', *sum([['--cap-add', cap] for cap in caps], []),
                '--security-opt', 'no-new-privileges:true', '--tmpfs', '/tmp:mode=1777', *mounts,
                '--entrypoint', 'node', TOOLS, *args], data)


try:
    os.chmod(work, 0o700)
    run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', str(work / 'server.key'),
         '-out', str(work / 'server.crt'), '-days', '1', '-subj', '/CN=endpoint-secrets',
         '-addext', 'subjectAltName=DNS:endpoint-secrets,DNS:rest-server'])
    for name in ['server.key', 'server.crt']:
        (work / name).chmod(0o644)
    for name in ['normal', 'isolated', 'repository']:
        network = prefix + '-' + name
        networks.append(network)
        run(['docker', 'network', 'create', '--internal', '--label', 'myims.controller.fixture=' + op, network])
    normal_network, isolated_network, backup_network = networks
    for name in ['data', 'audit', 'seal', 'repository']:
        volume = prefix + '-' + name
        volumes.append(volume)
        run(['docker', 'volume', 'create', '--label', 'myims.controller.fixture=' + op, volume])
        owner = '12010' if name == 'repository' else '1003'
        helper('own-' + name, ['-e', "const fs=require('node:fs');fs.chownSync('/owned',Number(process.argv[1]),Number(process.argv[1]));fs.chmodSync('/owned',448)", owner],
               ['-v', volume + ':/owned'], user='0:0', caps=['CHOWN', 'FOWNER'])
    data_volume, audit_volume, seal_volume, repository_volume = volumes
    for name in ['capture', 'baseline', 'audit-after', 'client', 'receipts', 'spool', 'protected', 'proof', 'snapshot-output', 'snapshot-state', 'pre-audit', 'post-audit', 'snapshot-credentials', 'maintenance', 'install-state', 'post-snapshot', 'post-encrypted', 'prechange-spool', 'postinstall-spool']:
        (work / name).mkdir(mode=0o700)
    normal_config = (ROOT / 'infra/openbao/server.hcl').read_text()
    (work / 'normal.hcl').write_text(normal_config)
    (work / 'normal.hcl').chmod(0o644)
    provider = prefix + '-provider'
    containers.append(provider)
    common = {'image': BAO, 'container_name': provider, 'user': '1003:1003', 'read_only': True,
              'cap_drop': ['ALL'], 'security_opt': ['no-new-privileges:true'], 'tmpfs': ['/tmp:mode=0700'],
              'entrypoint': ['/usr/bin/bao'], 'command': ['server', '-config=/bao/config/server.hcl'],
              'volumes': [data_volume + ':/bao/data', audit_volume + ':/bao/audit',
                          str(work / 'server.crt') + ':/bao/tls/server.crt:ro', str(work / 'server.key') + ':/bao/tls/server.key:ro']}
    provider_base = work / 'provider-base.json'
    graph = {'services': {'endpoint-secrets': common},
             'networks': {'normal': {'external': True, 'name': normal_network}, 'isolated': {'external': True, 'name': isolated_network}},
             'volumes': {name: {'external': True} for name in [data_volume, audit_volume]}}
    provider_base.write_text(json.dumps(graph))
    for phase, network, config, restart, labels in [
        ('initial', 'normal', work / 'normal.hcl', 'unless-stopped', {'myims.openbao.recovery.operation': '24096f3d-bf41-4ec2-9e12-95e2057c115d'}),
        ('recovery', 'isolated', work / 'execution/recovery.hcl', 'no', {'myims.openbao.recovery.operation': op}),
        ('restoration', 'normal', work / 'normal.hcl', 'no', {'myims.openbao.recovery.operation': op}),
    ]:
        overlay = {'services': {'endpoint-secrets': {'networks': {network: {'aliases': ['endpoint-secrets']}},
                   'restart': restart, 'labels': labels, 'volumes': [str(config) + ':/bao/config/server.hcl:ro']}}}
        (work / (phase + '.json')).write_text(json.dumps(overlay))
    base = ['docker', 'compose', '-p', prefix, '-f', str(provider_base)]
    stage = 'fixture-provider-start'
    run([*base, '-f', str(work / 'initial.json'), 'up', '-d', '--no-deps', 'endpoint-secrets'])
    info = json.loads(run(['docker', 'inspect', provider]).stdout)[0]
    address = 'https://' + info['NetworkSettings']['Networks'][normal_network]['IPAddress'] + ':8200/v1/'
    tls = ssl.create_default_context(cafile=str(work / 'server.crt'))
    tls.check_hostname = False  # Synthetic host bootstrap only. Controller helpers enforce SAN.
    def api(path, body=None, token=None, method=None):
        evidence['lastFixtureApi'] = path
        req = urllib.request.Request(address + path, data=None if body is None else json.dumps(body).encode(),
                                     headers={'Content-Type': 'application/json', **({'X-Vault-Token': token} if token else {})},method=method)
        with urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPSHandler(context=tls)).open(req, timeout=30) as res:
            return json.loads(res.read() or '{}')
    for _ in range(100):
        try:
            if not api('sys/init')['initialized']:
                break
        except Exception:
            pass
        time.sleep(.2)
    stage = 'fixture-provider-initialize'
    initial = api('sys/init', {'secret_shares': 1, 'secret_threshold': 1})
    stage = 'fixture-provider-initial-unseal'
    api('sys/unseal', {'key': initial['keys_base64'][0]})
    for _ in range(100):
        try:
            if not api('sys/health')['sealed']:
                break
        except Exception:
            pass
        time.sleep(.2)
    candidate = json.loads((ROOT / 'docs/planning/p3-u3a-guarded-bootstrap-preparation.json').read_text())
    maintenance = json.loads((ROOT / 'docs/planning/p3-u3a-backup-maintenance-review.json').read_text())
    candidate.update({'fixtureOnly': True, 'operationId': op, 'roles': maintenance['completeRoleConfigurationsToVerify'], 'fixtureFaultAfterWrite':options.lost_response_after_write})
    (work / 'candidate.json').write_text(json.dumps(candidate))
    (work / 'candidate.json').chmod(0o644)
    # Synthetic current pre-state, not the historical retained policy bytes.
    for write in candidate['writes'][:3]:
        legacy=re.sub(r'\n  required_parameters = [^\n]*\n  allowed_parameters = \{\n(?:[^\n]*\n)*?  \}', '', write['body']['policy'])
        if legacy==write['body']['policy']: raise RuntimeError('fixture_legacy_policy_not_distinct')
        api(write['path'], {'policy':legacy}, initial['root_token'])
    evidence['syntheticPolicyPrestate']='three-unconstrained-issuance-policies-not-retained-bytes'
    policy_names=api('sys/policies/acl',token=initial['root_token'],method='LIST')['data']['keys']
    candidate['policyBaseline']={name:hashlib.sha256(api('sys/policies/acl/'+name,token=initial['root_token'])['data']['policy'].encode()).hexdigest() for name in policy_names if name!='root'}
    (work/'candidate.json').write_text(json.dumps(candidate))
    for role in candidate['roles']: api('auth/token/roles/'+role['name'], role['configuration'], initial['root_token'])
    api('sys/auth/platform-custodian', {'type': 'userpass'}, initial['root_token'])
    owner_password=uuid.uuid4().hex+uuid.uuid4().hex
    api('auth/platform-custodian/users/platform-owner-custodian', {'password': owner_password,
        **maintenance['rotation']['userConfiguration'], 'token_policies': ['platform-deployment-maintainer']}, initial['root_token'])
    owner_session=api('auth/platform-custodian/login/platform-owner-custodian',{'password':owner_password})['auth']['client_token']
    api('auth/token/revoke-self',{},owner_session)
    stage = 'fixture-initial-root-revoke'
    api('auth/token/revoke-self', {}, initial['root_token'])
    stage = 'fixture-private-files'
    helper('write-seal', ['-e', "const fs=require('node:fs'),v=JSON.parse(fs.readFileSync(0));fs.writeFileSync('/seal/seal.json',JSON.stringify({key:v.key}),{mode:384,flag:'wx'});fs.writeFileSync('/seal/ca.crt',v.ca,{mode:384,flag:'wx'});"],
           ['-v', seal_volume + ':/seal'], json.dumps({'key': initial['keys_base64'][0], 'ca': (work / 'server.crt').read_text()}).encode())
    # Synthetic server credentials only. Kept out of controller argv/env.
    password, repository_password = uuid.uuid4().hex, uuid.uuid4().hex
    for name, value in [('repository.url', 'rest:https://uploader:' + password + '@rest-server:8000/uploader/'),
                        ('repository.password', repository_password), ('ca.crt', (work / 'server.crt').read_text())]:
        (work / 'client' / name).write_text(value)
        (work / 'client' / name).chmod(0o600)
    auth = prefix + '-auth'
    containers.append(auth)
    run(['docker', 'run', '--rm', '--name', auth, '--network', 'none', '--read-only', '--tmpfs', '/tmp', '--user', str(os.getuid()) + ':' + str(os.getgid()),
         '-v', str(work) + ':/fixture', '--entrypoint', 'htpasswd', SERVER, '-Bbc', '/fixture/htpasswd', 'uploader', password])
    (work / 'htpasswd').chmod(0o644)
    helper('own-host', ['-e', "const fs=require('node:fs');for(const p of ['capture','baseline','audit-after','client','receipts','spool','protected','snapshot-output','snapshot-state','pre-audit','post-audit','snapshot-credentials','maintenance','install-state','post-snapshot','post-encrypted','prechange-spool','postinstall-spool']){const u=['client','receipts','spool','prechange-spool','postinstall-spool'].includes(p)?12010:1003;fs.chownSync('/fixture/'+p,u,u);if(p==='client')for(const f of fs.readdirSync('/fixture/'+p))fs.chownSync('/fixture/'+p+'/'+f,u,u)}"],
           ['-v', str(work) + ':/fixture'], user='0:0', caps=['CHOWN', 'DAC_OVERRIDE'])
    server = prefix + '-rest-server'
    containers.append(server)
    run(['docker', 'run', '-d', '--name', server, '--network', backup_network, '--network-alias', 'rest-server',
         '--user', '12010:12010', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
         '-v', repository_volume + ':/data', '-v', str(work / 'server.crt') + ':/tls.crt:ro',
         '-v', str(work / 'server.key') + ':/tls.key:ro', '-v', str(work / 'htpasswd') + ':/auth:ro',
         '--entrypoint', '/usr/bin/rest-server', SERVER, '--path=/data', '--listen=:8000', '--append-only', '--private-repos',
         '--htpasswd-file=/auth', '--tls', '--tls-cert=/tls.crt', '--tls-key=/tls.key', '--tls-min-ver=1.3'])
    key = helper('age-key', ['-e', "const c=require('node:child_process');const k=c.execFileSync('age-keygen');const r=c.execFileSync('age-keygen',['-y'],{input:k});process.stdout.write(r)"]).stdout
    (work / 'recipient.txt').write_bytes(key)
    (work / 'recipient.txt').chmod(0o644)
    # Render source graph, then substitute ONLY fixture resources in a private copy.
    env = {**os.environ, 'MYIMS_OPENBAO_RECOVERY_OPERATION': op}
    rendered = json.loads(subprocess.check_output(['docker', 'compose', '-f', str(ROOT / 'infra/backup/compose.recovery-capture.yaml'), '--profile', 'manual-capture', '--profile', 'manual-restoration', '--profile', 'manual-capture-archive', '--profile', 'manual-capture-audit', 'config', '--format', 'json'], env=env))
    replacements = {'/seal/seal.json': None, '/seal/ca.crt': None, '/backup': work / 'capture', '/input': work / 'capture',
                    '/output': work / 'baseline', '/recipient': work / 'recipient.txt'}
    for name, service in rendered['services'].items():
        new = []
        has_seal = False
        for mount in service['volumes']:
            target = mount['target']
            if target.startswith('/seal/'):
                has_seal = True
                continue
            if mount['type'] == 'volume':
                mount['source'] = audit_volume
            elif target in replacements:
                mount['source'] = str(work / 'audit-after' if name == 'archive-audit' and target == '/output' else replacements[target])
            new.append(mount)
        if has_seal:
            new.append({'type': 'volume', 'source': seal_volume, 'target': '/seal', 'read_only': True})
        if name == 'capture-helper':
            new += [{'type': 'bind', 'source': str(ROOT/'scripts'), 'target': '/bootstrap', 'read_only': True},
                    {'type': 'bind', 'source': str(work/'candidate.json'), 'target': '/candidate.json', 'read_only': True},
                    {'type': 'bind', 'source': str(work/'protected'), 'target': '/protected-output'},
                    {'type': 'bind', 'source': str(work/'proof'), 'target': '/proof', 'read_only': True}]
        if name == 'capture-helper':
            new += [{'type':'bind','source':str(work/source),'target':target} for source,target in
                [('snapshot-credentials','/snapshot-credentials'),('maintenance','/maintenance-output'),('install-state','/install-state')]]
        service['volumes'] = new
        service.pop('profiles', None)
    rendered['name'] = prefix + '-tools'
    rendered['networks'] = {'normal-provider': {'external': True, 'name': normal_network}, 'isolated-provider': {'external': True, 'name': isolated_network}}
    rendered['volumes'] = {name: {'external': True} for name in [audit_volume, seal_volume]}
    cap_file = work / 'capture.json'
    cap_file.write_text(json.dumps(rendered))
    spec = importlib.util.spec_from_file_location('native_controller', ROOT / 'scripts/backup-host/execute-development-capture.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.MANIFEST, module.STATUS = work / 'request.json', work / 'status.json'
    expected_mounts = [{'type': v['Type'], 'name': v.get('Name'), 'source': v['Source'], 'destination': v['Destination'], 'readWrite': v['RW']} for v in info['Mounts']]
    module.MANIFEST.write_text(json.dumps({'operationId': op, 'candidateToolsImage': {'imageId': TOOLS},
        'currentProviderDockerMetadata': {'name': provider, 'imageId': info['Image'], 'mounts': expected_mounts},
        'ownerApproval': {'consumed': False, 'executionStarted': False},
        'recoveryConfigurationSha256': hashlib.sha256(normal_config.replace('disable_unauthed_generate_root_endpoints = true', 'disable_unauthed_generate_root_endpoints = false').encode()).hexdigest()}))
    module.STATUS.write_text('{}')
    controller = module.Executor()
    controller.provider, controller.work = provider, work / 'execution'
    controller.normal_network, controller.isolated_network, controller.backup_network = networks
    controller.backup_root = work
    controller.base, controller.cap = base, ['docker', 'compose', '-p', prefix + '-tools', '-f', str(cap_file)]
    controller.recovery_overlay, controller.restoration_overlay = str(work / 'recovery.json'), str(work / 'restoration.json')
    # All real execution methods run unchanged. Only bootstrap/preflight and exact
    # fixture resource identities differ; production authorization is never used.
    spec2 = importlib.util.spec_from_file_location('bootstrap_controller', ROOT/'scripts/backup-host/bootstrap-controller.py')
    bootstrap = importlib.util.module_from_spec(spec2); spec2.loader.exec_module(bootstrap)
    # Fixture setup initializes its own empty repository exactly once. The actual
    # bootstrap flow starts with an EXISTING initialized repository, never init.
    controller.initialize()
    spec3 = importlib.util.spec_from_file_location('bootstrap_host_ports_native', ROOT/'scripts/backup-host/bootstrap-host-ports.py')
    host = importlib.util.module_from_spec(spec3); spec3.loader.exec_module(host)
    def prepare_host():
        current=json.loads(run(['docker','inspect',provider]).stdout)[0]
        bootstrap.validate_closed_provider(current,{'name':provider,'imageId':info['Image'],'network':normal_network,'mounts':info['Mounts']},
          {'operationId':'24096f3d-bf41-4ec2-9e12-95e2057c115d','rootRevocationVerified':True,'normalRestorationVerified':True,'deadlineCancelled':True})
        check('closed_prior_operation_label_and_exact_provider_metadata_reconciled',True)
    config={'repositoryId':controller.record['repository']['repositoryId'], 'scripts':str(ROOT/'scripts'),
      'journal':str(work/'controller-intent'),'capture':str(work/'capture'),'baseline':str(work/'baseline'),
      'preAudit':str(work/'pre-audit'),'postAudit':str(work/'post-audit'),'auditVolume':audit_volume,
      'recipient':str(work/'recipient.txt'),'client':str(work/'client'),'receipts':str(work/'receipts'),
      'prechangeSpool':str(work/'prechange-spool'),'postinstallSpool':str(work/'postinstall-spool'),
      'snapshotCredentials':str(work/'snapshot-credentials'),'postSnapshot':str(work/'post-snapshot'),
      'snapshotState':str(work/'snapshot-state'),'postEncrypted':str(work/'post-encrypted'),
      'actionScript':'/bootstrap/backup-evaluation/bootstrap-run-action.mjs',
      'candidatePath':str(work/'candidate.json'),'expectedCandidate':candidate}
    stage='actual-bootstrap-controller'
    ports=host.HostPorts(controller,config,prepare_host)
    try:
        bootstrap.bootstrap_flow(ports)
        if options.lost_response_after_write is not None: raise RuntimeError('injected_failure_not_observed')
    except RuntimeError as error:
        if options.lost_response_after_write is None or str(error)!='bootstrap-incomplete-protection-restored-no-retry': raise
        result=helper('read-journal',['-e',"const fs=require('node:fs');const rows=fs.readFileSync('/protected/journal.jsonl','utf8').trim().split('\\n').map(JSON.parse);console.log(JSON.stringify({started:rows.filter(r=>r.event==='write-started').map(r=>r.index),acknowledged:rows.filter(r=>r.event==='write-acknowledged').map(r=>r.index)}))"],['-v',str(work/'install-state')+':/protected:ro'])
        observed=json.loads(result.stdout)
        check('lost_native_write_reply_stops_without_retry_and_preserves_partial_journal',observed['started']==list(range(options.lost_response_after_write+1)) and observed['acknowledged']==list(range(options.lost_response_after_write)))
        check('partial_install_never_runs_scoped_postinstall_capture',json.loads(helper('empty-snapshot-output',['-e',"console.log(JSON.stringify(require('node:fs').readdirSync('/output').length))"],['-v',str(work/'post-snapshot')+':/output:ro']).stdout)==0)
    check('semantic_prestate_reviews_existing_custodian_entity_and_all_role_aliases',controller.record['prestateReview']['entityCount']==1)
    evidence['faultAfterWrite']=options.lost_response_after_write
    check('host_guard_health_and_backup_freshness_checked_for_each_write',ports.guard_checks==(10 if options.lost_response_after_write is None else options.lost_response_after_write+2))
    check('prechange_backup_retrieval_verified',controller.record.get('prechangeBackup',{}).get('exactSnapshotFileCount')==4)
    if options.lost_response_after_write is None:
        check('postinstall_backup_independently_encrypted_uploaded_and_retrieved',controller.record.get('postinstallBackup',{}).get('exactSnapshotFileCount')==4)
        check('postinstall_is_a_different_restic_snapshot',controller.record['prechangeBackup']['snapshotId']!=controller.record['postinstallBackup']['snapshotId'])
    record=controller.record
    check('root_revoked_and_normal_tls_405_restored_before_guard_cancellation',record['rootRevocationVerified'] and record['normalRestorationVerified'] and record['deadlineCancelled'])
    final = json.loads(run(['docker', 'inspect', provider]).stdout)[0]
    check('final_provider_running_on_only_normal_network_with_original_restart_policy', final['State']['Running'] and list(final['NetworkSettings']['Networks']) == [normal_network] and final['HostConfig']['RestartPolicy']['Name'] == 'unless-stopped')
    evidence['controllerSha256'] = hashlib.sha256((ROOT / 'scripts/backup-host/bootstrap-controller.py').read_bytes()).hexdigest()
    evidence['provisionerSha256'] = hashlib.sha256((ROOT / 'scripts/openbao/bootstrap-provision.mjs').read_bytes()).hexdigest()
    evidence['harnessSha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    evidence['hostPortsSha256'] = hashlib.sha256((ROOT/'scripts/backup-host/bootstrap-host-ports.py').read_bytes()).hexdigest()
    evidence['helperSha256'] = hashlib.sha256((ROOT/'scripts/openbao/bootstrap-action.mjs').read_bytes()).hexdigest()
    evidence['bridgeSha256'] = hashlib.sha256((ROOT/'scripts/backup-host/guard-bridge.py').read_bytes()).hexdigest()
    evidence['initializerSha256'] = hashlib.sha256((ROOT / 'scripts/backup/repository-initialize.mjs').read_bytes()).hexdigest()
    check('exercised_sources_unchanged_during_run',all(hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest for name,digest in evidence['sourceSha256'].items()))
    evidence['status'] = 'passed'
except Exception as error:
    evidence['status'] = 'failed'
    if controller:
        evidence['helperRefusal']=controller.record.get('helperRefusal')
        evidence['helperCommandFailure']=controller.record.get('helperCommandFailure')
    evidence['failure'] = {'code': str(error) if isinstance(error, RuntimeError) else type(error).__name__, 'phase': controller.record['phase'] if controller else stage}
finally:
    if evidence['status'] == 'failed' and provider:
        result = run(['docker', 'logs', '--tail', '25', provider], check=False)
        log = (result.stdout + result.stderr).decode(errors='replace')[-4096:]
        if initial:
            for secret in [initial['root_token'], *initial['keys_base64']]:
                log = log.replace(secret, '[redacted]')
        evidence['syntheticProviderLog'] = log
    if 'ports' in locals(): containers.extend(ports.containers)
    if controller and controller.helper:
        containers.append(controller.helper)
    for name in containers:
        run(['docker', 'rm', '-f', name], check=False)
    guard_stopped = True
    if controller and controller.guard:
        guard = Path(controller.guard['directory'])
        # Failed fixtures are destroyed before cancelling containment authority.
        if not (guard / 'cancelled').exists():
            run(['node', str(ROOT / 'scripts/openbao/recovery-deadline.mjs'), 'cancel', op, str(guard)], check=False)
        guard_stopped = False
        for _ in range(60):
            try:
                state = Path('/proc/' + str(controller.guard['watcherPid']) + '/stat').read_text().rsplit(')', 1)[1].split()[0]
                if state in ['Z', 'X']:
                    guard_stopped = True
                    break
            except FileNotFoundError:
                guard_stopped = True
                break
            time.sleep(.1)
        if guard_stopped:
            shutil.rmtree(guard)
    for name in volumes:
        run(['docker', 'volume', 'rm', name], check=False)
    for name in networks:
        run(['docker', 'network', 'rm', name], check=False)
    # Return ONLY this fresh fixture's directory ownership for exact removal.
    helper('cleanup-owner', ['-e', "const fs=require('node:fs');function visit(p){const s=fs.lstatSync(p);if(s.isDirectory()&&!s.isSymbolicLink()){fs.chownSync(p,Number(process.argv[1]),Number(process.argv[2]));for(const f of fs.readdirSync(p))visit(p+'/'+f)}}visit('/fixture')", str(os.getuid()), str(os.getgid())],
           ['-v', str(work) + ':/fixture'], user='0:0', caps=['CHOWN', 'DAC_OVERRIDE'])
    shutil.rmtree(work)
    evidence['cleanup'] = {'deadlineWatcherStopped': guard_stopped, 'containersAbsent': all(run(['docker', 'inspect', name], check=False).returncode != 0 for name in containers),
                           'volumesAbsent': all(run(['docker', 'volume', 'inspect', name], check=False).returncode != 0 for name in volumes),
                           'networksAbsent': all(run(['docker', 'network', 'inspect', name], check=False).returncode != 0 for name in networks), 'privateFixtureRemoved': not work.exists()}
    if not all(evidence['cleanup'].values()):
        evidence['status'] = 'failed'
    for path in [ROOT / ('docs/status/p3-u3a-bootstrap-host-evidence.json' if options.lost_response_after_write is None else 'docs/status/p3-u3a-bootstrap-host-fault-evidence.json'), ROOT / 'docs/status/p3-u3a-disposable-runs' / (op + '.json')]:
        path.write_text(json.dumps(evidence, indent=2) + '\n')
    print(json.dumps(evidence))
    if evidence['status'] != 'passed':
        raise SystemExit(1)
