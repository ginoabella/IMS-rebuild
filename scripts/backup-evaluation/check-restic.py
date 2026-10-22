#!/usr/bin/env python3
"""Disposable Rest Server append-only fallback probe; no retained services/mounts."""
import base64
import argparse
import datetime as dt
import hashlib
import io
import json
import os
import pathlib
import shutil
import signal
import ssl
import subprocess
import tempfile
import tarfile
import time
import urllib.error
import urllib.request
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
SERVER = 'restic/rest-server:0.14.0@sha256:d2aff06f47eb38637dff580c3e6bce4af98f386c396a25d32eb6727ec96214a5'
CLIENT = 'restic/restic:0.19.1@sha256:136600b6ff6843d61d355f7f71f460a166429f35de6fd11b568fece3c9a4d510'
BAO = 'quay.io/openbao/openbao:2.7.1@sha256:6d2b93856e3fcf7b18ad855a0b51eaba474dc8b79cf554379ea32034797d2acf'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--age', default='fixture-age')
parser.add_argument('--age-keygen', default='fixture-age-keygen')
parser.add_argument('--tools-image', default='myims-backup-tools:development-candidate')
parser.add_argument('--recovery-authority-candidate', action='store_true', help='Fresh disposable TLS/Raft recovery path only; requires backup-first provisioning')
parser.add_argument('--backup-first-provisioning', action='store_true', help='Disposable installer rehearsal: verify backup and isolated restore before four backup identity writes; no recovery or retained access')
parser.add_argument('--snapshot-candidate', action='store_true', help='Exercise the inactive snapshot-only TLS/AppRole source helper')
parser.add_argument('--initialize-helper', action='store_true', help='Test operation-bound initializer with native TLS Restic; disposable only')
parser.add_argument('--development-artifacts', action='store_true', help='Test the candidate Compose services/helpers with TLS and file credentials')
options = parser.parse_args()
if options.recovery_authority_candidate and not options.backup_first_provisioning:
    parser.error('--recovery-authority-candidate requires --backup-first-provisioning')
if options.backup_first_provisioning and (not options.development_artifacts or options.snapshot_candidate):
    parser.error('--backup-first-provisioning requires --development-artifacts and excludes --snapshot-candidate')
if options.snapshot_candidate and not options.development_artifacts:
    parser.error('--snapshot-candidate requires --development-artifacts')
if options.initialize_helper and not options.development_artifacts:
    parser.error('--initialize-helper requires --development-artifacts')
os.umask(0o077)
operation = str(uuid.uuid4())
prefix = 'myims-restic-eval-' + operation[:8]
work = pathlib.Path(tempfile.mkdtemp(prefix=prefix + '-'))
network, volume, server = prefix + '-net', prefix + '-data', prefix + '-server'
containers = []
extra_volumes = []
extra_networks = []
source_audit_path = '/bao/audit/endpoint.json' if options.recovery_authority_candidate else '/tmp/audit.jsonl'
recovery_deadline = None
recovery_normal_config = None
recovery_started = None
recovery_guard = None
TOOLS = options.tools_image
source_tls = None
compose_env = None
archive_name = 'archive.fixture.age'
manifest_name = 'manifest.json'
password, repo_password = uuid.uuid4().hex, uuid.uuid4().hex
synthetic_secrets = [password, repo_password]
evidence = {'operationId': operation, 'startedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'serverImage': SERVER, 'clientImage': CLIENT, 'openbaoImage': BAO, 'retainedAccess': False, 'checks': [], 'developmentArtifacts': options.development_artifacts, 'snapshotCandidate': options.snapshot_candidate, 'backupFirstProvisioning': options.backup_first_provisioning, 'recoveryAuthorityCandidate': options.recovery_authority_candidate}
evidence['harnessSha256'] = hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()
stage = 'setup'


class FixtureDeadlineReached(BaseException):
    pass


def run(args, data=None, check=True):
    if args[0] in ('fixture-age', 'fixture-age-keygen'):
        name = prefix + '-age-' + uuid.uuid4().hex[:6]
        containers.append(name)
        executable = 'age-keygen' if args[0].endswith('keygen') else 'age'
        args = ['docker', 'run', '--rm', '-i', '--name', name, '--network', 'none',
                '--label', 'myims.backup-eval=' + operation, '--user', str(os.getuid()) + ':' + str(os.getgid()),
                '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
                '-v', str(work) + ':/fixture', '--entrypoint', executable, TOOLS,
                *[a.replace(str(work), '/fixture') for a in args[1:]]]
    remaining = 600 if recovery_deadline is None else min(600, recovery_deadline - time.monotonic())
    if remaining <= 0 and check: raise FixtureDeadlineReached()
    p = subprocess.run(args, input=data, capture_output=True, timeout=max(1, remaining) if check else 60)
    if check and p.returncode:
        # Never emit command/environment/body, which can contain fixture secrets.
        diagnostic = p.stderr.decode(errors='replace')[-1500:]
        for secret in synthetic_secrets:
            diagnostic = diagnostic.replace(secret, '[redacted]')
        evidence['commandDiagnostic'] = diagnostic
        raise RuntimeError('command_failed_' + pathlib.Path(args[0]).name)
    return p


def record(name, passed, **details):
    evidence['checks'].append({'name': name, 'passed': bool(passed), **details})


def restic(*args, check=True):
    name = prefix + '-client-' + uuid.uuid4().hex[:6]
    containers.append(name)
    command = ['docker', 'run', '--name', name, '--label', 'myims.backup-eval=' + operation, '--network', network,
               '--user', str(os.getuid()) + ':' + str(os.getgid()),
               '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--read-only',
               '--tmpfs', '/tmp', '--tmpfs', '/root/.cache', '-v', str(work / 'input') + ':/input:ro',
               '-e', 'RESTIC_REPOSITORY=rest:http://' + server + ':8000/uploader/',
               '-e', 'RESTIC_REST_USERNAME=uploader', '-e', 'RESTIC_REST_PASSWORD=' + password,
               '-e', 'RESTIC_PASSWORD=' + repo_password, CLIENT, '--no-cache', *args]
    if options.development_artifacts:
        # No password or authenticated URL in Docker environment or command line.
        command = command[:command.index('-e')]
        command += ['-v', str(work / 'client') + ':/run/client:ro', CLIENT,
                    '--repository-file=/run/client/repository.url', '--password-file=/run/client/repository.password',
                    '--cacert=/run/client/ca.crt', '--no-cache', *args]
    return run(command, check=check)


def compose(*args, check=True):
    return run(['docker', 'compose', '--project-name', prefix, '--env-file', str(work / 'compose.env'),
                '-f', str(ROOT / 'infra/backup/compose.yaml'), *(['-f', str(work / 'tools-override.json')] if (work / 'tools-override.json').exists() else []), *args], check=check)


def compose_helper(service, *args, check=True):
    name = prefix + '-helper-' + uuid.uuid4().hex[:6]
    containers.append(name)
    return compose('run', '--rm', '--no-deps', '--name', name, service, *args, check=check)


def http(method, path, data=None, auth=True):
    headers = {'Authorization': 'Basic ' + base64.b64encode(('uploader:' + password).encode()).decode()} if auth else {}
    req = urllib.request.Request(endpoint + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.build_opener(urllib.request.ProxyHandler({}), *([urllib.request.HTTPSHandler(context=probe_tls)] if options.development_artifacts else [])).open(req, timeout=5) as res:
            return res.status, res.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def bao_api(address, path, body=None, token=None, binary=False, method=None):
    evidence['lastFixtureApi'] = path
    if recovery_deadline is not None and time.monotonic() >= recovery_deadline: raise FixtureDeadlineReached()
    request_timeout = 15 if recovery_deadline is None else min(15, max(.1, recovery_deadline-time.monotonic()))
    req = urllib.request.Request(address + '/v1/' + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Content-Type': 'application/json', **({'X-Vault-Token': token} if token else {})}, method=method)
    with urllib.request.build_opener(urllib.request.ProxyHandler({}), *([urllib.request.HTTPSHandler(context=source_tls)] if address.startswith('https:') else [])).open(req, timeout=request_timeout) as res:
        data = res.read()
        return data if binary else json.loads(data or '{}')


def start_bao(suffix, fixture_network=None):
    fixture_network = fixture_network or network
    global source_tls
    name = prefix + '-' + suffix
    containers.append(name)
    config = 'disable_mlock=true\napi_addr="http://127.0.0.1:8200"\ncluster_addr="http://127.0.0.1:8201"\nstorage "raft" { path="/bao/data" node_id="fixture-primary" }\nlistener "tcp" { address="0.0.0.0:8200" tls_disable=true }\naudit "file" "eval" { options { file_path="/tmp/audit.jsonl" log_raw="false" } }\n'
    if options.recovery_authority_candidate:
        # Declarative audit configuration is part of the restored state. Keep its
        # path identical on both nodes, backed by independently owned volumes.
        config = config.replace('/tmp/audit.jsonl', source_audit_path)
    tls_args = []
    if (options.snapshot_candidate or options.backup_first_provisioning) and suffix == 'source-bao':
        key_path, cert_path = work / 'source-tls.key', work / 'source-tls.crt'
        run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', str(key_path),
             '-out', str(cert_path), '-days', '1', '-subj', '/CN=endpoint-secrets', '-addext', 'subjectAltName=DNS:endpoint-secrets'])
        # Synthetic TLS leaf only, within the private fixture directory. Never retained.
        key_path.chmod(0o644)
        cert_path.chmod(0o644)
        config = config.replace('tls_disable=true', 'tls_cert_file="/bao/config/source.crt" tls_key_file="/bao/config/source.key"')
        config = config.replace('api_addr="http://127.0.0.1:8200"', 'api_addr="https://endpoint-secrets:8200"')
        if options.recovery_authority_candidate:
            config = config.replace('tls_key_file="/bao/config/source.key"', 'tls_key_file="/bao/config/source.key" disable_unauthed_generate_root_endpoints=true')
            config = config.replace('/tmp/audit.jsonl', source_audit_path)
        tls_args = ['--network-alias', 'endpoint-secrets', '-v', str(key_path) + ':/bao/config/source.key:ro', '-v', str(cert_path) + ':/bao/config/source.crt:ro']
        source_tls = ssl.create_default_context(cafile=str(cert_path))
        source_tls.check_hostname = False  # Raw host fixture probes only; actual source helper validates DNS SAN.
    config_path = work / (suffix + '.hcl')
    config_path.write_text(config)
    config_path.chmod(0o644)
    storage_args = ['--tmpfs', '/bao/data:uid=1003,gid=1003,mode=0700']
    if options.recovery_authority_candidate and suffix in ('source-bao', 'restore-bao'):
        owned_volumes = []
        for purpose in ['raft', 'audit']:
            candidate = prefix + '-' + suffix + '-' + purpose
            run(['docker', 'volume', 'create', '--label', 'myims.backup-eval=' + operation, candidate])
            extra_volumes.append(candidate)
            owned_volumes.append(candidate)
        owner = prefix + '-helper-' + suffix + '-volume-owner'
        containers.append(owner)
        run(['docker', 'run', '--rm', '--name', owner, '--network', 'none', '--user', '0:0', '--read-only',
             '--cap-drop', 'ALL', '--cap-add', 'CHOWN', '-v', owned_volumes[0] + ':/data',
             '-v', owned_volumes[1] + ':/audit', '--entrypoint', 'chown', BAO, '1003:1003', '/data', '/audit'])
        storage_args = ['-v', owned_volumes[0] + ':/bao/data', '-v', owned_volumes[1] + ':/bao/audit']
    run(['docker', 'run', '-d', '--name', name, '--label', 'myims.backup-eval=' + operation,
         *(['--label', 'myims.openbao.recovery.operation=' + operation] if options.recovery_authority_candidate and suffix == 'source-bao' else []), '--network', fixture_network,
         '--user', '1003:1003', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
         *storage_args, '--tmpfs', '/tmp:uid=1003,gid=1003',
         '-v', str(config_path) + ':/bao/config/eval.hcl:ro', *tls_args, BAO, 'server', '-config=/bao/config/eval.hcl'])
    info = json.loads(run(['docker', 'inspect', name]).stdout)[0]
    assert not info['HostConfig']['PortBindings']
    address = ('https://' if tls_args else 'http://') + info['NetworkSettings']['Networks'][fixture_network]['IPAddress'] + ':8200'
    for _ in range(150):
        try:
            if not bao_api(address, 'sys/init')['initialized']:
                break
        except Exception:
            pass
        time.sleep(.2)
    init = bao_api(address, 'sys/init', {'secret_shares': 1, 'secret_threshold': 1})
    key, token = init['keys_base64'][0], init['root_token']
    synthetic_secrets.extend([key, token])
    bao_api(address, 'sys/unseal', {'key': key})
    for _ in range(150):
        try:
            if bao_api(address, 'sys/health')['sealed'] is False:
                return name, address, key, token
        except Exception:
            pass
        time.sleep(.2)
    raise RuntimeError('synthetic_bao_not_active')


signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))

try:
    (work / 'input').mkdir()
    run(['docker', 'network', 'create', '--internal', '--label', 'com.docker.compose.project=' + prefix, '--label', 'com.docker.compose.network=repository', '--label', 'myims.backup-eval=' + operation, network])
    stage = 'synthetic_native_snapshot'
    source_bao, source_address, seal, root_token = start_bao('source-bao')
    sentinel = 'synthetic-backup-archive-' + operation
    bao_api(source_address, 'sys/mounts/synthetic', {'type': 'kv', 'options': {'version': '2'}}, root_token)
    if options.recovery_authority_candidate:
        # A newly enabled KV v2 plugin can still be initializing after mount ack.
        # Wait using reads before the single fixture sentinel write.
        for _ in range(100):
            try:
                bao_api(source_address, 'synthetic/config', token=root_token)
                break
            except urllib.error.HTTPError as error:
                if error.code not in (400, 404, 503): raise
                time.sleep(.1)
        else: raise RuntimeError('fresh_fixture_kv_backend_not_ready')
    bao_api(source_address, 'synthetic/data/fixture', {'data': {'value': sentinel}}, root_token)
    if options.recovery_authority_candidate:
        stage = 'fresh_fixture_recovery_preparation'
        # Synthetic retained-state analogue, initialized only in this disposable run.
        custodian_policy = 'path "sys/storage/raft/snapshot" { capabilities=["deny"] }\npath "sys/policies/acl/platform-deployment-maintainer" { capabilities=["deny"] }\npath "auth/token/lookup-self" { capabilities=["read"] }\npath "auth/token/revoke-self" { capabilities=["update"] }\n'
        custodian_password = uuid.uuid4().hex + uuid.uuid4().hex
        synthetic_secrets.append(custodian_password)
        bao_api(source_address, 'sys/policies/acl/platform-deployment-maintainer', {'policy': custodian_policy}, root_token)
        bao_api(source_address, 'sys/auth/platform-custodian', {'type':'userpass','config':{'default_lease_ttl':'900s','max_lease_ttl':'900s'}}, root_token)
        human_path = 'auth/platform-custodian/users/platform-owner-custodian'
        bao_api(source_address, human_path, {'password':custodian_password,'token_policies':['platform-deployment-maintainer'],'token_no_default_policy':True,'token_ttl':'900s','token_max_ttl':'900s','token_explicit_max_ttl':'900s'}, root_token)
        human_before = bao_api(source_address, human_path, token=root_token)['data']
        restore_reader_password = uuid.uuid4().hex + uuid.uuid4().hex
        synthetic_secrets.append(restore_reader_password)
        bao_api(source_address, 'sys/policies/acl/synthetic-restore-reader', {'policy':'path "synthetic/data/fixture" { capabilities=["read"] }\npath "auth/token/lookup-self" { capabilities=["read"] }\npath "auth/token/revoke-self" { capabilities=["update"] }\n'}, root_token)
        bao_api(source_address, 'auth/platform-custodian/users/synthetic-restore-reader', {'password':restore_reader_password,'token_policies':['synthetic-restore-reader'],'token_no_default_policy':True,'token_ttl':'60s','token_max_ttl':'60s','token_explicit_max_ttl':'60s'}, root_token)
        initial_root = root_token
        bao_api(source_address, 'auth/token/revoke-self', {}, initial_root)
        try:
            bao_api(source_address, 'auth/token/lookup-self', token=initial_root)
            raise RuntimeError('initial_fixture_root_still_live')
        except urllib.error.HTTPError as error:
            if error.code != 403: raise RuntimeError('initial_root_cleanup_uncertain')
        try:
            bao_api(source_address, 'sys/generate-root/attempt')
            raise RuntimeError('normal_fixture_generation_unprotected')
        except urllib.error.HTTPError as error:
            if error.code != 405: raise RuntimeError('normal_fixture_generation_unexpected_status')
        record('normal_fixture_root_generation_disabled_and_initial_root_revoked', True)
        recovery_normal_config = (work / 'source-bao.hcl').read_text()
        assert recovery_normal_config.count('disable_unauthed_generate_root_endpoints=true') == 1
        audit_before_recovery = run(['docker','exec',source_bao,'cat',source_audit_path]).stdout
        recovery_started = time.monotonic()
        recovery_deadline = recovery_started + 840
        deadline_wall = (dt.datetime.now(dt.timezone.utc)+dt.timedelta(seconds=840)).isoformat()
        recovery_guard = json.loads(run(['node',str(ROOT/'scripts/openbao/recovery-deadline.mjs'),'start',operation,deadline_wall]).stdout)
        assert recovery_guard['state']=='deadline_armed'
        run(['node',str(ROOT/'scripts/openbao/recovery-deadline.mjs'),'assert-ready',operation,recovery_guard['directory']])
        record('independent_fixture_deadline_guard_armed_before_recovery_config',True,maximumSeconds=840)
        (work / 'source-bao.hcl').write_text(recovery_normal_config.replace('disable_unauthed_generate_root_endpoints=true','disable_unauthed_generate_root_endpoints=false'))
        run(['docker','restart',source_bao])
        # Container restart may choose a new internal address; do not cache it.
        source_info = json.loads(run(['docker','inspect',source_bao]).stdout)[0]
        source_address = 'https://' + source_info['NetworkSettings']['Networks'][network]['IPAddress'] + ':8200'
        for _ in range(150):
            try:
                if bao_api(source_address,'sys/seal-status')['sealed']:
                    bao_api(source_address,'sys/unseal',{'key':seal})
                if not bao_api(source_address,'sys/health')['sealed']: break
            except Exception: pass
            time.sleep(.2)
        else: raise RuntimeError('fixture_recovery_unseal_unavailable')
        attempt = bao_api(source_address,'sys/generate-root/attempt')
        if attempt['started'] or not 16 <= attempt['otp_length'] <= 128: raise RuntimeError('unexpected_fixture_generation_attempt')
        otp = base64.b64encode(os.urandom(128)).decode()[:attempt['otp_length']]
        started = bao_api(source_address,'sys/generate-root/attempt',{'otp':otp})
        completed = bao_api(source_address,'sys/generate-root/update',{'nonce':started['nonce'],'key':seal})
        if not completed.get('complete'): raise RuntimeError('fixture_quorum_incomplete')
        # OpenBao returns unpadded standard base64; Node's existing recovery
        # helper accepts this natively. Add framing padding for Python's decoder.
        encoded_text = completed['encoded_token']
        encoded = base64.b64decode(encoded_text + '=' * (-len(encoded_text) % 4), validate=True)
        if len(encoded)>len(otp): raise RuntimeError('fixture_root_encoding_unexpected')
        root_token = bytes(value ^ ord(otp[index]) for index,value in enumerate(encoded)).decode()
        synthetic_secrets.append(root_token)
        identity = bao_api(source_address,'auth/token/lookup-self',token=root_token)['data']
        record('fresh_fixture_seal_quorum_root_recovery', identity['policies']==['root'] and root_token!=initial_root,
               retainedKeyUsed=False, rootWrittenToDisk=False)
        record('fixture_audit_continuity_across_recovery_restart', run(['docker','exec',source_bao,'cat',source_audit_path]).stdout.startswith(audit_before_recovery))
    if options.snapshot_candidate:
        stage = 'snapshot_only_approle_capture'
        proposal = json.loads((ROOT / 'docs/planning/p3-u3a-backup-installation-review-manifest.json').read_text())
        for write in proposal['backupProvisioning'][:3]:
            bao_api(source_address, write['path'], write['body'], root_token)
        role_id = bao_api(source_address, 'auth/platform-backup/role/platform-raft-snapshot-reader/role-id', token=root_token)['data']['role_id']
        secret_id = bao_api(source_address, 'auth/platform-backup/role/platform-raft-snapshot-reader/secret-id', {}, root_token)['data']['secret_id']
        synthetic_secrets.extend([role_id, secret_id])
        negative_token = bao_api(source_address, 'auth/platform-backup/login', {'role_id': role_id, 'secret_id': secret_id})['auth']['client_token']
        synthetic_secrets.append(negative_token)
        denied_paths = []
        try:
            for path, body in [('sys/storage/raft/snapshot', {}), ('sys/storage/raft/snapshot-force', {}),
                               ('auth/token/create', {}), ('auth/token/renew-self', {}),
                               ('synthetic/data/fixture', None)]:
                try:
                    bao_api(source_address, path, body, negative_token)
                    raise RuntimeError('snapshot_identity_negative_access_allowed')
                except urllib.error.HTTPError as error:
                    if error.code != 403:
                        raise RuntimeError('snapshot_identity_negative_unexpected_status')
                    denied_paths.append(path)
        finally:
            bao_api(source_address, 'auth/token/revoke-self', {}, negative_token)
        try:
            bao_api(source_address, 'auth/token/lookup-self', token=negative_token)
            raise RuntimeError('snapshot_negative_token_still_live')
        except urllib.error.HTTPError as error:
            if error.code != 403:
                raise RuntimeError('snapshot_negative_token_cleanup_uncertain')
        record('native_snapshot_identity_restore_material_child_and_renewal_denied', len(denied_paths) == 5, deniedPaths=denied_paths, tokenRevoked403=True)
        for directory in ['snapshot-credentials', 'native-output', 'native-state']:
            (work / directory).mkdir(mode=0o700)
        (work / 'snapshot-credentials/approle.json').write_text(json.dumps({'roleId': role_id, 'secretId': secret_id}))
        shutil.copyfile(work / 'source-tls.crt', work / 'snapshot-credentials/ca.crt')
        capture_container = prefix + '-native-snapshot'
        containers.append(capture_container)
        result = run(['docker', 'run', '--name', capture_container, '--label', 'myims.backup-eval=' + operation,
                      '--network', network, '--user', str(os.getuid()) + ':' + str(os.getgid()), '--read-only',
                      '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--tmpfs', '/tmp',
                      '-v', str(work / 'snapshot-credentials') + ':/credentials:ro',
                      '-v', str(work / 'native-output') + ':/output', '-v', str(work / 'native-state') + ':/state',
                      '--entrypoint', 'node', TOOLS, '/opt/scripts/backup/snapshot.mjs', '/credentials', '/output', '/state'])
        captured = json.loads(result.stdout)
        receipt = json.loads((work / 'native-output' / (captured['operationId'] + '.json')).read_text())
        snapshot_bytes = (work / 'native-output' / (captured['operationId'] + '.snap')).read_bytes()
        record('native_snapshot_only_approle_tls_capture_revoke_403', captured['status'] == 'passed' and receipt['tokenCleanupConfirmed'], snapshotBytes=len(snapshot_bytes))
    else:
        snapshot_bytes = bao_api(source_address, 'sys/storage/raft/snapshot', token=root_token, binary=True)
    audit = run(['docker', 'exec', source_bao, 'cat', source_audit_path]).stdout
    assert audit.endswith(b'\n') and all(json.loads(line) for line in audit.splitlines())
    record('native_raft_snapshot_and_separate_audit', bool(snapshot_bytes) and bool(audit), snapshotBytes=len(snapshot_bytes), auditRecords=len(audit.splitlines()))
    files = {'snapshot.snap': snapshot_bytes, 'audit.jsonl': audit}
    inner_manifest = {name: {'sha256': hashlib.sha256(value).hexdigest(), 'bytes': len(value)} for name, value in files.items()}
    files['manifest.json'] = json.dumps(inner_manifest, sort_keys=True).encode()
    archive = io.BytesIO()
    with tarfile.open(fileobj=archive, mode='w:gz') as tar:
        for name, value in files.items():
            entry = tarfile.TarInfo(name)
            entry.size, entry.mode = len(value), 0o600
            tar.addfile(entry, io.BytesIO(value))
    plain = archive.getvalue()
    run([options.age_keygen, '-o', str(work / 'identity')])
    recipient = run([options.age_keygen, '-y', str(work / 'identity')]).stdout.decode().strip()
    source = run([options.age, '-r', recipient], plain).stdout
    record('age_encryption_before_backup', source.startswith(b'age-encryption.org/v1') and plain not in source)
    (work / 'input/archive.fixture.age').write_bytes(source)
    manifest = {'archive.fixture.age': {'sha256': hashlib.sha256(source).hexdigest(), 'bytes': len(source)}}
    (work / 'input/manifest.json').write_text(json.dumps(manifest))
    if options.development_artifacts:
        stage = 'development_archive_helper'
        for name in ['snapshot-input', 'encrypted-spool', 'public', 'server-auth', 'server-tls', 'client', 'receipts', 'audit-state', 'audit-source']:
            (work / name).mkdir(mode=0o700)
        (work / 'snapshot-input/snapshot.snap').write_bytes(snapshot_bytes)
        (work / 'snapshot-input/audit.jsonl').write_bytes(audit)
        (work / 'snapshot-input/recovery.json').write_text(json.dumps({'configurationRevision': 'disposable-v1', 'postgresRecoveryReference': 'synthetic-only-not-a-postgres-restore'}))
        (work / 'public/recipient.txt').write_text(recipient)
        (work / 'compose.env').write_text('\n'.join([
            'MYIMS_BACKUP_TOOLS_IMAGE=' + TOOLS, 'MYIMS_BACKUP_UID=' + str(os.getuid()), 'MYIMS_BACKUP_GID=' + str(os.getgid()),
            'MYIMS_BACKUP_ROOT=' + str(work), 'MYIMS_BACKUP_AUDIT_SOURCE=' + str(work / 'audit-source'),
            'MYIMS_BACKUP_VOLUME=' + volume, 'MYIMS_BACKUP_NETWORK=' + network,
            'MYIMS_BACKUP_REPOSITORY_BYTES=16777216']) + '\n')
        (work / 'tools-override.json').write_text(json.dumps({'services': {n: {'image': TOOLS} for n in ['archive', 'audit-collector', 'uploader']}}))
        compose('config', '--quiet')
        config = json.loads(compose('--profile', 'retained-install', '--profile', 'manual-archive', '--profile', 'manual-audit', '--profile', 'manual-upload', 'config', '--format=json').stdout)
        record('reviewed_compose_profiles_and_no_ports', all('profiles' in v and not v.get('ports') and v['restart'] == 'no' for v in config['services'].values()))
        result = json.loads(compose_helper('archive').stdout)
        record('actual_archive_helper_passed', result['status'] == 'passed')
        archive_name = result['operationId'] + '.age'
        manifest_name = result['operationId'] + '.json'
        source = (work / 'encrypted-spool' / archive_name).read_bytes()
        plain = run([options.age, '-d', '-i', str(work / 'identity')], source).stdout
        # The original probe operates on the same read-only encrypted input path.
        shutil.rmtree(work / 'input')
        (work / 'input').symlink_to(work / 'encrypted-spool', target_is_directory=True)
    stage = 'storage_setup'
    run(['docker', 'volume', 'create', '--label', 'myims.backup-eval=' + operation, volume])
    # Use bundled htpasswd inside an exact helper container; no host dependency.
    helper = prefix + '-auth'
    containers.append(helper)
    run(['docker', 'run', '--name', helper, '--label', 'myims.backup-eval=' + operation, '--network', 'none',
         '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--read-only', '--tmpfs', '/tmp', '-v', volume + ':/data',
         '--entrypoint', 'htpasswd', SERVER, '-Bbc', '/data/.htpasswd', 'uploader', password])
    if options.development_artifacts:
        stage = 'development_tls_server'
        # Native TLS certificate with DNS SAN; Restic clients enforce both CA and name.
        run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', str(work / 'server-tls/server.key'),
             '-out', str(work / 'server-tls/server.crt'), '-days', '1', '-subj', '/CN=rest-server', '-addext', 'subjectAltName=DNS:rest-server'])
        shutil.copyfile(work / 'server-tls/server.crt', work / 'client/ca.crt')
        auth = prefix + '-file-auth'
        containers.append(auth)
        run(['docker', 'run', '--rm', '--name', auth, '--network', 'none', '--read-only', '--cap-drop', 'ALL',
             '--user', str(os.getuid()) + ':' + str(os.getgid()), '--tmpfs', '/tmp', '-v', str(work / 'server-auth') + ':/auth',
             '--entrypoint', 'htpasswd', SERVER, '-Bbc', '/auth/htpasswd', 'uploader', password])
        owner = prefix + '-volume-owner'
        containers.append(owner)
        run(['docker', 'run', '--rm', '--name', owner, '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--cap-add', 'CHOWN',
             '-v', volume + ':/data', '--entrypoint', 'chown', SERVER, str(os.getuid()) + ':' + str(os.getgid()), '/data'])
        (work / 'client/repository.url').write_text('rest:https://uploader:' + password + '@rest-server:8000/uploader/')
        (work / 'client/repository.password').write_text(repo_password)
        compose('--profile', 'retained-install', 'up', '-d', '--no-build', 'rest-server')
        server = prefix + '-rest-server-1'
        containers.append(server)
        info = json.loads(run(['docker', 'inspect', server]).stdout)[0]
        endpoint = 'https://' + info['NetworkSettings']['Networks'][network]['IPAddress'] + ':8000'
        # Raw host-side protocol probes validate this CA; only these probes suppress
        # IP hostname matching. All real Restic/helper clients validate DNS SAN.
        probe_tls = ssl.create_default_context(cafile=str(work / 'client/ca.crt'))
        probe_tls.check_hostname = False
    else:
        containers.append(server)
        run(['docker', 'run', '-d', '--name', server, '--label', 'myims.backup-eval=' + operation, '--network', network,
             '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--read-only', '--tmpfs', '/tmp',
             '-v', volume + ':/data', '--entrypoint', '/usr/bin/rest-server', SERVER,
             '--path=/data', '--append-only', '--private-repos', '--htpasswd-file=/data/.htpasswd', '--listen=:8000'])
        info = json.loads(run(['docker', 'inspect', server]).stdout)[0]
        assert not info['HostConfig']['PortBindings']
        endpoint = 'http://' + info['NetworkSettings']['Networks'][network]['IPAddress'] + ':8000'
    for _ in range(100):
        try:
            if http('GET', '/uploader/config')[0] == 404:
                break
        except OSError:
            pass
        time.sleep(.1)
    evidence['serverVersion'] = run(['docker', 'exec', server, '/usr/bin/rest-server', '--version']).stdout.decode().strip()
    evidence['clientVersion'] = restic('version').stdout.decode().strip()
    for role, image in [('server', SERVER), ('client', CLIENT)]:
        details = json.loads(run(['docker', 'image', 'inspect', image]).stdout)[0]
        evidence[role + 'ImageMetadata'] = {'id': details['Id'], 'architecture': details['Architecture'], 'repoDigests': details['RepoDigests']}
    record('anonymous_denied', http('GET', '/uploader/config', auth=False)[0] == 401)
    record('other_repository_denied', http('GET', '/other/config')[0] == 401)
    if options.development_artifacts:
        stage = 'host_installer_readonly_storage_probe'
        probe_name = prefix + '-helper-storage-probe'
        containers.append(probe_name)
        probe = json.loads(run(['docker', 'run', '--rm', '-i', '--name', probe_name,
                                '--label', 'myims.backup-eval=' + operation,
                                '--network', network, '--user', str(os.getuid()) + ':' + str(os.getgid()),
                                '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
                                '-v', str(work / 'client') + ':/run/client:ro', '--entrypoint', 'node', TOOLS, '-'],
                               (ROOT / 'scripts/backup-host/storage-probe.mjs').read_bytes()).stdout)
        record('host_installer_readonly_tls_auth_probe', probe['status'] == 'passed' and probe['repositoryWrites'] == 0 and not probe['repositoryInitialized'])
    stage = 'backup'
    if options.initialize_helper:
        init_name = prefix + '-helper-initialize'
        containers.append(init_name)
        init_command = ['docker', 'run', '--rm', '--name', init_name, '--network', network,
                        '--user', str(os.getuid()) + ':' + str(os.getgid()), '--read-only', '--cap-drop', 'ALL',
                        '--security-opt', 'no-new-privileges:true', '--tmpfs', '/tmp:mode=1777',
                        '-v', str(work / 'client') + ':/run/client:ro', '-v', str(work / 'receipts') + ':/receipts',
                        '-v', str(ROOT / 'scripts/backup/repository-initialize.mjs') + ':/opt/scripts/backup/repository-initialize.mjs:ro',
                        '--entrypoint', 'node', TOOLS, '/opt/scripts/backup/repository-initialize.mjs', operation]
        initialized = json.loads(run(init_command).stdout)
        record('operation_bound_native_initialization_verifies_config_and_empty_repository', initialized['status'] == 'repository_initialized' and initialized['verifiedEmpty'])
        original_config = http('GET', '/uploader/config')[1]
        repeated = run(init_command, check=False)
        record('repeated_initialization_refused_with_repository_configuration_unchanged', repeated.returncode != 0 and http('GET', '/uploader/config')[1] == original_config)
        evidence['initializerSha256'] = hashlib.sha256((ROOT / 'scripts/backup/repository-initialize.mjs').read_bytes()).hexdigest()
    else:
        restic('init')
    if options.development_artifacts:
        compose_helper('uploader')
        receipt = next(value for value in (json.loads(path.read_text()) for path in (work / 'receipts').glob('*.json')) if value.get('command') == 'upload')
        backup = type('Result', (), {'stdout': json.dumps({'message_type': 'summary', 'snapshot_id': receipt['snapshotId']}).encode()})()
        wrong = work / 'client/ca.crt'
        original_ca = wrong.read_bytes()
        wrong.write_text('not a trusted CA')
        failed = compose_helper('uploader', check=False)
        record('uploader_rejects_untrusted_tls_sanitized', failed.returncode != 0 and password.encode() not in failed.stdout + failed.stderr)
        wrong.write_bytes(original_ca)
    else:
        backup = restic('backup', '--json', '--host=synthetic-fixture', '/input')
    summary = [json.loads(line) for line in backup.stdout.splitlines() if json.loads(line).get('message_type') == 'summary'][-1]
    snapshot = summary['snapshot_id']
    record('native_backup', bool(snapshot), snapshotId=snapshot)
    record('native_integrity_check', restic('check', '--read-data').returncode == 0)
    stage = 'append_only_security'
    config_status, config = http('GET', '/uploader/config')
    record('writer_read_access_explicit', config_status == 200, securityBoundary='authenticated repository clients can read')
    for name, method, path, payload in [
        ('config_overwrite_denied', 'POST', '/uploader/config', config),
        ('config_delete_denied', 'DELETE', '/uploader/config', None),
        ('snapshot_delete_denied', 'DELETE', '/uploader/snapshots/' + snapshot, None),
        ('repository_delete_denied', 'DELETE', '/uploader/', None),
    ]:
        status, _ = http(method, path, payload)
        record(name, status in ((403, 405) if name == 'repository_delete_denied' else (403,)), http=status)
    snap_status, snap_bytes = http('GET', '/uploader/snapshots/' + snapshot)
    assert snap_status == 200
    status, _ = http('POST', '/uploader/snapshots/' + snapshot, snap_bytes)
    record('snapshot_overwrite_denied', status == 403, http=status)
    listing_status, listing = http('GET', '/uploader/data/')
    assert listing_status == 200
    first_pack = json.loads(listing)[0]
    pack_name = first_pack if isinstance(first_pack, str) else first_pack['name']
    pack_status, pack_bytes = http('GET', '/uploader/data/' + pack_name)
    assert pack_status == 200
    record('repository_pack_contains_no_plaintext', plain not in pack_bytes)
    # A different, small payload proves an overwrite attempt without racing a
    # large TLS upload against the server's early rejection/connection close.
    for method, payload in [('POST', b'synthetic-overwrite-attempt'), ('DELETE', None)]:
        status, _ = http(method, '/uploader/data/' + pack_name, payload)
        record('data_pack_' + ('overwrite' if method == 'POST' else 'delete') + '_denied', status == 403 and http('GET', '/uploader/data/' + pack_name)[1] == pack_bytes, http=status, originalBytesUnchanged=True)
    forgot = restic('forget', snapshot, check=False)
    # Verify immutable content survives even if a future client changes exit codes.
    record('client_forget_denied', forgot.returncode != 0 and http('GET', '/uploader/snapshots/' + snapshot)[1] == snap_bytes, exitCode=forgot.returncode)
    stage = 'restart'
    run(['docker', 'restart', server])
    for _ in range(100):
        try:
            if http('GET', '/uploader/config')[0] == 200:
                break
        except OSError:
            pass
        time.sleep(.1)
    status, _ = http('POST', '/uploader/config', config)
    record('config_overwrite_denied_after_restart', status == 403, http=status)
    status, _ = http('DELETE', '/uploader/snapshots/' + snapshot)
    record('snapshot_delete_denied_after_restart', status == 403, http=status)
    if options.development_artifacts:
        (work / 'audit-source/active.jsonl').write_bytes(audit)
        (work / 'audit-source/segments.json').write_text(json.dumps(['active.jsonl']))
        compose_helper('audit-collector')
        compose_helper('uploader')
        compose_helper('uploader', 'check-data', '/input', '/run/client', '/receipts')
        record('actual_repository_check_data_helper', True)
        record('actual_separate_audit_helper_and_uploader', (work / 'audit-state/cursor.json').exists())
        raw = work / 'encrypted-spool/raw.snapshot'
        raw.write_text('synthetic raw input must never upload')
        rejected = compose_helper('uploader', check=False)
        record('uploader_rejects_plaintext_spool', rejected.returncode != 0)
        raw.unlink()
    else:
        (work / 'input/second.fixture').write_text('synthetic-second-' + operation)
        restic('backup', '--json', '--host=synthetic-fixture', '/input')
    snapshots = json.loads(restic('snapshots', '--json').stdout)
    record('append_new_snapshot_after_restart', len(snapshots) == 2)
    record('integrity_after_restart_and_append', restic('check', '--read-data').returncode == 0)
    stage = 'restore'
    restored = restic('dump', snapshot, '/input/' + archive_name).stdout
    restored_manifest = json.loads(restic('dump', snapshot, '/input/' + manifest_name).stdout)
    record('isolated_restore_and_manifest', restored == source and hashlib.sha256(restored).hexdigest() == (restored_manifest['sha256'] if options.development_artifacts else restored_manifest['archive.fixture.age']['sha256']))
    record('age_decrypt_restored_ciphertext', run([options.age, '-d', '-i', str(work / 'identity')], restored).stdout == plain)
    decrypted = run([options.age, '-d', '-i', str(work / 'identity')], restored).stdout
    with tarfile.open(fileobj=io.BytesIO(decrypted), mode='r:gz') as tar:
        assert set(tar.getnames()) == ({'snapshot.snap', 'audit.jsonl', 'recovery.json', 'manifest.json'} if options.development_artifacts else {'snapshot.snap', 'audit.jsonl', 'manifest.json'})
        restored_inner = json.load(tar.extractfile('manifest.json'))
        if options.development_artifacts:
            restored_inner = restored_inner['files']
        restored_files = {name: tar.extractfile(name).read() for name in restored_inner}
        for name, value in restored_files.items():
            assert len(value) == restored_inner[name]['bytes']
            assert hashlib.sha256(value).hexdigest() == restored_inner[name]['sha256']
    record('restored_snapshot_and_audit_integrity', all(restored_files[n] == b for n, b in {'snapshot.snap': snapshot_bytes, 'audit.jsonl': audit}.items()))
    stage = 'isolated_native_restore'
    restore_network = prefix + '-restore-net'
    run(['docker','network','create','--internal','--label','myims.backup-eval='+operation,restore_network])
    extra_networks.append(restore_network)
    restore_bao, restore_address, _, restore_token = start_bao('restore-bao', restore_network)
    isolation_probe = prefix + '-helper-restore-isolation'
    containers.append(isolation_probe)
    source_ip = source_address.split('://',1)[1].split(':',1)[0]
    probe = run(['docker','run','--rm','--name',isolation_probe,'--label','myims.backup-eval='+operation,
                 '--network',restore_network,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true',
                 '--user',str(os.getuid())+':'+str(os.getgid()),'--entrypoint','node',TOOLS,'-e',
                 "const s=require('node:net').connect({host:process.argv[1],port:8200});s.setTimeout(1500);s.once('connect',()=>{s.destroy();process.exit(1)});s.once('error',()=>process.exit(0));s.once('timeout',()=>{s.destroy();process.exit(0)});",source_ip])
    restore_info = json.loads(run(['docker','inspect',restore_bao]).stdout)[0]
    record('restore_has_separate_network_and_cannot_reach_source', probe.returncode==0 and list(restore_info['NetworkSettings']['Networks'])==[restore_network])
    run(['docker', 'exec', '-i', restore_bao, 'sh', '-c', 'cat > /tmp/restore.snap'], restored_files['snapshot.snap'])
    run(['docker', 'exec', '-e', 'BAO_ADDR=http://127.0.0.1:8200', '-e', 'BAO_TOKEN=' + restore_token,
         restore_bao, 'bao', 'operator', 'raft', 'snapshot', 'restore', '-force', '/tmp/restore.snap'])
    if options.recovery_authority_candidate:
        # Exercise the recovered node's durable storage/configuration at restart,
        # using its original snapshot's Raft node identity and original seal key.
        run(['docker','restart',restore_bao])
        restored_info = json.loads(run(['docker','inspect',restore_bao]).stdout)[0]
        restore_address = 'http://' + restored_info['NetworkSettings']['Networks'][restore_network]['IPAddress'] + ':8200'
    restored_read_token = None
    restore_wait_deadline = time.monotonic() + 90
    for _ in range(600 if options.recovery_authority_candidate else 150):
        if time.monotonic() >= restore_wait_deadline:
            # Diagnostics are restricted to this operation's fresh synthetic node.
            diagnostic = run(['docker','logs','--tail','100',restore_bao],check=False)
            log_text = (diagnostic.stdout + diagnostic.stderr).decode(errors='replace')[-16000:]
            for secret in synthetic_secrets: log_text = log_text.replace(secret,'[redacted]')
            evidence['isolatedRestoreFixtureLog'] = log_text
            try: evidence['isolatedRestoreLeader'] = bao_api(restore_address,'sys/leader')
            except Exception: evidence['isolatedRestoreLeader'] = {'unavailable':True}
            raise RuntimeError('isolated_restore_leader_unavailable')
        try:
            if bao_api(restore_address, 'sys/seal-status')['sealed']:
                bao_api(restore_address, 'sys/unseal', {'key': seal})
            if options.recovery_authority_candidate:
                # A restore exercise uses fresh authentication; it must not rely
                # on reviving a transported privileged bearer session.
                if bao_api(restore_address,'sys/health')['sealed']: continue
                if restored_read_token is None:
                    restored_read_token = bao_api(restore_address,'auth/platform-custodian/login/synthetic-restore-reader',{'password':restore_reader_password})['auth']['client_token']
                    synthetic_secrets.append(restored_read_token)
                restore_probe_token = restored_read_token
            else: restore_probe_token = root_token
            if bao_api(restore_address, 'synthetic/data/fixture', token=restore_probe_token)['data']['data']['value'] == sentinel:
                break
        except urllib.error.HTTPError as error:
            evidence['nativeRestoreLastHttpStatus']=error.code
            evidence['nativeRestoreLastApi']=evidence['lastFixtureApi']
        except Exception:
            pass
        time.sleep(.2)
    else:
        raise RuntimeError('synthetic_native_restore_value_unavailable')
    if restored_read_token is not None:
        bao_api(restore_address,'auth/token/revoke-self',{},restored_read_token)
        try:
            bao_api(restore_address,'auth/token/lookup-self',token=restored_read_token)
            raise RuntimeError('restore_reader_cleanup_unconfirmed')
        except urllib.error.HTTPError as error:
            if error.code!=403: raise RuntimeError('restore_reader_cleanup_unexpected')
        record('isolated_restore_uses_fresh_scoped_authentication_and_cleanup',True)
    if options.recovery_authority_candidate:
        restored_config = (work / 'restore-bao.hcl').read_text()
        assert 'file_path="/bao/audit/endpoint.json"' in restored_config
        run(['docker','exec',restore_bao,'test','-s','/bao/audit/endpoint.json'])
        record('isolated_restore_preserves_declarative_audit_path_on_independent_volume',True)
    record('native_raft_restore_and_synthetic_value', True, separateContainer=True, separateAuditPreserved=True)
    if options.backup_first_provisioning:
        stage = 'backup_first_authority_rehearsal'
        # This flag changes only a fresh synthetic fixture. It is not an executor.
        # Do not provision anything until the baseline has been retrieved,
        # decrypted and natively restored with its integrity and audit preserved.
        required = ['native_raft_snapshot_and_separate_audit', 'age_encryption_before_backup',
                    'native_backup', 'native_integrity_check', 'isolated_restore_and_manifest',
                    'age_decrypt_restored_ciphertext', 'restored_snapshot_and_audit_integrity',
                    'native_raft_restore_and_synthetic_value', 'actual_separate_audit_helper_and_uploader']
        checkpoint = {name: any(c['name'] == name and c['passed'] for c in evidence['checks']) for name in required}
        if not all(checkpoint.values()): raise RuntimeError('backup_first_gate_unverified')
        record('pre_provision_backup_retrieval_decryption_native_restore_gate', True,
               baselineSnapshotId=snapshot, snapshotSha256=hashlib.sha256(snapshot_bytes).hexdigest(),
               auditSha256=hashlib.sha256(audit).hexdigest())
        proposal = json.loads((ROOT / 'docs/planning/p3-u3a-backup-installation-review-manifest.json').read_text())
        writes = proposal['backupProvisioning']
        expected_paths = ['sys/policies/acl/platform-raft-snapshot-reader', 'sys/auth/platform-backup',
                          'auth/platform-backup/role/platform-raft-snapshot-reader',
                          'auth/platform-backup/role/platform-raft-snapshot-reader/secret-id']
        assert [w['path'] for w in writes] == expected_paths and all(w['method'] == 'POST' for w in writes)
        assert hashlib.sha256(writes[0]['body']['policy'].encode()).hexdigest() == writes[0]['policyUtf8Sha256']
        if 'platform-backup/' in bao_api(source_address, 'sys/auth', token=root_token).get('data', {}):
            raise RuntimeError('unexpected_existing_backup_mount')
        for path in [expected_paths[0], expected_paths[2]]:
            try:
                bao_api(source_address, path, token=root_token)
                raise RuntimeError('unexpected_existing_provisioning_target')
            except urllib.error.HTTPError as error:
                if error.code != 404: raise RuntimeError('provisioning_prestate_unverified')
        observations = []
        for write in writes:
            if recovery_deadline is not None and time.monotonic() >= recovery_deadline:
                raise RuntimeError('fixture_recovery_deadline_before_write')
            if recovery_guard is not None:
                run(['node',str(ROOT/'scripts/openbao/recovery-deadline.mjs'),'assert-ready',operation,recovery_guard['directory']])
            result = bao_api(source_address, write['path'], write['body'], root_token)
            observations.append(write['path'])
            if write['path'] == expected_paths[-1]:
                secret_id = result['data']['secret_id']
                synthetic_secrets.append(secret_id)
        policy = bao_api(source_address, expected_paths[0], token=root_token)['data']['policy']
        role = bao_api(source_address, expected_paths[2], token=root_token)['data']
        tune = bao_api(source_address, 'sys/auth/platform-backup/tune', token=root_token)['data']
        record('exact_four_backup_provisioning_writes_after_backup', observations == expected_paths and policy == writes[0]['body']['policy'])
        record('native_backup_role_and_mount_readback', role['token_policies'] == ['platform-raft-snapshot-reader'] and role['token_no_default_policy'] is True and role['token_explicit_max_ttl'] == 300 and role['token_max_ttl'] == 300 and role['token_ttl'] == 300 and role['token_period'] == 0 and role['secret_id_ttl'] == 2592000 and role['secret_id_num_uses'] == 1000 and tune['default_lease_ttl'] == 300 and tune['max_lease_ttl'] == 300)
        role_id = bao_api(source_address, expected_paths[2] + '/role-id', token=root_token)['data']['role_id']
        synthetic_secrets.append(role_id)
        if options.recovery_authority_candidate:
            policy_after = bao_api(source_address, 'sys/policies/acl/platform-deployment-maintainer', token=root_token)['data']['policy']
            human_after = bao_api(source_address, human_path, token=root_token)['data']
            record('fixture_existing_custodian_policy_and_configuration_unchanged', policy_after == custodian_policy and human_after == human_before)
        if options.recovery_authority_candidate:
            bao_api(source_address, 'sys/generate-root/attempt', token=root_token, method='DELETE')
        bao_api(source_address, 'auth/token/revoke-self', {}, root_token)
        try:
            bao_api(source_address, 'auth/token/lookup-self', token=root_token)
            raise RuntimeError('installer_token_still_live')
        except urllib.error.HTTPError as error:
            if error.code != 403: raise RuntimeError('installer_cleanup_uncertain')
        record('temporary_fixture_installer_revoked_403_before_independent_snapshot', True)
        if options.recovery_authority_candidate:
            (work / 'source-bao.hcl').write_text(recovery_normal_config)
            run(['docker','restart',source_bao])
            source_info = json.loads(run(['docker','inspect',source_bao]).stdout)[0]
            source_address = 'https://' + source_info['NetworkSettings']['Networks'][network]['IPAddress'] + ':8200'
            for _ in range(150):
                try:
                    if bao_api(source_address,'sys/seal-status')['sealed']:
                        bao_api(source_address,'sys/unseal',{'key':seal})
                    if not bao_api(source_address,'sys/health')['sealed']: break
                except Exception: pass
                time.sleep(.2)
            else: raise RuntimeError('normal_fixture_restoration_unavailable')
            try:
                bao_api(source_address,'sys/generate-root/attempt')
                raise RuntimeError('normal_fixture_generation_not_restored')
            except urllib.error.HTTPError as error:
                if error.code!=405: raise RuntimeError('normal_fixture_restoration_status_unexpected')
            record('normal_fixture_listener_tls_and_raft_restored', (work / 'source-bao.hcl').read_text()==recovery_normal_config and not source_info['HostConfig']['PortBindings'])
            record('fixture_recovery_window_bounded', time.monotonic()<recovery_deadline, elapsedSeconds=round(time.monotonic()-recovery_started,3),maximumSeconds=840)
            run(['node',str(ROOT/'scripts/openbao/recovery-deadline.mjs'),'cancel',operation,recovery_guard['directory']])
            record('fixture_deadline_cancelled_only_after_root_revoke_and_protected_restoration',True)
            recovery_deadline = None
            human_token = bao_api(source_address,'auth/platform-custodian/login/platform-owner-custodian',{'password':custodian_password})['auth']['client_token']
            synthetic_secrets.append(human_token)
            try:
                for path in ['sys/storage/raft/snapshot','sys/policies/acl/platform-deployment-maintainer']:
                    try:
                        bao_api(source_address,path,token=human_token)
                        raise RuntimeError('fixture_custodian_denial_lost')
                    except urllib.error.HTTPError as error:
                        if error.code!=403: raise RuntimeError('fixture_custodian_denial_unexpected')
            finally: bao_api(source_address,'auth/token/revoke-self',{},human_token)
            try:
                bao_api(source_address,'auth/token/lookup-self',token=human_token)
                raise RuntimeError('fixture_human_cleanup_unconfirmed')
            except urllib.error.HTTPError as error:
                if error.code!=403: raise RuntimeError('fixture_human_cleanup_unexpected')
            record('fixture_existing_custodian_login_denials_and_cleanup_after_restoration',True)
        for directory in ['snapshot-credentials', 'native-output', 'native-state']:
            (work / directory).mkdir(mode=0o700)
        (work / 'snapshot-credentials/approle.json').write_text(json.dumps({'roleId': role_id, 'secretId': secret_id}))
        shutil.copyfile(work / 'source-tls.crt', work / 'snapshot-credentials/ca.crt')
        capture_container = prefix + '-native-snapshot'
        containers.append(capture_container)
        response = run(['docker', 'run', '--name', capture_container, '--label', 'myims.backup-eval=' + operation,
                        '--network', network, '--user', str(os.getuid()) + ':' + str(os.getgid()), '--read-only',
                        '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--tmpfs', '/tmp',
                        '-v', str(work / 'snapshot-credentials') + ':/credentials:ro',
                        '-v', str(work / 'native-output') + ':/output', '-v', str(work / 'native-state') + ':/state',
                        '--entrypoint', 'node', TOOLS, '/opt/scripts/backup/snapshot.mjs', '/credentials', '/output', '/state'])
        captured = json.loads(response.stdout)
        receipt = json.loads((work / 'native-output' / (captured['operationId'] + '.json')).read_text())
        record('independent_post_provision_native_capture_after_installer_revocation', captured['status'] == 'passed' and receipt['tokenCleanupConfirmed'])
        # Preserve a fresh encrypted post-provision set and an independent audit
        # increment after both installer and capture-session revocations.
        (work / 'snapshot-input/snapshot.snap').write_bytes((work / 'native-output' / (captured['operationId'] + '.snap')).read_bytes())
        post_audit = run(['docker', 'exec', source_bao, 'cat', source_audit_path]).stdout
        assert post_audit.startswith(audit)
        (work / 'snapshot-input/audit.jsonl').write_bytes(post_audit)
        (work / 'audit-source/active.jsonl').write_bytes(post_audit)
        compose_helper('archive')
        compose_helper('audit-collector')
        compose_helper('uploader')
        compose_helper('uploader', 'check-data', '/input', '/run/client', '/receipts')
        record('post_provision_encrypted_snapshot_and_separate_audit_commit', len(json.loads(restic('snapshots', '--json').stdout)) == 3)
        evidence['provisioningRehearsalScope'] = ('fresh fixture seal-quorum recovery, backup-first four-write provisioning and protected restoration; no retained keys/provider, joint PostgreSQL restore or scheduler' if options.recovery_authority_candidate else 'fresh native fixture installer only; root generation/recovery, retained custody, joint PostgreSQL restore and scheduler not exercised')
    # Explicitly verify lock deletion exception, necessary for normal restic jobs.
    lock_name = hashlib.sha256(b'synthetic-lock').hexdigest()
    create, _ = http('POST', '/uploader/locks/' + lock_name, b'synthetic-lock')
    delete, _ = http('DELETE', '/uploader/locks/' + lock_name)
    record('lock_delete_exception_observed', create == 200 and delete == 200, createHttp=create, deleteHttp=delete)
    net = json.loads(run(['docker', 'network', 'inspect', network]).stdout)[0]
    for name in containers:
        inspected = run(['docker', 'inspect', name], check=False)
        if inspected.returncode and any(name.startswith(prefix + kind) for kind in ['-age-', '-helper-', '-file-auth', '-volume-owner', '-recovery-volume-owner']):
            continue  # Exact --rm helpers: command mounts are fixture-only, absence checked again below.
        if inspected.returncode:
            raise RuntimeError('unexpected_fixture_disappeared')
        fixture = json.loads(inspected.stdout)[0]
        assert fixture['Config']['Labels'].get('myims.backup-eval') == operation or (options.development_artifacts and name == server and fixture['Config']['Labels'].get('com.docker.compose.project') == prefix)
        assert all(m['Type'] != 'bind' or m['Source'].startswith(str(work) + '/') for m in fixture['Mounts'])
    record('isolated_network_and_storage', net['Internal'] and all(m['Type'] != 'bind' or m['Source'].startswith(str(work) + '/') for m in info['Mounts']), hostPublishedPorts=0, retainedMounts=0)
    evidence['toolsImageId'] = json.loads(run(['docker', 'image', 'inspect', TOOLS]).stdout)[0]['Id'] if options.development_artifacts else None
    evidence['status'] = 'passed' if all(c['passed'] for c in evidence['checks']) else 'failed'
except BaseException as error:
    evidence['status'] = 'failed'
    evidence['failure'] = {'stage': stage, 'type': type(error).__name__, 'code': str(error) if isinstance(error, RuntimeError) else 'details_suppressed', 'transportCause': type(error.reason).__name__ if isinstance(error, urllib.error.URLError) else None, 'httpStatus': error.code if isinstance(error, urllib.error.HTTPError) else None}
    if options.recovery_authority_candidate and isinstance(error, urllib.error.HTTPError):
        diagnostic = error.read(4096).decode(errors='replace')
        for secret in synthetic_secrets: diagnostic = diagnostic.replace(secret, '[redacted]')
        evidence['fixtureOnlyDiagnostic'] = diagnostic
finally:
    if options.development_artifacts and (work / 'compose.env').exists():
        compose('--profile', 'retained-install', 'down', '--remove-orphans', check=False)
    for name in containers:
        run(['docker', 'rm', '-f', name], check=False)
    recovery_deadline = None
    run(['docker', 'volume', 'rm', volume], check=False)
    for candidate in extra_volumes: run(['docker','volume','rm',candidate],check=False)
    run(['docker', 'network', 'rm', network], check=False)
    for candidate in extra_networks: run(['docker','network','rm',candidate],check=False)
    guard_stopped = True
    guard_directory_removed = True
    if recovery_guard is not None:
        directory = pathlib.Path(recovery_guard['directory'])
        if not (directory/'cancelled').exists():
            # Fixture resources are now destroyed; no privileged fixture remains.
            run(['node',str(ROOT/'scripts/openbao/recovery-deadline.mjs'),'cancel',operation,str(directory)],check=False)
        guard_stopped = False
        for _ in range(50):
            try:
                state = pathlib.Path('/proc',str(recovery_guard['watcherPid']),'stat').read_text().rsplit(')',1)[1].split()[0]
                if state in ['Z','X']: guard_stopped=True; break
            except FileNotFoundError: guard_stopped=True; break
            time.sleep(.05)
        if guard_stopped: shutil.rmtree(directory)
        guard_directory_removed = not directory.exists()
    shutil.rmtree(work)
    evidence['cleanup'] = {
        'recoveryGuardStopped': guard_stopped,
        'recoveryGuardDirectoryRemoved': guard_directory_removed,
        'containersAbsent': all(run(['docker', 'inspect', name], check=False).returncode != 0 for name in containers),
        'extraRecoveryVolumesAbsent': all(run(['docker','volume','inspect',candidate],check=False).returncode!=0 for candidate in extra_volumes),
        'volumeAbsent': run(['docker', 'volume', 'inspect', volume], check=False).returncode != 0,
        'extraRestoreNetworksAbsent': all(run(['docker','network','inspect',candidate],check=False).returncode!=0 for candidate in extra_networks),
        'networkAbsent': run(['docker', 'network', 'inspect', network], check=False).returncode != 0,
        'privateWorkDirectoryAbsent': not work.exists(),
    }
    if not all(evidence['cleanup'].values()):
        evidence['status'] = 'failed'
    for dest in [ROOT / ('docs/status/p3-u3a-repository-initializer-evidence.json' if options.initialize_helper else 'docs/status/p3-u3a-recovery-authority-candidate-evidence.json' if options.recovery_authority_candidate else 'docs/status/p3-u3a-backup-first-provisioning-evidence.json' if options.backup_first_provisioning else 'docs/status/p3-u3a-snapshot-source-evidence.json' if options.snapshot_candidate else 'docs/status/p3-u3a-restic-development-evidence.json' if options.development_artifacts else 'docs/status/p3-u3a-restic-evaluation-evidence.json'), ROOT / 'docs/status/p3-u3a-disposable-runs' / (operation + '.json')]:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(evidence, indent=2) + '\n')
    print(json.dumps(evidence))
    if evidence['status'] != 'passed':
        raise SystemExit(1)
