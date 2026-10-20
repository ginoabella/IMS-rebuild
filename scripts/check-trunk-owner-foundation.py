"""Real PostgreSQL-only owner foundation acceptance. No shared DB or provider access.

Host: python3 scripts/check-trunk-owner-foundation.py
All database writes and roles exist only in one fresh network-none tmpfs container.
"""
import json
import pathlib
import re
import subprocess
import time
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
IMAGE = 'postgis/postgis:17-3.5@sha256:01a6a70e41e6c4467c8f55f6063555ed72db2d6662cd0d571040d42eadaeb6f6'
operation = str(uuid.uuid4())
container = 'myims-trunk-owner-' + operation[:8]
evidence = {'operationId': operation, 'image': IMAGE, 'sharedDatabaseAccess': False, 'providerAccess': False, 'checks': []}
stage = 'start'


def run(args, sql=None, timeout=60):
    result = subprocess.run(args, input=sql, text=True, capture_output=True, timeout=timeout)
    if result.returncode:
        # SQL contains synthetic identities only; report a bounded SQLSTATE rather
        # than connection settings or raw SQL/provider/application output.
        state = re.search(r'ERROR:\s+([0-9A-Z]{5})\b', result.stderr)
        raise RuntimeError(state.group(1) if state else 'command_failed')
    return result.stdout


def query(sql):
    return run(['docker', 'exec', '-i', container, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate', '-U', 'postgres', '-d', 'postgres'], sql)


def rejects(sql, expected):
    result = subprocess.run(['docker', 'exec', '-i', container, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate', '-U', 'postgres', '-d', 'postgres'], input=sql, text=True, capture_output=True, timeout=60)
    if result.returncode == 0 or expected not in result.stderr:
        raise RuntimeError('expected_sql_denial_missing')


try:
    run(['docker', 'run', '-d', '--name', container, '--label', 'myims.trunk-owner-fixture=' + operation,
         '--network', 'none', '--read-only', '--tmpfs', '/var/lib/postgresql/data:mode=0700',
         '--tmpfs', '/var/run/postgresql', '--tmpfs', '/tmp',
         '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', IMAGE])
    info = json.loads(run(['docker', 'inspect', container]))[0]
    assert info['Config']['Labels']['myims.trunk-owner-fixture'] == operation
    assert info['HostConfig']['NetworkMode'] == 'none'
    assert not info['HostConfig']['PortBindings']
    assert all(m['Type'] == 'tmpfs' for m in info['Mounts'])
    stage = 'ready'
    for _ in range(100):
        # Entrypoint initialization briefly serves a socket-only temporary server.
        # TCP readiness selects the final server, after PostGIS initialization.
        ready = subprocess.run(['docker', 'exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], capture_output=True)
        if ready.returncode == 0:
            break
        time.sleep(0.2)
    else:
        raise RuntimeError('database_unavailable')
    stage = 'migrations'
    # Prisma owns this table in normal deploy; minimal fixture satisfies only the
    # foundation migration's SELECT grant while applying all actual SQL sources.
    query('CREATE TABLE public._prisma_migrations(id text PRIMARY KEY);')
    sources = sorted((ROOT / 'infra/database/migrations').glob('*/migration.sql'))
    for source in sources:
        stage = 'migration_' + source.parent.name
        query(source.read_text())
    evidence['checks'].append({'name': 'all_repository_migration_sources', 'passed': True, 'count': len(sources)})
    stage = 'owner_sql_acceptance'
    query((ROOT / 'scripts/trunk-owner-foundation-fixture.sql').read_text())
    evidence['checks'].append({'name': 'runtime_owner_grants_exact_scope_immutable_provenance_ordinal_and_audit_rollback', 'passed': True})
    stage = 'existing_role_membership_gate'
    foundation = (ROOT / 'infra/database/migrations/20261020000000_trunk_credential_owner_foundation/migration.sql').read_text()
    # A NOLOGIN/NOINHERIT role is still assumable through membership. Demonstrate
    # that hazard, then prove the deployment gate rejects every membership edge.
    query('GRANT myims_trunk_owner TO myims_runtime;')
    query('SET SESSION AUTHORIZATION myims_runtime; SET ROLE myims_trunk_owner; RESET ROLE; RESET SESSION AUTHORIZATION;')
    rejects(foundation, '42501')
    query('REVOKE myims_trunk_owner FROM myims_runtime; GRANT myims_runtime TO myims_trunk_owner;')
    rejects(foundation, '42501')
    query('REVOKE myims_runtime FROM myims_trunk_owner; CREATE ROLE fixture_unexpected_member NOLOGIN; GRANT myims_trunk_owner TO fixture_unexpected_member;')
    rejects(foundation, '42501')
    query('REVOKE myims_trunk_owner FROM fixture_unexpected_member; ALTER ROLE myims_trunk_owner LOGIN;')
    rejects(foundation, '42501')
    query('ALTER ROLE myims_trunk_owner NOLOGIN;')
    evidence['checks'].append({'name': 'existing_role_flags_and_all_membership_edges_rejected', 'passed': True})
    evidence['status'] = 'passed'
except Exception as error:
    evidence['status'] = 'failed'
    evidence['failure'] = {'stage': stage, 'code': str(error) if isinstance(error, RuntimeError) else type(error).__name__}
finally:
    subprocess.run(['docker', 'rm', '-f', container], capture_output=True, timeout=30)
    absent = subprocess.run(['docker', 'inspect', container], capture_output=True, timeout=15).returncode != 0
    evidence['cleanup'] = {'exactContainerAbsent': absent, 'namedVolumesCreated': 0, 'hostPortsPublished': 0, 'retainedMounts': 0}
    evidence['status'] = evidence.get('status', 'failed') if absent else 'failed'
    output = ROOT / 'docs/status/p3-u3a-trunk-owner-foundation-evidence.json'
    archive = ROOT / ('docs/status/p3-u3a-disposable-runs/' + operation + '.json')
    archive.parent.mkdir(exist_ok=True)
    archive.write_text(json.dumps(evidence, indent=2) + '\n')
    output.write_text(json.dumps(evidence, indent=2) + '\n')
    print(json.dumps(evidence))
    if evidence['status'] != 'passed':
        raise SystemExit(1)
