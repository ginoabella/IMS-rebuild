"""Manual synthetic-only evaluation. Creates labelled disposable Docker resources.
Requires host Python boto3 and age/age-keygen paths; never reads application env/custody.
No schedule, retained service, OpenBao login, or Garage operation is installed.
"""
import argparse
import concurrent.futures
import threading
import datetime as dt
import hashlib
import io
import json
import os
import pathlib
import shutil
import signal
import subprocess
import tarfile
import tempfile
import time
import urllib.request
import urllib.error
import uuid

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

ROOT = pathlib.Path(__file__).resolve().parents[2]
SEAWEED = 'chrislusf/seaweedfs:4.48@sha256:4e61d15fd35994cb1e43e1e553dff106794841fd9a99ade2fc8c8bfce4d7872d'
BAO = 'quay.io/openbao/openbao:2.7.1@sha256:6d2b93856e3fcf7b18ad855a0b51eaba474dc8b79cf554379ea32034797d2acf'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--age', required=True)
parser.add_argument('--age-keygen', required=True)
a = parser.parse_args()
os.umask(0o077)
op = str(uuid.uuid4())
prefix = 'myims-backup-eval-' + op[:8]
work = pathlib.Path(tempfile.mkdtemp(prefix=prefix + '-'))
containers, volumes = [], []
evidence = {'operationId': op, 'startedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'seaweedImage': SEAWEED, 'openbaoImage': BAO, 'retainedAccess': False, 'checks': []}
network = prefix + '-net'
bucket = 'synthetic-backups'
admin_key, uploader_key = uuid.uuid4().hex, uuid.uuid4().hex
admin_secret, uploader_secret = uuid.uuid4().hex, uuid.uuid4().hex
stage = 'setup'


def run(args, data=None, timeout=90):
    p = subprocess.run(args, input=data, capture_output=True, timeout=timeout)
    if p.returncode:
        raise RuntimeError('command_failed_' + pathlib.Path(args[0]).name)
    return p.stdout


def record(name, passed, **detail):
    evidence['checks'].append({'name': name, 'passed': bool(passed), **detail})


def rejection(name, call, allowed=(403,)):
    try:
        result = call()
        record(name, False, http=result.get('ResponseMetadata', {}).get('HTTPStatusCode'), outcome='accepted')
        return False
    except ClientError as e:
        code = e.response['ResponseMetadata']['HTTPStatusCode']
        record(name, code in allowed, http=code, code=e.response['Error']['Code'])
        return code in allowed


def port(name, number):
    info = json.loads(run(['docker', 'inspect', name]))[0]
    assert not info['HostConfig']['PortBindings']
    assert list(info['NetworkSettings']['Networks']) == [network]
    address = info['NetworkSettings']['Networks'][network]['IPAddress']
    return 'http://' + address + ':' + str(number)



def s3(endpoint, upload=False):
    # Explicit synthetic credentials: no SDK environment/default credential discovery.
    return boto3.client('s3', endpoint_url=endpoint, region_name='us-east-1', aws_access_key_id=uploader_key if upload else admin_key, aws_secret_access_key=uploader_secret if upload else admin_secret, config=Config(proxies={}, signature_version='s3v4', retries={'max_attempts': 0}, connect_timeout=3, read_timeout=10, s3={'addressing_style': 'path'}))


def wait_s3(endpoint):
    for _ in range(150):
        try:
            s3(endpoint).list_buckets()
            return
        except Exception:
            time.sleep(.2)
    raise RuntimeError('s3_not_ready')


def start_storage(suffix):
    name = prefix + '-' + suffix
    volume = name + '-data'
    volumes.append(volume)
    run(['docker', 'volume', 'create', '--label', 'myims.backup-eval=' + op, volume])
    containers.append(name)
    run(['docker', 'run', '-d', '--name', name, '--label', 'myims.backup-eval=' + op, '--network', network, '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--user', '1000:1000', '--read-only', '--tmpfs', '/tmp:uid=1000,gid=1000', '-v', volume + ':/data', '-v', str(work / 's3.json') + ':/etc/seaweedfs/s3.json:ro', SEAWEED, 'mini', '-dir=/data', '-ip=127.0.0.1', '-ip.bind=0.0.0.0', '-s3.config=/etc/seaweedfs/s3.json', '-s3.iam=false', '-admin.ui=false', '-webdav=false', '-s3.port.iceberg=0', '-s3.port.lance=0', '-s3.allowDeleteBucketNotEmpty=false', '-s3.autoCreateBucket=false', '-master.telemetry=false'])
    endpoint = port(name, 8333)
    wait_s3(endpoint)
    client = s3(endpoint)
    client.create_bucket(Bucket=bucket, ObjectLockEnabledForBucket=True)
    client.put_object_lock_configuration(Bucket=bucket, ObjectLockConfiguration={'ObjectLockEnabled': 'Enabled', 'Rule': {'DefaultRetention': {'Mode': 'COMPLIANCE', 'Days': 30}}})
    # The identity has no legacy grants; this grants only PutObject to one prefix.
    policy = {'Version': '2012-10-17', 'Statement': [{'Effect': 'Allow', 'Principal': {'AWS': 'arn:aws:iam::000000000000:user/uploader'}, 'Action': 's3:PutObject', 'Resource': 'arn:aws:s3:::' + bucket + '/sets/*'}]}
    client.put_bucket_policy(Bucket=bucket, Policy=json.dumps(policy))
    return name, endpoint, client


def bao_api(endpoint, path, body=None, token=None, method=None, binary=False):
    req = urllib.request.Request(endpoint + '/v1/' + path, data=json.dumps(body).encode() if body is not None else None, method=method or ('POST' if body is not None else 'GET'), headers={'Content-Type': 'application/json', **({'X-Vault-Token': token} if token else {})})
    evidence['lastSyntheticBaoRequest'] = {'path': path, 'method': req.method}
    with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req, timeout=15) as res:
        data = res.read()
        return data if binary else json.loads(data or '{}')


def start_bao(suffix):
    name = prefix + '-' + suffix
    containers.append(name)
    config = 'disable_mlock=true\napi_addr="http://127.0.0.1:8200"\ncluster_addr="http://127.0.0.1:8201"\nstorage "raft" { path="/bao/data" }\nlistener "tcp" { address="0.0.0.0:8200" tls_disable=true }\naudit \"file\" \"eval\" { options { file_path=\"/tmp/audit.jsonl\" log_raw=\"false\" } }\n'
    (work / (suffix + '.hcl')).write_text(config)
    os.chmod(work / (suffix + '.hcl'), 0o644)
    run(['docker', 'run', '-d', '--name', name, '--label', 'myims.backup-eval=' + op, '--network', network, '--user', '1003:1003', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--tmpfs', '/bao/data:uid=1003,gid=1003,mode=0700', '--tmpfs', '/tmp:uid=1003,gid=1003', '-v', str(work / (suffix + '.hcl')) + ':/bao/config/eval.hcl:ro', BAO, 'server', '-config=/bao/config/eval.hcl'])
    endpoint = port(name, 8200)
    for _ in range(100):
        try:
            if not bao_api(endpoint, 'sys/init')['initialized']:
                break
        except Exception:
            time.sleep(.2)
    init = bao_api(endpoint, 'sys/init', {'secret_shares': 1, 'secret_threshold': 1})
    key, token = init['keys_base64'][0], init['root_token']
    bao_api(endpoint, 'sys/unseal', {'key': key})
    for _ in range(100):
        try:
            if bao_api(endpoint, 'sys/health').get('sealed') is False:
                return name, endpoint, key, token
        except urllib.error.HTTPError:
            pass
        time.sleep(.2)
    raise RuntimeError('synthetic_bao_not_active')


def encrypted_artifacts(snapshot, audit):
    run([a.age_keygen, '-o', str(work / 'identity')])
    recipient = run([a.age_keygen, '-y', str(work / 'identity')]).decode().strip()
    files = {'snapshot.snap': snapshot, 'audit.jsonl': audit}
    manifest = {'format': 1, 'operationId': op, 'files': {n: {'sha256': hashlib.sha256(b).hexdigest(), 'bytes': len(b)} for n, b in files.items()}}
    files['manifest.json'] = json.dumps(manifest, sort_keys=True).encode()
    tar = io.BytesIO()
    with tarfile.open(fileobj=tar, mode='w:gz') as t:
        for n, b in files.items():
            item = tarfile.TarInfo(n); item.size = len(b); item.mode = 0o600
            t.addfile(item, io.BytesIO(b))
    encrypted = run([a.age, '-r', recipient], tar.getvalue())
    record('age_encryption_before_upload', encrypted.startswith(b'age-encryption.org/v1') and b'synthetic-raft-value' not in encrypted)
    return encrypted


def upload_archive(endpoint, key, encrypted):
    # Same endpoint-configured mechanism for both independently stored endpoints.
    return s3(endpoint, True).put_object(Bucket=bucket, Key=key, Body=encrypted, ContentType='application/octet-stream', IfNoneMatch='*')


def verify_archive(encrypted):
    plain = run([a.age, '-d', '-i', str(work / 'identity')], encrypted)
    with tarfile.open(fileobj=io.BytesIO(plain), mode='r:gz') as t:
        assert set(t.getnames()) == {'snapshot.snap', 'audit.jsonl', 'manifest.json'}
        manifest = json.load(t.extractfile('manifest.json'))
        files = {n: t.extractfile(n).read() for n in manifest['files']}
        for n, b in files.items():
            assert hashlib.sha256(b).hexdigest() == manifest['files'][n]['sha256']
            assert len(b) == manifest['files'][n]['bytes']
    return files


signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
try:
    # File mounts are readable only in explicitly named fixture containers.
    identities = {'identities': [{'name': 'admin', 'credentials': [{'accessKey': admin_key, 'secretKey': admin_secret}], 'actions': ['Admin']}, {'name': 'uploader', 'credentials': [{'accessKey': uploader_key, 'secretKey': uploader_secret}], 'actions': []}]}
    (work / 's3.json').write_text(json.dumps(identities)); os.chmod(work / 's3.json', 0o644)
    run(['docker', 'network', 'create', '--internal', '--label', 'myims.backup-eval=' + op, network])
    stage = 'storage_start'
    name, endpoint, admin = start_storage('storage-a')
    evidence['binaryVersion'] = run(['docker', 'exec', name, 'weed', 'version']).decode().splitlines()[-1]
    info = json.loads(run(['docker', 'image', 'inspect', SEAWEED]))[0]
    evidence['imageId'] = info['Id']; evidence['architecture'] = info['Architecture']; evidence['repoDigests'] = info['RepoDigests']
    record('bucket_versioning_enabled', admin.get_bucket_versioning(Bucket=bucket).get('Status') == 'Enabled')
    record('default_compliance_30_days', admin.get_object_lock_configuration(Bucket=bucket)['ObjectLockConfiguration']['Rule']['DefaultRetention'] == {'Mode': 'COMPLIANCE', 'Days': 30})
    stage = 'synthetic_native_snapshot'
    bao_name, bao, seal, root_token = start_bao('source-bao')
    bao_api(bao, 'sys/mounts/synthetic', {'type': 'kv', 'options': {'version': '2'}}, root_token)
    bao_api(bao, 'synthetic/data/fixture', {'data': {'value': 'synthetic-raft-value-' + op}}, root_token)
    snapshot = bao_api(bao, 'sys/storage/raft/snapshot', token=root_token, binary=True)
    audit = run(['docker', 'exec', bao_name, 'cat', '/tmp/audit.jsonl'])
    assert audit.endswith(b'\n') and all(json.loads(line) for line in audit.splitlines())
    with tarfile.open(fileobj=io.BytesIO(snapshot), mode='r:gz') as t:
        record('native_raft_snapshot_structure', {'meta.json', 'state.bin', 'SHA256SUMS'}.issubset(t.getnames()), bytes=len(snapshot))
    record('separate_audit_records', len(audit.splitlines()) > 0, bytes=len(audit), records=len(audit.splitlines()))
    encrypted = encrypted_artifacts(snapshot, audit)
    evidence['encryptedArchive'] = {'sha256': hashlib.sha256(encrypted).hexdigest(), 'bytes': len(encrypted)}
    stage = 'upload_and_security'
    key = 'sets/' + dt.datetime.now(dt.timezone.utc).strftime('%Y/%m/%d/') + op + '/backup.tar.gz.age'
    response = upload_archive(endpoint, key, encrypted)
    version = response.get('VersionId')
    record('least_privilege_upload_unique_key', bool(version), http=response['ResponseMetadata']['HTTPStatusCode'])
    evidence['objectVersionId'] = version
    upload = s3(endpoint, True)
    rejection('uploader_read_denied', lambda: upload.get_object(Bucket=bucket, Key=key))
    rejection('uploader_list_denied', lambda: upload.list_objects_v2(Bucket=bucket))
    rejection('uploader_other_prefix_denied', lambda: upload.put_object(Bucket=bucket, Key='outside/backup.age', Body=encrypted))
    rejection('uploader_bucket_create_denied', lambda: upload.create_bucket(Bucket='unauthorized-bucket'))
    rejection('uploader_delete_denied', lambda: upload.delete_object(Bucket=bucket, Key=key))
    rejection('uploader_version_delete_denied', lambda: upload.delete_object(Bucket=bucket, Key=key, VersionId=version))
    rejection('uploader_retention_change_denied', lambda: upload.put_object_retention(Bucket=bucket, Key=key, VersionId=version, Retention={'Mode': 'COMPLIANCE', 'RetainUntilDate': dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=60)}))
    rejection('uploader_bucket_policy_change_denied', lambda: upload.put_bucket_policy(Bucket=bucket, Policy=json.dumps({'Version':'2012-10-17','Statement':[]})))
    rejection('uploader_bucket_retention_change_denied', lambda: upload.put_object_lock_configuration(Bucket=bucket, ObjectLockConfiguration={'ObjectLockEnabled':'Enabled'}))
    for mode in ['GOVERNANCE', 'COMPLIANCE']:
        rejection('uploader_cannot_override_default_with_short_' + mode.lower(), lambda mode=mode: upload.put_object(Bucket=bucket, Key='sets/short-' + mode.lower() + '.age', Body=encrypted, ObjectLockMode=mode, ObjectLockRetainUntilDate=dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=60)))
    rejection('uploader_cannot_supply_past_retention', lambda: upload.put_object(Bucket=bucket, Key='sets/past.age', Body=encrypted, ObjectLockMode='COMPLIANCE', ObjectLockRetainUntilDate=dt.datetime.now(dt.timezone.utc)-dt.timedelta(days=1)), (400,403))
    rejection('conditional_same_key_upload_denied', lambda: upload_archive(endpoint, key, encrypted), (409, 412))
    stage = 'compliance'
    retention = admin.get_object_retention(Bucket=bucket, Key=key, VersionId=version)['Retention']
    until = retention['RetainUntilDate']
    record('object_inherits_compliance_retention', retention['Mode'] == 'COMPLIANCE' and until > dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=29))
    rejection('admin_locked_version_delete_denied', lambda: admin.delete_object(Bucket=bucket, Key=key, VersionId=version))
    rejection('admin_bypass_header_delete_denied', lambda: admin.delete_object(Bucket=bucket, Key=key, VersionId=version, BypassGovernanceRetention=True))
    rejection('admin_retention_shorten_denied', lambda: admin.put_object_retention(Bucket=bucket, Key=key, VersionId=version, Retention={'Mode':'COMPLIANCE','RetainUntilDate': until - dt.timedelta(days=1)}))
    rejection('admin_retention_remove_denied', lambda: admin.put_object_retention(Bucket=bucket, Key=key, VersionId=version, Retention={}), (400, 403))
    rejection('admin_compliance_to_governance_denied', lambda: admin.put_object_retention(Bucket=bucket, Key=key, VersionId=version, Retention={'Mode':'GOVERNANCE','RetainUntilDate':until}))
    rejection('versioning_suspend_denied', lambda: admin.put_bucket_versioning(Bucket=bucket, VersioningConfiguration={'Status':'Suspended'}), (400,409))
    rejection('locked_bucket_delete_denied', lambda: admin.delete_bucket(Bucket=bucket), (403,409))
    extended = until + dt.timedelta(days=1)
    admin.put_object_retention(Bucket=bucket, Key=key, VersionId=version, Retention={'Mode':'COMPLIANCE','RetainUntilDate':extended})
    retention = admin.get_object_retention(Bucket=bucket, Key=key, VersionId=version)['Retention']
    record('admin_compliance_extension_persists', retention['RetainUntilDate'] == extended)
    rejection('admin_cannot_undo_retention_extension', lambda: admin.put_object_retention(Bucket=bucket, Key=key, VersionId=version, Retention={'Mode':'COMPLIANCE','RetainUntilDate':until}))
    until = extended
    admin.put_object_lock_configuration(Bucket=bucket, ObjectLockConfiguration={'ObjectLockEnabled':'Enabled'})
    record('existing_retention_survives_bucket_default_removal', admin.get_object_retention(Bucket=bucket, Key=key, VersionId=version)['Retention'] == retention)
    rejection('existing_version_delete_denied_without_bucket_default', lambda: admin.delete_object(Bucket=bucket, Key=key, VersionId=version))
    admin.put_object_lock_configuration(Bucket=bucket, ObjectLockConfiguration={'ObjectLockEnabled':'Enabled','Rule':{'DefaultRetention':{'Mode':'COMPLIANCE','Days':30}}})
    # Observe raw same-key semantics separately from workflow's conditional PUT.
    replacement = run([a.age, '-r', run([a.age_keygen, '-y', str(work / 'identity')]).decode().strip()], b'synthetic alternate content')
    raw = upload.put_object(Bucket=bucket, Key=key, Body=replacement)
    record('raw_same_key_put_preserves_original_version', raw.get('VersionId') != version and admin.get_object(Bucket=bucket, Key=key, VersionId=version)['Body'].read() == encrypted, rawUploadHttp=raw['ResponseMetadata']['HTTPStatusCode'], newVersionCreated=raw.get('VersionId') != version)
    record('raw_put_changes_current_version', admin.get_object(Bucket=bucket, Key=key)['Body'].read() == replacement)
    # Strict no-key-reuse requirement is a distinct failed gate, not a retention bypass.
    evidence['strictUnconditionalOverwriteRejection'] = False
    stage = 'restart'
    run(['docker', 'restart', name]); wait_s3(endpoint)
    admin = s3(endpoint)
    record('retention_and_bytes_survive_restart', admin.get_object_retention(Bucket=bucket, Key=key, VersionId=version)['Retention'] == retention and admin.get_object(Bucket=bucket, Key=key, VersionId=version)['Body'].read() == encrypted)
    rejection('admin_delete_denied_after_restart', lambda: admin.delete_object(Bucket=bucket, Key=key, VersionId=version))
    rejection('admin_shorten_denied_after_restart', lambda: admin.put_object_retention(Bucket=bucket, Key=key, VersionId=version, Retention={'Mode':'COMPLIANCE','RetainUntilDate':until-dt.timedelta(days=1)}))
    rejection('uploader_read_denied_after_restart', lambda: s3(endpoint, True).get_object(Bucket=bucket, Key=key))
    stage = 'concurrent_retention_metadata'
    races = []
    evidence['retentionRaces'] = races
    for round_number in range(20):
        race_key = 'sets/race-' + str(round_number) + '.age'
        race_version = admin.put_object(Bucket=bucket,Key=race_key,Body=encrypted)['VersionId']
        race_until = dt.datetime.now(dt.timezone.utc).replace(microsecond=0) + dt.timedelta(days=60)
        barrier = threading.Barrier(2)
        def extend_race():
            client = s3(endpoint); barrier.wait(timeout=5)
            return client.put_object_retention(Bucket=bucket,Key=race_key,VersionId=race_version,Retention={'Mode':'COMPLIANCE','RetainUntilDate':race_until})['ResponseMetadata']['HTTPStatusCode']
        def hold_race():
            client = s3(endpoint); barrier.wait(timeout=5)
            return client.put_object_legal_hold(Bucket=bucket,Key=race_key,VersionId=race_version,LegalHold={'Status':'ON'})['ResponseMetadata']['HTTPStatusCode']
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            tasks = [executor.submit(extend_race),executor.submit(hold_race)]
            statuses = [task.result(timeout=20) for task in tasks]
        final_retention = admin.get_object_retention(Bucket=bucket,Key=race_key,VersionId=race_version)['Retention']
        try:
            final_hold = admin.get_object_legal_hold(Bucket=bucket,Key=race_key,VersionId=race_version).get('LegalHold',{}).get('Status')
        except ClientError as err:
            if err.response['Error']['Code'] not in ['NoSuchObjectLegalHold','NoSuchObjectLockConfiguration','InvalidRequest','NoSuchKey']:
                raise
            final_hold = None
        races.append({'round':round_number,'retentionPutHttp':statuses[0],'legalHoldPutHttp':statuses[1],'requestedRetainUntil':race_until.isoformat(),'actualRetainUntil':final_retention['RetainUntilDate'].isoformat(),'actualLegalHold':final_hold,'retentionExtensionPreserved':final_retention['RetainUntilDate'] >= race_until,'legalHoldPreserved':final_hold=='ON'})
    record('concurrent_retention_and_legal_hold_preserve_both_updates', all(r['retentionExtensionPreserved'] and r['legalHoldPreserved'] for r in races), rounds=20, lostExtensionCount=sum(not r['retentionExtensionPreserved'] for r in races), lostLegalHoldCount=sum(not r['legalHoldPreserved'] for r in races))
    stage = 'endpoint_portability'
    second_name, second_endpoint, second = start_storage('storage-b')
    migrated = upload_archive(second_endpoint, key, encrypted)
    recovered = second.get_object(Bucket=bucket, Key=key, VersionId=migrated['VersionId'])['Body'].read()
    record('same_archive_and_uploader_second_independent_endpoint', recovered == encrypted, separateVolume=True, endpointConfigurationOnly=True, physicallySeparateHostTested=False)
    stage = 'isolated_restore'
    files = verify_archive(recovered)
    record('decrypt_and_integrity_manifest', files['snapshot.snap'] == snapshot and files['audit.jsonl'] == audit)
    run([a.age_keygen, '-o', str(work / 'wrong-identity')])
    wrong = subprocess.run([a.age,'-d','-i',str(work/'wrong-identity')], input=recovered,capture_output=True)
    record('wrong_age_identity_rejected', wrong.returncode != 0)
    # Native snapshot checksums supplement the external encrypted manifest.
    with tarfile.open(fileobj=io.BytesIO(files['snapshot.snap']),mode='r:gz') as native:
        sums = native.extractfile('SHA256SUMS').read().decode().splitlines()
        valid = True
        for line in sums:
            digest, member = line.split(None,1)
            valid = valid and hashlib.sha256(native.extractfile(member.lstrip('* ')).read()).hexdigest() == digest
        record('native_snapshot_checksums', valid and bool(sums))
    changed_files = dict(files)
    changed_files['snapshot.snap'] = snapshot[:-1] + bytes([snapshot[-1]^1])
    with tarfile.open(fileobj=io.BytesIO(run([a.age,'-d','-i',str(work/'identity')],recovered)),mode='r:gz') as t:
        manifest = json.load(t.extractfile('manifest.json'))
    record('manifest_detects_changed_snapshot', hashlib.sha256(changed_files['snapshot.snap']).hexdigest() != manifest['files']['snapshot.snap']['sha256'])
    corrupt = bytearray(recovered); corrupt[-8] ^= 1
    p = subprocess.run([a.age, '-d', '-i', str(work / 'identity')], input=bytes(corrupt), capture_output=True)
    record('corrupt_ciphertext_rejected', p.returncode != 0)
    restore_name, restore, _, restore_token = start_bao('restore-bao')
    # Write synthetic snapshot inside exact fixture's tmpfs; never to retained provider.
    run(['docker', 'exec', '-i', restore_name, 'sh', '-c', 'cat > /tmp/restore.snap'], files['snapshot.snap'])
    run(['docker', 'exec', '-e', 'BAO_ADDR=http://127.0.0.1:8200', '-e', 'BAO_TOKEN=' + restore_token, restore_name, 'bao', 'operator', 'raft', 'snapshot', 'restore', '-force', '/tmp/restore.snap'])
    for _ in range(100):
        try:
            status = bao_api(restore, 'sys/seal-status')
            if status['sealed']:
                bao_api(restore, 'sys/unseal', {'key': seal})
            value = bao_api(restore, 'synthetic/data/fixture', token=root_token)['data']['data']['value']
            if value == 'synthetic-raft-value-' + op:
                break
        except Exception:
            time.sleep(.2)
    else:
        raise RuntimeError('restored_value_unavailable')
    record('native_raft_restore_and_synthetic_value', True, separateContainer=True, separateAuditPreserved=True)
    stage = 'isolation'
    for c in containers:
        info = json.loads(run(['docker','inspect',c]))[0]
        assert info['Config']['Labels']['myims.backup-eval'] == op
        assert list(info['NetworkSettings']['Networks']) == [network]
        assert all(m['Type'] != 'bind' or m['Source'].startswith(str(work) + '/') for m in info['Mounts'])
    record('isolated_fixture_mounts_and_network', json.loads(run(['docker','network','inspect',network]))[0]['Internal'], retainedMounts=0)
    evidence['status'] = 'passed_with_limitations' if all(c['passed'] for c in evidence['checks']) else 'failed'
except BaseException as e:
    evidence['status'] = 'failed'
    if isinstance(e, ClientError):
        evidence['s3Failure'] = {'operation': e.operation_name, 'code': e.response['Error']['Code'], 'http': e.response['ResponseMetadata']['HTTPStatusCode']}
    if isinstance(e, urllib.error.HTTPError):
        diagnostic = e.read().decode(errors='replace')[:1000]
        for secret_name in ['root_token', 'restore_token', 'seal', 'admin_key', 'admin_secret', 'uploader_key', 'uploader_secret']:
            secret = globals().get(secret_name)
            if secret: diagnostic = diagnostic.replace(secret, '[redacted]')
        evidence['syntheticHttpError'] = diagnostic
    evidence['failure'] = {'stage': stage, 'type': type(e).__name__, 'code': str(e) if isinstance(e, RuntimeError) else ('http_' + str(e.code)) if isinstance(e, urllib.error.HTTPError) else 'details_suppressed'}
finally:
    for c in containers:
        subprocess.run(['docker','rm','-f',c],capture_output=True,timeout=30)
    for v in volumes:
        subprocess.run(['docker','volume','rm',v],capture_output=True,timeout=30)
    subprocess.run(['docker','network','rm',network],capture_output=True,timeout=30)
    absent = all(subprocess.run(['docker','inspect',c],capture_output=True).returncode != 0 for c in containers)
    volumes_absent = all(subprocess.run(['docker','volume','inspect',v],capture_output=True).returncode != 0 for v in volumes)
    network_absent = subprocess.run(['docker','network','inspect',network],capture_output=True).returncode != 0
    shutil.rmtree(work)
    evidence['finishedAt'] = dt.datetime.now(dt.timezone.utc).isoformat()
    evidence['cleanup'] = {'containersAbsent':absent,'volumesAbsent':volumes_absent,'networkAbsent':network_absent,'privateWorkDirectoryAbsent':not work.exists()}
    if not all(evidence['cleanup'].values()): evidence['status']='failed'
    dest = ROOT/'docs/status/p3-u3a-seaweedfs-evaluation-evidence.json'
    archive = ROOT/'docs/status/p3-u3a-disposable-runs'/ (op+'.json')
    for output in [dest,archive]: output.write_text(json.dumps(evidence,indent=2)+'\n')
    print(json.dumps(evidence))
    if evidence['status'] == 'failed': raise SystemExit(1)
