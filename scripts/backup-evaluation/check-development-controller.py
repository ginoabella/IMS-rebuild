#!/usr/bin/env python3
"""Actual attended-controller methods against fresh synthetic services only.
No retained mounts, credentials, provider, repository, or source graph activation.
"""
import hashlib
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
op = str(uuid.uuid4())
prefix = 'myims-controller-eval-' + op[:8]
work = Path(tempfile.mkdtemp(prefix=prefix + '-'))
containers, volumes, networks = ['myims-recovery-repository-init-' + op], [], []
evidence = {'operationId': op, 'retainedAccess': False, 'checks': [], 'status': 'in-progress'}
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
    for name in ['capture', 'baseline', 'audit-after', 'client', 'receipts']:
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
        ('initial', 'normal', work / 'normal.hcl', 'unless-stopped', {}),
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
    def api(path, body=None, token=None):
        evidence['lastFixtureApi'] = path
        req = urllib.request.Request(address + path, data=None if body is None else json.dumps(body).encode(),
                                     headers={'Content-Type': 'application/json', **({'X-Vault-Token': token} if token else {})})
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
    helper('own-host', ['-e', "const fs=require('node:fs');for(const p of ['capture','baseline','audit-after','client','receipts']){const u=['client','receipts'].includes(p)?12010:1003;fs.chownSync('/fixture/'+p,u,u);if(p==='client')for(const f of fs.readdirSync('/fixture/'+p))fs.chownSync('/fixture/'+p+'/'+f,u,u)}"],
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
    stage = 'actual-controller'
    module.capture_flow(controller)
    record = controller.record
    check('actual_controller_initializes_then_captures_and_revokes_one_root', record.get('repositoryInitialized') and record.get('captureComplete') and record.get('rootRevocationVerified'))
    check('actual_controller_restores_tls_405_before_guard_cancellation_and_restart', record.get('normalRestorationVerified') and record.get('deadlineCancelled') and record.get('normalRestartPolicyRestored'))
    check('actual_controller_removes_root_helper_and_encrypts_both_artifacts', record.get('captureHelperRemoved') and record.get('baselineArchive', {}).get('status') == 'passed' and record.get('postCleanupAuditArchive', {}).get('status') == 'passed')
    final = json.loads(run(['docker', 'inspect', provider]).stdout)[0]
    check('final_provider_running_on_only_normal_network_with_original_restart_policy', final['State']['Running'] and list(final['NetworkSettings']['Networks']) == [normal_network] and final['HostConfig']['RestartPolicy']['Name'] == 'unless-stopped')
    evidence['controllerSha256'] = hashlib.sha256((ROOT / 'scripts/backup-host/execute-development-capture.py').read_bytes()).hexdigest()
    evidence['initializerSha256'] = hashlib.sha256((ROOT / 'scripts/backup/repository-initialize.mjs').read_bytes()).hexdigest()
    evidence['status'] = 'passed'
except Exception as error:
    evidence['status'] = 'failed'
    evidence['failure'] = {'code': str(error) if isinstance(error, RuntimeError) else type(error).__name__, 'phase': controller.record['phase'] if controller else stage}
finally:
    if evidence['status'] == 'failed' and provider:
        result = run(['docker', 'logs', '--tail', '25', provider], check=False)
        log = (result.stdout + result.stderr).decode(errors='replace')[-4096:]
        if initial:
            for secret in [initial['root_token'], *initial['keys_base64']]:
                log = log.replace(secret, '[redacted]')
        evidence['syntheticProviderLog'] = log
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
    for path in [ROOT / 'docs/status/p3-u3a-native-controller-evidence.json', ROOT / 'docs/status/p3-u3a-disposable-runs' / (op + '.json')]:
        path.write_text(json.dumps(evidence, indent=2) + '\n')
    print(json.dumps(evidence))
    if evidence['status'] != 'passed':
        raise SystemExit(1)
