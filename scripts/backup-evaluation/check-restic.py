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
parser.add_argument('--age', required=True)
parser.add_argument('--age-keygen', required=True)
options = parser.parse_args()
os.umask(0o077)
operation = str(uuid.uuid4())
prefix = 'myims-restic-eval-' + operation[:8]
work = pathlib.Path(tempfile.mkdtemp(prefix=prefix + '-'))
network, volume, server = prefix + '-net', prefix + '-data', prefix + '-server'
containers = []
password, repo_password = uuid.uuid4().hex, uuid.uuid4().hex
synthetic_secrets = [password, repo_password]
evidence = {'operationId': operation, 'startedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'serverImage': SERVER, 'clientImage': CLIENT, 'openbaoImage': BAO, 'retainedAccess': False, 'checks': []}
stage = 'setup'


def run(args, data=None, check=True):
    p = subprocess.run(args, input=data, capture_output=True, timeout=120)
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
    return run(command, check=check)


def http(method, path, data=None, auth=True):
    headers = {'Authorization': 'Basic ' + base64.b64encode(('uploader:' + password).encode()).decode()} if auth else {}
    req = urllib.request.Request(endpoint + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req, timeout=5) as res:
            return res.status, res.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def bao_api(address, path, body=None, token=None, binary=False):
    req = urllib.request.Request(address + '/v1/' + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Content-Type': 'application/json', **({'X-Vault-Token': token} if token else {})})
    with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req, timeout=15) as res:
        data = res.read()
        return data if binary else json.loads(data or '{}')


def start_bao(suffix):
    name = prefix + '-' + suffix
    containers.append(name)
    config = 'disable_mlock=true\napi_addr="http://127.0.0.1:8200"\ncluster_addr="http://127.0.0.1:8201"\nstorage "raft" { path="/bao/data" }\nlistener "tcp" { address="0.0.0.0:8200" tls_disable=true }\naudit "file" "eval" { options { file_path="/tmp/audit.jsonl" log_raw="false" } }\n'
    config_path = work / (suffix + '.hcl')
    config_path.write_text(config)
    config_path.chmod(0o644)
    run(['docker', 'run', '-d', '--name', name, '--label', 'myims.backup-eval=' + operation, '--network', network,
         '--user', '1003:1003', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
         '--tmpfs', '/bao/data:uid=1003,gid=1003,mode=0700', '--tmpfs', '/tmp:uid=1003,gid=1003',
         '-v', str(config_path) + ':/bao/config/eval.hcl:ro', BAO, 'server', '-config=/bao/config/eval.hcl'])
    info = json.loads(run(['docker', 'inspect', name]).stdout)[0]
    assert not info['HostConfig']['PortBindings']
    address = 'http://' + info['NetworkSettings']['Networks'][network]['IPAddress'] + ':8200'
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
    run(['docker', 'network', 'create', '--internal', '--label', 'myims.backup-eval=' + operation, network])
    stage = 'synthetic_native_snapshot'
    source_bao, source_address, seal, root_token = start_bao('source-bao')
    sentinel = 'synthetic-backup-archive-' + operation
    bao_api(source_address, 'sys/mounts/synthetic', {'type': 'kv', 'options': {'version': '2'}}, root_token)
    bao_api(source_address, 'synthetic/data/fixture', {'data': {'value': sentinel}}, root_token)
    snapshot_bytes = bao_api(source_address, 'sys/storage/raft/snapshot', token=root_token, binary=True)
    audit = run(['docker', 'exec', source_bao, 'cat', '/tmp/audit.jsonl']).stdout
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
    stage = 'storage_setup'
    run(['docker', 'volume', 'create', '--label', 'myims.backup-eval=' + operation, volume])
    # Use bundled htpasswd inside an exact helper container; no host dependency.
    helper = prefix + '-auth'
    containers.append(helper)
    run(['docker', 'run', '--name', helper, '--label', 'myims.backup-eval=' + operation, '--network', 'none',
         '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--read-only', '--tmpfs', '/tmp', '-v', volume + ':/data',
         '--entrypoint', 'htpasswd', SERVER, '-Bbc', '/data/.htpasswd', 'uploader', password])
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
    stage = 'backup'
    restic('init')
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
    for method, payload in [('POST', pack_bytes), ('DELETE', None)]:
        status, _ = http(method, '/uploader/data/' + pack_name, payload)
        record('data_pack_' + ('overwrite' if method == 'POST' else 'delete') + '_denied', status == 403, http=status)
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
    (work / 'input/second.fixture').write_text('synthetic-second-' + operation)
    second = restic('backup', '--json', '--host=synthetic-fixture', '/input')
    snapshots = json.loads(restic('snapshots', '--json').stdout)
    record('append_new_snapshot_after_restart', len(snapshots) == 2)
    record('integrity_after_restart_and_append', restic('check', '--read-data').returncode == 0)
    stage = 'restore'
    restored = restic('dump', snapshot, '/input/archive.fixture.age').stdout
    restored_manifest = json.loads(restic('dump', snapshot, '/input/manifest.json').stdout)
    record('isolated_restore_and_manifest', restored == source and hashlib.sha256(restored).hexdigest() == restored_manifest['archive.fixture.age']['sha256'])
    record('age_decrypt_restored_ciphertext', run([options.age, '-d', '-i', str(work / 'identity')], restored).stdout == plain)
    decrypted = run([options.age, '-d', '-i', str(work / 'identity')], restored).stdout
    with tarfile.open(fileobj=io.BytesIO(decrypted), mode='r:gz') as tar:
        assert set(tar.getnames()) == {'snapshot.snap', 'audit.jsonl', 'manifest.json'}
        restored_inner = json.load(tar.extractfile('manifest.json'))
        restored_files = {name: tar.extractfile(name).read() for name in restored_inner}
        for name, value in restored_files.items():
            assert len(value) == restored_inner[name]['bytes']
            assert hashlib.sha256(value).hexdigest() == restored_inner[name]['sha256']
    record('restored_snapshot_and_audit_integrity', restored_files == {'snapshot.snap': snapshot_bytes, 'audit.jsonl': audit})
    stage = 'isolated_native_restore'
    restore_bao, restore_address, _, restore_token = start_bao('restore-bao')
    run(['docker', 'exec', '-i', restore_bao, 'sh', '-c', 'cat > /tmp/restore.snap'], restored_files['snapshot.snap'])
    run(['docker', 'exec', '-e', 'BAO_ADDR=http://127.0.0.1:8200', '-e', 'BAO_TOKEN=' + restore_token,
         restore_bao, 'bao', 'operator', 'raft', 'snapshot', 'restore', '-force', '/tmp/restore.snap'])
    for _ in range(150):
        try:
            if bao_api(restore_address, 'sys/seal-status')['sealed']:
                bao_api(restore_address, 'sys/unseal', {'key': seal})
            if bao_api(restore_address, 'synthetic/data/fixture', token=root_token)['data']['data']['value'] == sentinel:
                break
        except Exception:
            pass
        time.sleep(.2)
    else:
        raise RuntimeError('synthetic_native_restore_value_unavailable')
    record('native_raft_restore_and_synthetic_value', True, separateContainer=True, separateAuditPreserved=True)
    # Explicitly verify lock deletion exception, necessary for normal restic jobs.
    lock_name = hashlib.sha256(b'synthetic-lock').hexdigest()
    create, _ = http('POST', '/uploader/locks/' + lock_name, b'synthetic-lock')
    delete, _ = http('DELETE', '/uploader/locks/' + lock_name)
    record('lock_delete_exception_observed', create == 200 and delete == 200, createHttp=create, deleteHttp=delete)
    net = json.loads(run(['docker', 'network', 'inspect', network]).stdout)[0]
    for name in containers:
        fixture = json.loads(run(['docker', 'inspect', name]).stdout)[0]
        assert fixture['Config']['Labels']['myims.backup-eval'] == operation
        assert all(m['Type'] != 'bind' or m['Source'].startswith(str(work) + '/') for m in fixture['Mounts'])
    record('isolated_network_and_storage', net['Internal'] and all(m['Type'] != 'bind' for m in info['Mounts']), hostPublishedPorts=0, retainedMounts=0)
    evidence['status'] = 'passed' if all(c['passed'] for c in evidence['checks']) else 'failed'
except BaseException as error:
    evidence['status'] = 'failed'
    evidence['failure'] = {'stage': stage, 'type': type(error).__name__, 'code': str(error) if isinstance(error, RuntimeError) else 'details_suppressed'}
finally:
    for name in containers:
        run(['docker', 'rm', '-f', name], check=False)
    run(['docker', 'volume', 'rm', volume], check=False)
    run(['docker', 'network', 'rm', network], check=False)
    shutil.rmtree(work)
    evidence['cleanup'] = {
        'containersAbsent': all(run(['docker', 'inspect', name], check=False).returncode != 0 for name in containers),
        'volumeAbsent': run(['docker', 'volume', 'inspect', volume], check=False).returncode != 0,
        'networkAbsent': run(['docker', 'network', 'inspect', network], check=False).returncode != 0,
        'privateWorkDirectoryAbsent': not work.exists(),
    }
    if not all(evidence['cleanup'].values()):
        evidence['status'] = 'failed'
    for dest in [ROOT / 'docs/status/p3-u3a-restic-evaluation-evidence.json', ROOT / 'docs/status/p3-u3a-disposable-runs' / (operation + '.json')]:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(evidence, indent=2) + '\n')
    print(json.dumps(evidence))
    if evidence['status'] != 'passed':
        raise SystemExit(1)
