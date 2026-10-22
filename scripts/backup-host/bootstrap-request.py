"""Offline operation packaging. No provider, Docker or private custody access."""
from pathlib import Path
import hashlib
import json
import uuid

ROOT = Path(__file__).resolve().parents[2]

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build_request(operation):
    if str(uuid.UUID(operation)) != operation:
        raise ValueError('operation')
    read = lambda p: json.loads((ROOT / p).read_text())
    preparation = read('docs/planning/p3-u3a-guarded-bootstrap-preparation.json')
    maintenance = read('docs/planning/p3-u3a-backup-maintenance-review.json')
    baseline = read('docs/planning/p3-u3a-bootstrap-policy-baseline.json')
    old = read('infra/backup/recovery-capture-request.json')
    stage = '/srv/myims-openbao-recovery-development/' + operation
    spool = '/srv/myims-backup-development/bootstrap/' + operation
    directories = {k:stage+'/'+v for k,v in {
        'capture':'capture','baseline':'encrypted/baseline','preAudit':'encrypted/pre-audit',
        'postAudit':'encrypted/post-audit','postSnapshot':'post-snapshot','postEncrypted':'encrypted/post-install',
        'snapshotCredentials':'snapshot-credentials','maintenance':'maintenance','installState':'install-state',
        'snapshotState':'snapshot-state'}.items()}
    directories.update({'prechangeSpool':spool+'/prechange','postinstallSpool':spool+'/postinstall','receipts':spool+'/receipts'})
    candidate = {**preparation, 'operationId':operation,'roles':maintenance['completeRoleConfigurationsToVerify'],
        'policyBaseline':baseline['policyBaseline']}
    artifacts = ['infra/openbao/server.hcl','infra/docker/compose.yaml','infra/docker/compose.credentials.yaml',
        'infra/docker/compose.openbao-recovery.yaml','infra/docker/compose.openbao-restoration.yaml',
        'infra/backup/compose.recovery-capture.yaml',
        'docs/planning/p3-u3a-guarded-bootstrap-preparation.json','docs/planning/p3-u3a-bootstrap-policy-baseline.json']
    # Source imports are explicit and pinned, including old capture primitives.
    artifacts += [str(p.relative_to(ROOT)) for directory in ['scripts/backup','scripts/openbao']
                  for p in sorted((ROOT/directory).glob('*.mjs')) if not p.name.endswith('.test.mjs')]
    artifacts += ['scripts/backup-host/'+p for p in ['bootstrap-controller.py','bootstrap-host-ports.py',
                  'guard-bridge.py','execute-bootstrap.py','bootstrap-staging.py','bootstrap-request.py',
                  'execute-development-capture.py']]
    package = {'version':1,'status':'review-only-unapproved-retained-bootstrap', 'operationId':operation,
        'retainedExecutionAuthorized':False,'rootRecoveryAuthorized':False,'repositoryInitializationAuthorized':False,
        'timerActivationAuthorized':False,'productionAuthorized':False,'destructiveCleanupAuthorized':False,
        'ownerApproval':{'approved':False,'consumed':False,'executionStarted':False},
        'maximumIsolationSeconds':840,'preChangeBackupMaximumAgeSeconds':900,'automaticRetries':0,
        'repositoryId':'8f2337728f88192a57301f5ee51e405a6625955054c15079675fbdf907b8da6b',
        'candidateToolsImage':{'imageId':'sha256:3abcd3135ba8a4b7c924792f4ecf760ba6b2020f193338cbba91191eae8d67d1'},
        'previousOperationEvidence':'docs/status/p3-u3a-development-capture-execution.json',
        'previousOperationEvidenceSha256':digest(ROOT/'docs/status/p3-u3a-development-capture-execution.json'),
        'currentProviderDockerMetadata':old['currentProviderDockerMetadata'],
        'recoveryConfigurationSha256':hashlib.sha256((ROOT/'infra/openbao/server.hcl').read_text().replace(
            'disable_unauthed_generate_root_endpoints = true','disable_unauthed_generate_root_endpoints = false').encode()).hexdigest(),
        'candidate':candidate,'directories':directories,'stagingPrepared':False,
        'artifacts':{name:digest(ROOT/name) for name in artifacts},
        'hostWork':str(ROOT/'.local/bootstrap-operations'/operation),
        'statusOutput':str(ROOT/'docs/status'/('p3-u3a-bootstrap-execution-'+operation+'.json')),
        'credentialHandoff':{'maintenancePasswordSource':directories['maintenance']+'/password',
            'operatorTarget':'/home/gino/.openbao-backup-maintainer/password',
            'operatorUid':1002,'operatorGid':1002,'targetMode':'0600','parentMode':'0700',
            'installationChangesCustodianPassword':False},
        'activationRequires':['independent-fresh-decryption','isolated-joint-postgresql-recovery','measured-rpo-rto',
            'confirmed-alerts-capacity-and-rotation-custody'],
        'limitations':['no-current-authority-inferred-from-historical-baseline','no-recovery-or-write-without-exact-execution-approval']}
    package['reviewPackageSha256']=hashlib.sha256(json.dumps({k:v for k,v in package.items() if k!='ownerApproval'},sort_keys=True,separators=(',',':')).encode()).hexdigest()
    return package


if __name__ == '__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation')
    print(json.dumps(build_request(parser.parse_args().operation),indent=2))
