#!/usr/bin/env python3
"""Fresh native TLS OpenBao capture -> offline encrypted archive -> ciphertext handoff.
Never mounts retained keys/data or contacts retained services. Rehearses only fresh synthetic seal-quorum recovery; no retained authority.
"""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import ssl
import subprocess
import tarfile
import tempfile
import time
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[2]
BAO = 'quay.io/openbao/openbao:2.7.1@sha256:6d2b93856e3fcf7b18ad855a0b51eaba474dc8b79cf554379ea32034797d2acf'
TOOLS = 'myims-backup-tools:recovery-capture-candidate'
operation = str(uuid.uuid4())
prefix = 'myims-capture-eval-' + operation[:8]
work = Path(tempfile.mkdtemp(prefix=prefix + '-'))
network = prefix + '-network'
containers, volumes = [], []
secrets = []
stage = 'setup'
deadline = time.monotonic() + 240
source = None
evidence = {'operationId': operation, 'retainedAccess': False, 'rootRecoveryExercised': True,
            'repositoryAccessed': False, 'checks': [], 'sourceSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}


class FixtureDeadline(BaseException):
    pass


def run(args, data=None, check=True):
    remaining = deadline - time.monotonic()
    if check and remaining <= 0:
        raise FixtureDeadline()
    result = subprocess.run(args, input=data, capture_output=True, timeout=max(1, min(90, remaining)) if check else 30)
    if check and result.returncode:
        diagnostic = (result.stdout + result.stderr).decode(errors='replace')[-3000:]
        for secret in secrets:
            diagnostic = diagnostic.replace(secret, '[redacted]')
        evidence['fixtureCommandDiagnostic'] = diagnostic
        raise RuntimeError('fixture_command_failed')
    return result


def check(name, value):
    evidence['checks'].append({'name': name, 'passed': bool(value)})
    if not value:
        raise RuntimeError('fixture_acceptance_failed')


def helper(label, args, mounts=(), fixture_network='none', data=None, user='1003:1003', persistent=False):
    name = prefix + '-' + label
    containers.append(name)
    return run(['docker', 'run', *([] if persistent else ['--rm']), '-i', '--name', name,
                '--label', 'myims.recovery-capture-fixture=' + operation, '--network', fixture_network,
                '--user', user, *(['--group-add', '12010'] if label in ['archive', 'audit-after'] else []), '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
                '--tmpfs', '/tmp:uid=1003,gid=1003,mode=1777', *mounts,
                '--entrypoint', 'node', TOOLS, *args], data)


def api(path, body=None, token=None):
    evidence['lastFixtureApi'] = path
    if time.monotonic() >= deadline:
        raise FixtureDeadline()
    request = urllib.request.Request(address + '/v1/' + path,
                                    data=None if body is None else json.dumps(body).encode(),
                                    headers={'Content-Type': 'application/json', **({'X-Vault-Token': token} if token else {})})
    with urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPSHandler(context=tls)).open(request, timeout=min(15, max(.1, deadline-time.monotonic()))) as response:
        return json.loads(response.read() or '{}')


try:
    os.chmod(work, 0o700)
    evidence['toolsImageId'] = json.loads(run(['docker', 'image', 'inspect', TOOLS]).stdout)[0]['Id']
    retained_tags = ['myims-backup-tools:development-candidate', 'myims-backup-tools:snapshot-candidate']
    before_tags = {tag: json.loads(run(['docker', 'image', 'inspect', tag]).stdout)[0]['Id'] for tag in retained_tags}
    # Reject stale candidate packaging before any provider setup.
    expected = ['scripts/backup/archive.mjs', 'scripts/backup/main.mjs', 'scripts/backup/recovery-capture.mjs',
                'scripts/openbao/recovery-snapshot.mjs', 'scripts/openbao/protected-client.mjs',
                'scripts/openbao/recovery-backup.mjs', 'scripts/openbao/recover-custodian.mjs', 'scripts/openbao/finish-recovery.mjs']
    hashes = json.loads(helper('image-hashes', ['-e', "const fs=require('node:fs'),c=require('node:crypto');console.log(JSON.stringify(Object.fromEntries(process.argv.slice(1).map(p=>[p,c.createHash('sha256').update(fs.readFileSync('/opt/'+p)).digest('hex')]))))", *expected]).stdout)
    check('candidate_image_matches_all_capture_archive_and_cleanup_sources', all(hashes[name] == hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in expected))
    evidence['artifactHashes'] = hashes
    run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', str(work / 'server.key'),
         '-out', str(work / 'server.crt'), '-days', '1', '-subj', '/CN=endpoint-secrets', '-addext', 'subjectAltName=DNS:endpoint-secrets'])
    for path in [work / 'server.key', work / 'server.crt']:
        path.chmod(0o644)  # Synthetic TLS fixture only; protected enclosing host directory.
    for purpose in ['audit', 'capture', 'encrypted', 'public']:
        name = prefix + '-' + purpose
        volumes.append(name)
        run(['docker', 'volume', 'create', '--label', 'myims.recovery-capture-fixture=' + operation, name])
        owner = prefix + '-owner-' + purpose
        containers.append(owner)
        # Root can chown ONLY this newly created empty fixture volume, with no host mounts/network.
        run(['docker', 'run', '--rm', '--name', owner, '--network', 'none', '--user', '0:0', '--read-only',
             '--cap-drop', 'ALL', '--cap-add', 'CHOWN', '-v', name + ':/owned', '--entrypoint', 'sh', BAO,
             '-c', 'chmod 0750 /owned && chown 0:12010 /owned' if purpose == 'public' else 'chmod 0700 /owned && chown 1003:1003 /owned'])
    audit_volume, capture_volume, encrypted_volume, public_volume = volumes
    run(['docker', 'network', 'create', '--internal', '--label', 'myims.recovery-capture-fixture=' + operation, network])
    config = 'disable_mlock=true\napi_addr="https://endpoint-secrets:8200"\ncluster_addr="https://127.0.0.1:8201"\nstorage "raft" { path="/bao/data" node_id="capture-fixture" }\nlistener "tcp" { address="0.0.0.0:8200" tls_cert_file="/bao/config/server.crt" tls_key_file="/bao/config/server.key" disable_unauthed_generate_root_endpoints=false }\naudit "file" "endpoint" { options { file_path="/bao/audit/endpoint.json" log_raw="false" } }\n'
    (work / 'server.hcl').write_text(config)
    (work / 'server.hcl').chmod(0o644)
    source = prefix + '-source'
    containers.append(source)
    run(['docker', 'run', '-d', '--name', source, '--label', 'myims.recovery-capture-fixture=' + operation,
         '--network', network, '--network-alias', 'endpoint-secrets', '--user', '1003:1003', '--read-only',
         '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
         '--tmpfs', '/tmp:uid=1003,gid=1003', '--tmpfs', '/bao/data:uid=1003,gid=1003,mode=0700',
         '-v', audit_volume + ':/bao/audit', '-v', str(work / 'server.hcl') + ':/bao/config/server.hcl:ro',
         '-v', str(work / 'server.crt') + ':/bao/config/server.crt:ro', '-v', str(work / 'server.key') + ':/bao/config/server.key:ro',
         BAO, 'server', '-config=/bao/config/server.hcl'])
    source_info = json.loads(run(['docker', 'inspect', source]).stdout)[0]
    address = 'https://' + source_info['NetworkSettings']['Networks'][network]['IPAddress'] + ':8200'
    tls = ssl.create_default_context(cafile=str(work / 'server.crt'))
    tls.check_hostname = False  # Host fixture probes only; capture helper validates the DNS SAN.
    for _ in range(100):
        try:
            if not api('sys/init')['initialized']:
                break
        except Exception:
            pass
        time.sleep(.2)
    stage = 'source_initialization'
    init = api('sys/init', {'secret_shares': 1, 'secret_threshold': 1})
    root = init['root_token']
    secrets.extend([root, *init['keys_base64']])
    stage = 'source_unseal'
    api('sys/unseal', {'key': init['keys_base64'][0]})
    stage = 'source_active'
    for _ in range(150):
        try:
            if not api('sys/health')['sealed']:
                break
        except Exception:
            pass
        time.sleep(.2)
    else:
        raise RuntimeError('fixture_not_active')
    api('auth/token/revoke-self', {}, root)
    try:
        api('auth/token/lookup-self', token=root)
        raise RuntimeError('initial_root_revocation_unconfirmed')
    except urllib.error.HTTPError as error:
        check('initial_fixture_root_revoked_403_before_quorum_recovery', error.code == 403)
    stage = 'actual_native_capture_and_root_cleanup'
    bootstrap = """import fs from 'node:fs';
const input=JSON.parse(fs.readFileSync(0,'utf8'));
fs.writeFileSync('/seal/ca.crt',fs.readFileSync('/fixture-ca'),{mode:0o600,flag:'wx'});
fs.writeFileSync('/seal/seal.json',JSON.stringify({key:input.seal}),{mode:0o600,flag:'wx'});
fs.writeFileSync('/recovery/confirmed.json',JSON.stringify({operationId:input.operationId,executeRecovery:true,confirmedAt:new Date().toISOString()}),{mode:0o600,flag:'wx'});
process.argv=[process.execPath,'/opt/scripts/openbao/recover-custodian.mjs',input.operationId];
await import('/opt/scripts/openbao/recover-custodian.mjs');
if(!process.exitCode)await import('/opt/scripts/openbao/recovery-backup.mjs');
if(!process.exitCode)await import('/opt/scripts/openbao/finish-recovery.mjs');
"""
    capture = helper('capture', ['--input-type=module', '-e', bootstrap],
                     ['--tmpfs', '/recovery:uid=1003,gid=1003,mode=0700', '--tmpfs', '/seal:uid=1003,gid=1003,mode=0700', '-v', capture_volume + ':/backup',
                      '-v', audit_volume + ':/audit:ro', '-v', str(work / 'server.crt') + ':/fixture-ca:ro'],
                     network, json.dumps({'operationId': operation, 'seal': init['keys_base64'][0]}).encode())
    results = [json.loads(line) for line in capture.stdout.splitlines() if line]
    check('actual_native_capture_helper_and_root_finisher_pass', [row.get('state') for row in results] == ['recovered_in_tmpfs', 'backup_and_inventory_preserved', 'root_revoked'])
    check('temporary_fixture_root_revoked_403_by_actual_finisher', results[-1].get('state') == 'root_revoked')
    stage = 'offline_archive'
    # Synthetic age identity is generated independently of the provider.
    name = prefix + '-age-keygen'
    containers.append(name)
    key = run(['docker', 'run', '--rm', '--name', name, '--network', 'none', '--read-only', '--cap-drop', 'ALL',
               '--security-opt', 'no-new-privileges:true', '--entrypoint', 'age-keygen', TOOLS]).stdout
    (work / 'identity').write_bytes(key)
    (work / 'identity').chmod(0o600)
    name = prefix + '-age-recipient'
    containers.append(name)
    recipient = run(['docker', 'run', '--rm', '-i', '--name', name, '--network', 'none', '--read-only',
                     '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--entrypoint', 'age-keygen', TOOLS, '-y'], key).stdout
    public_writer = prefix + '-public-recipient'
    containers.append(public_writer)
    run(['docker', 'run', '--rm', '-i', '--name', public_writer, '--network', 'none', '--read-only', '--user', '0:0',
         '--cap-drop', 'ALL', '--cap-add', 'CHOWN', '-v', public_volume + ':/public', '--entrypoint', 'node', TOOLS, '-e',
         "const fs=require('node:fs');fs.writeFileSync('/public/recipient.txt',fs.readFileSync(0),{mode:0o440,flag:'wx'});fs.chownSync('/public/recipient.txt',0,12010);"], recipient)
    archived = json.loads(helper('archive', ['/opt/scripts/backup/main.mjs', 'archive-recovery', '/input', '/output', '/public/recipient.txt', operation],
                                 ['-v', capture_volume + ':/input:ro', '-v', encrypted_volume + ':/output', '-v', public_volume + ':/public:ro']).stdout)
    check('native_capture_archived_after_root_cleanup_with_no_provider_network', archived['status'] == 'passed')
    archive_id = archived['operationId']
    source_dir, spool = work / 'encrypted', work / 'spool'
    source_dir.mkdir(mode=0o700)
    spool.mkdir(mode=0o700)
    for extension in ['age', 'json']:
        data = helper('read-' + extension, ['-e', 'process.stdout.write(require("node:fs").readFileSync(process.argv[1]))', '/encrypted/' + archive_id + '.' + extension],
                      ['-v', encrypted_volume + ':/encrypted:ro']).stdout
        (source_dir / (archive_id + '.' + extension)).write_bytes(data)
        (source_dir / (archive_id + '.' + extension)).chmod(0o600)
    spec = importlib.util.spec_from_file_location('handoff', ROOT / 'scripts/backup-host/recovery-handoff.py')
    handoff = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(handoff)
    evidence['hostHandoffSha256'] = hashlib.sha256((ROOT / 'scripts/backup-host/recovery-handoff.py').read_bytes()).hexdigest()
    stage = 'ciphertext_only_host_handoff'
    owner = (os.getuid(), os.getgid())
    transferred = handoff.handoff(source_dir, spool, operation, owner, owner)
    check('actual_ciphertext_handoff_preserves_operation_hash_and_private_custody', transferred['status'] == 'ciphertext_handoff_verified' and not transferred['plaintextCopied'])
    name = prefix + '-decrypt'
    containers.append(name)
    decrypted = run(['docker', 'run', '--rm', '--name', name, '--network', 'none', '--read-only', '--cap-drop', 'ALL',
                     '--security-opt', 'no-new-privileges:true', '--user', str(os.getuid()) + ':' + str(os.getgid()),
                     '-v', str(work) + ':/fixture:ro', '--entrypoint', 'age', TOOLS, '-d', '-i', '/fixture/identity',
                     '/fixture/spool/' + archive_id + '.age']).stdout
    with tarfile.open(fileobj=io.BytesIO(decrypted), mode='r:gz') as bundle:
        manifest = json.load(bundle.extractfile('manifest.json'))
        check('native_capture_decrypts_with_all_seven_members_and_internal_hashes', len(manifest['files']) == 7 and
              all(hashlib.sha256(bundle.extractfile(member).read()).hexdigest() == value['sha256'] for member, value in manifest['files'].items()))
        inventory = json.load(bundle.extractfile('inventory.json'))
        check('inventory_retained_privately_without_root_bearer_and_no_authority_claim', inventory['operationId'] == operation and
              'id' not in inventory['self'] and manifest['effectiveAuthorityApproved'] is False and manifest['postgresRecoveryVerified'] is False)
    stage = 'separate_post_cleanup_audit'
    audited = json.loads(helper('audit-after', ['/opt/scripts/backup/main.mjs', 'archive-recovery-audit', '/audit', '/output', '/public/recipient.txt', operation],
                                ['-v', audit_volume + ':/audit:ro', '-v', encrypted_volume + ':/output', '-v', public_volume + ':/public:ro']).stdout)
    audit_id = audited['operationId']
    audit_source = work / 'audit-encrypted'
    audit_source.mkdir(mode=0o700)
    for extension in ['age', 'json']:
        data = helper('audit-read-' + extension, ['-e', 'process.stdout.write(require("node:fs").readFileSync(process.argv[1]))', '/encrypted/' + audit_id + '.' + extension],
                      ['-v', encrypted_volume + ':/encrypted:ro']).stdout
        path = audit_source / (audit_id + '.' + extension)
        path.write_bytes(data)
        path.chmod(0o600)
    check('post_cleanup_audit_has_independent_ciphertext_handoff', handoff.handoff(audit_source, spool, operation, owner, owner)['status'] == 'ciphertext_handoff_verified')
    name = prefix + '-decrypt-audit'
    containers.append(name)
    audit_clear = run(['docker', 'run', '--rm', '--name', name, '--network', 'none', '--read-only', '--cap-drop', 'ALL',
                      '--security-opt', 'no-new-privileges:true', '--user', str(os.getuid()) + ':' + str(os.getgid()),
                      '-v', str(work) + ':/fixture:ro', '--entrypoint', 'age', TOOLS, '-d', '-i', '/fixture/identity',
                      '/fixture/spool/' + audit_id + '.age']).stdout
    with tarfile.open(fileobj=io.BytesIO(audit_clear), mode='r:gz') as audit_bundle:
        audit_manifest = json.load(audit_bundle.extractfile('manifest.json'))
        audit_bytes = audit_bundle.extractfile('audit.jsonl').read()
        check('separate_encrypted_audit_covers_fixture_root_revocation', audit_manifest['kind'] == 'recovery-audit' and
              audit_manifest['captureOperationId'] == operation and b'auth/token/revoke-self' in audit_bytes and
              hashlib.sha256(audit_bytes).hexdigest() == audit_manifest['files']['audit.jsonl']['sha256'])
    after_tags = {tag: json.loads(run(['docker', 'image', 'inspect', tag]).stdout)[0]['Id'] for tag in retained_tags}
    check('installed_and_snapshot_candidate_tags_unchanged', before_tags == after_tags)
    evidence['retainedToolingImages'] = after_tags
    evidence['status'] = 'passed'
except BaseException as error:
    evidence['status'] = 'failed'
    evidence['failure'] = {'stage': stage, 'type': type(error).__name__, 'code': str(error) if isinstance(error, RuntimeError) else 'details_suppressed'}
finally:
    if evidence.get('status') != 'passed' and source is not None:
        diagnostic = run(['docker', 'logs', '--tail', '50', source], check=False)
        log = (diagnostic.stdout + diagnostic.stderr).decode(errors='replace')[-10000:]
        for secret in secrets:
            log = log.replace(secret, '[redacted]')
        evidence['freshFixtureLog'] = log
    for name in containers:
        run(['docker', 'rm', '-f', name], check=False)
    for name in volumes:
        run(['docker', 'volume', 'rm', name], check=False)
    run(['docker', 'network', 'rm', network], check=False)
    shutil.rmtree(work)
    evidence['cleanup'] = {'containersAbsent': all(run(['docker', 'inspect', name], check=False).returncode != 0 for name in containers),
                           'volumesAbsent': all(run(['docker', 'volume', 'inspect', name], check=False).returncode != 0 for name in volumes),
                           'networkAbsent': run(['docker', 'network', 'inspect', network], check=False).returncode != 0,
                           'privateWorkDirectoryAbsent': not work.exists()}
    if not all(evidence['cleanup'].values()):
        evidence['status'] = 'failed'
    for path in [ROOT / 'docs/status/p3-u3a-recovery-capture-handoff-evidence.json', ROOT / 'docs/status/p3-u3a-disposable-runs' / (operation + '.json')]:
        path.write_text(json.dumps(evidence, indent=2) + '\n')
    print(json.dumps(evidence))
    if evidence['status'] != 'passed':
        raise SystemExit(1)
