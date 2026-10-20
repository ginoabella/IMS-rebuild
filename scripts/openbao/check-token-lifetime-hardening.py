"""Manual disposable-only real OpenBao test. Never discovers retained resources.
Run from the host: python3 scripts/openbao/check-token-lifetime-hardening.py
Only a sanitized evidence object leaves the isolated fixture.
"""
import argparse
import json
import os
import pathlib
import shutil
import signal
import subprocess
import tempfile
import uuid

PROJECT = pathlib.Path(__file__).resolve().parents[2]
IMAGE = 'quay.io/openbao/openbao:2.7.1@sha256:6d2b93856e3fcf7b18ad855a0b51eaba474dc8b79cf554379ea32034797d2acf'
NODE = 'node:22.23.3-bookworm-slim'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--candidate', choices=['original', 'array'], default='array')
parser.add_argument('--review-deadline', action='store_true', help='Also probe the experimental application deadline; separate evidence output')
options = parser.parse_args()
variant = options.candidate
proposal_name = 'p3-u3a-token-lifetime-hardening' + ('-array' if variant == 'array' else '') + '-manifest.json'
operation = str(uuid.uuid4())
network = 'myims-lifetime-' + operation[:8]
provider = network + '-provider'
helper = network + '-helper'
root = pathlib.Path(tempfile.mkdtemp(prefix='myims-lifetime-'))
evidence = {'operationId': operation, 'image': IMAGE, 'retainedAccess': False, 'candidate': variant}


def interrupted(_number, _frame):
    raise KeyboardInterrupt('Disposable validation interrupted')


signal.signal(signal.SIGTERM, interrupted)


def run(args, timeout=90):
    result = subprocess.run(args, text=True, capture_output=True, timeout=timeout)
    if result.returncode:
        # No raw Docker output, HTTP bodies, token values or provider logs.
        raise RuntimeError('Disposable command failed: ' + args[0] + ' exit ' + str(result.returncode))
    return result.stdout


try:
    (root / 'audit').mkdir(mode=0o700)
    run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', str(root / 'server.key'), '-out', str(root / 'server.crt'), '-days', '1', '-subj', '/CN=endpoint-secrets', '-addext', 'subjectAltName=DNS:endpoint-secrets'])
    for item in ['server.key', 'server.crt']:
        os.chmod(root / item, 0o600)
    (root / 'server.hcl').write_text('''ui = false
api_addr = "https://endpoint-secrets:8200"
cluster_addr = "https://endpoint-secrets:8201"
storage "raft" { path = "/bao/data" }
listener "tcp" {
 address = "0.0.0.0:8200"
 tls_cert_file = "/bao/tls/server.crt"
 tls_key_file = "/bao/tls/server.key"
 tls_min_version = "tls12"
 disable_unauthed_generate_root_endpoints = true
}
log_level = "error"
audit "file" "endpoint" {
 options {
  file_path = "/bao/audit/endpoint.json"
  log_raw = "false"
 }
}
''')
    os.chmod(root / 'server.hcl', 0o644)
    proposal = json.loads((PROJECT / 'docs/planning' / proposal_name).read_text())
    (root / 'manifest.json').write_text(json.dumps({'version': 1, 'installations': proposal['installations']}))
    os.chmod(root / 'manifest.json', 0o644)
    run(['docker', 'run', '--rm', '--network', 'none', '-v', str(root) + ':/fixture', NODE, 'node', '-e', "const fs=require('fs');for(const x of ['', '/audit','/server.key','/server.crt'])fs.chownSync('/fixture'+x,1003,1003)"])
    run(['docker', 'network', 'create', '--internal', network])
    run(['docker', 'run', '-d', '--name', provider, '--label', 'myims.disposable-lifetime=' + operation, '--user', '1003:1003', '--network', network, '--network-alias', 'endpoint-secrets', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--tmpfs', '/bao/data:uid=1003,gid=1003,mode=0700', '--tmpfs', '/tmp:uid=1003,gid=1003,mode=0700', '-v', str(root / 'server.hcl') + ':/bao/config/server.hcl:ro', '-v', str(root / 'server.crt') + ':/bao/tls/server.crt:ro', '-v', str(root / 'server.key') + ':/bao/tls/server.key:ro', '-v', str(root / 'audit') + ':/bao/audit', IMAGE, 'server', '-config=/bao/config/server.hcl'])
    args = ['docker', 'run', '-d', '--name', helper, '--label', 'myims.disposable-lifetime=' + operation, '--user', '1003:1003', '--network', network, '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true']
    if options.review_deadline:
        args += ['-e', 'MYIMS_DISPOSABLE_DEADLINE=1']
    for directory in ['private', 'output', 'custody']:
        args += ['--tmpfs', '/' + directory + ':uid=1003,gid=1003,mode=0700']
    args += ['-v', str(root / 'audit') + ':/fixture-audit:ro', '-v', str(PROJECT / 'scripts/openbao') + ':/openbao:ro', '-v', str(PROJECT / 'services/backend/dist') + ':/backend/dist:ro', '-v', str(PROJECT / 'services/backend/package.json') + ':/backend/package.json:ro', '-v', str(PROJECT / 'docs/planning' / proposal_name) + ':/proposal.json:ro', '-v', str(root / 'manifest.json') + ':/manifest.json:ro', '-v', str(root / 'server.crt') + ':/custody/ca.crt:ro', NODE, 'node', '-e', 'setInterval(()=>{},1000)']
    run(args)
    # Verify exact owned resources: one internal network, no ports/named volumes,
    # only enumerated fixture/public-source mounts. No retained directory mount.
    for container in [provider, helper]:
        info = json.loads(run(['docker', 'inspect', container]))[0]
        assert info['Config']['Labels']['myims.disposable-lifetime'] == operation
        assert not info['HostConfig']['PortBindings']
        assert list(info['NetworkSettings']['Networks']) == [network]
        assert all(m['Type'] != 'volume' for m in info['Mounts'])
        evidence.setdefault('containers', []).append(container)
    assert json.loads(run(['docker', 'network', 'inspect', network]))[0]['Internal']
    result = subprocess.run(['docker', 'exec', helper, 'node', '/openbao/token-lifetime-disposable.mjs'], capture_output=True, text=True, timeout=240)
    # Worker prints ONLY its own bounded sanitized evidence JSON.
    evidence['validation'] = json.loads(result.stdout)
    evidence['workerExit'] = result.returncode
except Exception as error:
    evidence['harnessFailure'] = type(error).__name__
finally:
    cleanup = []
    for container in [helper, provider]:
        subprocess.run(['docker', 'rm', '-f', container], capture_output=True, timeout=45)
        absent = subprocess.run(['docker', 'inspect', container], capture_output=True, timeout=15).returncode != 0
        cleanup.append({'container': container, 'absent': absent})
    subprocess.run(['docker', 'network', 'rm', network], capture_output=True, timeout=45)
    network_absent = subprocess.run(['docker', 'network', 'inspect', network], capture_output=True, timeout=15).returncode != 0
    cleaned = subprocess.run(['docker', 'run', '--rm', '--network', 'none', '-v', str(root) + ':/fixture', NODE, 'node', '-e', "const fs=require('fs');for(const p of fs.readdirSync('/fixture'))fs.rmSync('/fixture/'+p,{recursive:true,force:true});fs.chownSync('/fixture',1002,1002)"], capture_output=True, timeout=45)
    if cleaned.returncode == 0:
        shutil.rmtree(root)
    evidence['cleanup'] = {'containers': cleanup, 'network': network, 'networkAbsent': network_absent, 'temporaryDirectoryAbsent': not root.exists(), 'namedVolumesCreated': 0}
    output = PROJECT / ('docs/status/p3-u3a-disposable-' + ('deadline' if options.review_deadline else 'original-policy' if variant == 'original' else 'lifetime') + '-evidence.json')
    serialized = json.dumps(evidence, indent=2) + '\n'
    archive = PROJECT / ('docs/status/p3-u3a-disposable-runs/' + operation + '.json')
    archive.parent.mkdir(exist_ok=True)
    archive.write_text(serialized)
    output.write_text(serialized)
    print(json.dumps({'evidence': str(output.relative_to(PROJECT)), 'workerExit': evidence.get('workerExit'), 'cleanupPassed': all(x['absent'] for x in cleanup) and network_absent and not root.exists()}))
    if evidence.get('workerExit') != 0 or not all(x['absent'] for x in cleanup) or not network_absent or root.exists():
        raise SystemExit(1)
