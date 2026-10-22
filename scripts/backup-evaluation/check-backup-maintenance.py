#!/usr/bin/env python3
"""Disposable native ACL/rotation check. No retained mounts, keys or service access."""
import hashlib
import json
import pathlib
import secrets
import subprocess
import time
import urllib.error
import urllib.request
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
IMAGE = 'quay.io/openbao/openbao:2.7.1@sha256:6d2b93856e3fcf7b18ad855a0b51eaba474dc8b79cf554379ea32034797d2acf'
operation = str(uuid.uuid4())
name = 'myims-backup-rotation-eval-' + operation[:8]
network = name + '-network'
root_token = secrets.token_hex(32)
password = secrets.token_hex(32)
checks = []
evidence = {'operationId': operation, 'image': IMAGE, 'retainedAccess': False,
            'scope': 'Disposable HTTP dev-mode native ACL/AppRole/userpass rotation only; no TLS/Raft/recovery or retained lifetime acceptance',
            'checks': checks}
plan_bytes = (ROOT / 'docs/planning/p3-u3a-backup-maintenance-review.json').read_bytes()
evidence['planSha256'] = hashlib.sha256(plan_bytes).hexdigest()
evidence['harnessSha256'] = hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()
plan = json.loads(plan_bytes)
rotation = plan['rotation']

def docker(*args, check=True):
    result = subprocess.run(['docker', *args], capture_output=True, timeout=60)
    if check and result.returncode:
        raise RuntimeError('fixture_docker_command_failed')
    return result

def api(path, data=None, token=None, method=None):
    evidence['lastRequestPath'] = path
    request = urllib.request.Request(address + '/v1/' + path,
        data=None if data is None else json.dumps(data).encode(),
        headers={'Content-Type': 'application/json', **({'X-Vault-Token': token} if token else {})}, method=method)
    with urllib.request.urlopen(request, timeout=10) as response:
        value = response.read()
        return json.loads(value) if value else {}

def denied(path, data, token):
    try:
        api(path, data, token)
    except urllib.error.HTTPError as error:
        if error.code == 403:
            return
    raise RuntimeError('expected_native_403_missing')

def record(label, success=True):
    if not success:
        raise RuntimeError(label)
    checks.append({'name': label, 'passed': True})

try:
    docker('network', 'create', '--internal', '--label', 'myims.backup-rotation-eval=' + operation, network)
    docker('run', '-d', '--name', name, '--network', network, '--label',
           'myims.backup-rotation-eval=' + operation, '--cap-drop', 'ALL',
           '--security-opt', 'no-new-privileges:true', '-e', 'BAO_DEV_ROOT_TOKEN_ID=' + root_token,
           IMAGE, 'server', '-dev', '-dev-listen-address=0.0.0.0:8200')
    info = json.loads(docker('inspect', name).stdout)[0]
    address = 'http://' + info['NetworkSettings']['Networks'][network]['IPAddress'] + ':8200'
    for _ in range(100):
        try:
            api('sys/health')
            break
        except Exception:
            time.sleep(.1)
    else:
        raise RuntimeError('fixture_not_ready')
    proposal = json.loads((ROOT / 'docs/planning/p3-u3a-backup-installation-review-manifest.json').read_text())
    for write in proposal['backupProvisioning'][:3]:
        api(write['path'], write['body'], root_token)
    # Verify all exact issuance replacements using independent scoped fixture issuers.
    for role in plan['completeRoleConfigurationsToVerify']:
        api('auth/token/roles/' + role['name'], role['configuration'], root_token)
    for change in plan['privilegedPolicyRemediation']:
        api(change['path'], change['body'], root_token)
        policy_name = change['path'].rsplit('/', 1)[1]
        issuer = api('auth/token/create', {'policies': [policy_name],
            'no_default_policy': True, 'ttl': '60s', 'explicit_max_ttl': '60s'}, root_token)['auth']['client_token']
        roles = [r for r in plan['completeRoleConfigurationsToVerify']
                 if ('platform-' in r['name'] if policy_name == 'platform-deployment-maintainer'
                     else r['name'].startswith(policy_name.split('-')[0] + '-'))]
        for role in roles:
            path = 'auth/token/create/' + role['name']
            issued = api(path, role['request'], issuer)['auth']
            child = issued['client_token']
            record_max = role['configuration']['token_explicit_max_ttl']
            if not (0 < issued['lease_duration'] <= record_max and
                    issued['policies'] == role['request']['policies']):
                raise RuntimeError('native_issuance_contract_mismatch')
            for forbidden in [{**role['request'], 'ttl': '48h'},
                              {**role['request'], 'explicit_max_ttl': '48h'},
                              {**role['request'], 'no_parent': True},
                              {**role['request'], 'policies': ['root']},
                              {k: v for k, v in role['request'].items() if k != 'explicit_max_ttl'}]:
                denied(path, forbidden, issuer)
            api('auth/token/revoke', {'token': child}, root_token)
            denied('auth/token/lookup-self', None, child)
        api('auth/token/revoke-self', {}, issuer)
        denied('auth/token/lookup-self', None, issuer)
        record('exact_issuance_and_forbidden_parameters_' + policy_name, len(roles) in (2, 6))
    api('sys/auth/platform-custodian', {'type': 'userpass'}, root_token)
    api('sys/policies/acl/' + rotation['policyName'], {'policy': rotation['policy']}, root_token)
    api('auth/platform-custodian/users/' + rotation['username'],
        {**rotation['userConfiguration'], 'password': password}, root_token)
    session = api('auth/platform-custodian/login/' + rotation['username'], {'password': password})['auth']
    human = session['client_token']
    record('separate_human_policy_and_900_second_maximum', session['policies'] == [rotation['policyName']] and
           0 < session['lease_duration'] <= 900 and session['renewable'])
    role_id = api(rotation['roleIdPath'], token=human)['data']['role_id']
    first = api(rotation['issuancePath'], rotation['issuanceRequest'], human)['data']
    lookup = api(rotation['lookupPath'], {'secret_id_accessor': first['secret_id_accessor']}, human)['data']
    record('fixed_secret_id_lifetime_and_use_budget', lookup['secret_id_ttl'] == 2592000 and lookup['secret_id_num_uses'] == 1000)
    for request in [{}, {'ttl': '720h'}, {'ttl': '721h', 'num_uses': 1000},
                    {'ttl': '720h', 'num_uses': 1001}, {'ttl': '720h', 'num_uses': 0},
                    {**rotation['issuanceRequest'], 'metadata': {'extra': 'forbidden'}},
                    {**rotation['issuanceRequest'], 'cidr_list': ['127.0.0.1/32']}]:
        denied(rotation['issuancePath'], request, human)
    record('missing_parameters_and_issuance_overrides_denied')
    for path, data in [('sys/policies/acl/platform-backup-rotation', {'policy': ''}),
                       ('sys/auth/unapproved-backup', {'type': 'approle'}),
                       ('auth/token/create', {}),
                       ('auth/token/create/platform-trunk-issuer', {}),
                       ('auth/platform-backup/role/platform-raft-snapshot-reader', {'token_policies': ['root']}),
                       ('auth/platform-backup/role/other/secret-id', {}),
                       ('sys/storage/raft/snapshot', None),
                       ('myims-trunk/data/installations/test', None),
                       ('sys/raw/test', None),
                       ('sys/storage/raft/snapshot', {})]:
        denied(path, data, human)
    record('rotation_cannot_install_edit_roles_issue_tokens_read_secrets_or_snapshot_restore')
    for path in [rotation['lookupPath'], rotation['retirementPath']]:
        denied(path, {}, human)
        denied(path, {'secret_id_accessor': first['secret_id_accessor'], 'extra': True}, human)
    record('accessor_requests_require_only_exact_accessor_parameter')
    def login(secret_id):
        return api('auth/platform-backup/login', {'role_id': role_id, 'secret_id': secret_id})['auth']
    workload = login(first['secret_id'])
    record('workload_has_only_snapshot_policy_and_300_second_maximum',
           workload['policies'] == ['platform-raft-snapshot-reader'] and 0 < workload['lease_duration'] <= 300)
    for path, data in [(rotation['issuancePath'], rotation['issuanceRequest']),
                       ('sys/policies/acl/platform-backup-rotation', None),
                       ('myims-trunk/data/installations/test', None)]:
        denied(path, data, workload['client_token'])
    api('auth/token/revoke-self', {}, workload['client_token'])
    denied('auth/token/lookup-self', None, workload['client_token'])
    second = api(rotation['issuancePath'], rotation['issuanceRequest'], human)['data']
    replacement = login(second['secret_id'])
    api('auth/token/revoke-self', {}, replacement['client_token'])
    denied('auth/token/lookup-self', None, replacement['client_token'])
    api(rotation['retirementPath'], {'secret_id_accessor': first['secret_id_accessor']}, human)
    try:
        login(first['secret_id'])
        raise RuntimeError('retired_secret_still_usable')
    except urllib.error.HTTPError as error:
        if error.code not in (400, 403):
            raise RuntimeError('unexpected_retired_login_response')
    record('replacement_verified_before_old_accessor_retirement_and_old_login_denied')
    api('auth/token/revoke-self', {}, human)
    denied('auth/token/lookup-self', None, human)
    record('human_and_workload_self_revocation_confirmed_403')
    record('no_host_publication_or_retained_mounts', not info['HostConfig']['PortBindings'] and
           all(m['Type'] != 'bind' for m in info['Mounts']))
    evidence['status'] = 'passed'
except Exception as error:
    evidence['status'] = 'failed'
    evidence['failure'] = {'type': type(error).__name__,
        'code': str(error) if isinstance(error, RuntimeError) else 'details_suppressed',
        'httpStatus': error.code if isinstance(error, urllib.error.HTTPError) else None}
finally:
    docker('rm', '-fv', name, check=False)
    docker('network', 'rm', network, check=False)
    evidence['cleanup'] = {
        'containerAbsent': docker('inspect', name, check=False).returncode != 0,
        'networkAbsent': docker('network', 'inspect', network, check=False).returncode != 0}
    if not all(evidence['cleanup'].values()):
        evidence['status'] = 'failed'
    (ROOT / 'docs/status/p3-u3a-backup-maintenance-evidence.json').write_text(json.dumps(evidence, indent=2) + '\n')
    print(json.dumps(evidence))
    if evidence['status'] != 'passed':
        raise SystemExit(1)
