"""Fault boundaries and proof binding; no provider, Docker or retained custody."""
import importlib.util
from pathlib import Path
from datetime import datetime, timedelta, timezone
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('bootstrap', Path(__file__).with_name('bootstrap-controller.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
OP = '11111111-1111-4111-8111-111111111111'
NOW = datetime.now(timezone.utc)


def proof():
    return {'operationId': OP, 'repositoryId': 'a'*64, 'status': 'retrieval-verified', 'providerWrites': 0,
            'readOnlyVerification': True, 'snapshotId': 'b'*64, 'capturedAt': (NOW-timedelta(seconds=20)).isoformat(),
            'verifiedAt': (NOW-timedelta(seconds=1)).isoformat(), 'archives': [
                {'kind': kind, 'captureOperationId': OP, 'operationId': str(i)*8+'-1111-4111-8111-111111111111',
                 'sha256': 'c'*64, 'retrievedSha256': 'c'*64, 'bytes': 100, 'retrievedBytes': 100}
                for i, kind in enumerate(['recovery-capture', 'recovery-audit'], 2)]}


class Ports:
    operation, repository_id = OP, 'a'*64
    def __init__(self, fail=None, bad_proof=False):
        self.events, self.fail, self.bad_proof = [], fail, bad_proof
    def now(self): return NOW
    def __getattr__(self, name):
        def call(*args):
            self.events.append(name)
            if self.fail == name: raise RuntimeError('injected')
            if name == 'upload_and_verify':
                p = proof()
                if self.bad_proof: p['providerWrites'] = 1
                return p
        return call


class Tests(unittest.TestCase):
    def test_real_proof_fields_not_boolean_gate(self):
        self.assertEqual(len(m.backup_gate(proof(), OP, 'a'*64, NOW)), 64)
        for key, value in [('operationId', 'wrong'), ('repositoryId', 'b'*64), ('providerWrites', 1),
                           ('readOnlyVerification', False), ('capturedAt', (NOW-timedelta(seconds=901)).isoformat()),
                           ('verifiedAt', (NOW+timedelta(seconds=1)).isoformat())]:
            p=proof(); p[key]=value
            with self.assertRaises((ValueError, KeyError)): m.backup_gate(p, OP, 'a'*64, NOW)
        p=proof(); p['archives'][0]['retrievedSha256']='d'*64
        with self.assertRaises(ValueError): m.backup_gate(p, OP, 'a'*64, NOW)
    def test_success_order_backup_before_install_and_root_before_restoration(self):
        p=Ports(); m.bootstrap_flow(p)
        self.assertLess(p.events.index('upload_and_verify'),p.events.index('install'))
        self.assertLess(p.events.index('finish'),p.events.index('restore'))
        self.assertLess(p.events.index('close_helpers'),p.events.index('capture_post_install'))
    def test_no_failed_backup_or_preflight_reaches_writes(self):
        for fail in ['recover','review_prestate','capture','archive_baseline','archive_prechange_audit','upload_and_verify','record_backup_gate','assert_guard']:
            p=Ports(fail)
            with self.assertRaises(RuntimeError): m.bootstrap_flow(p)
            self.assertNotIn('install',p.events)
            self.assertIn('finish',p.events)
            self.assertIn('restore',p.events)
            self.assertNotIn('capture_post_install',p.events)
        p=Ports(bad_proof=True)
        with self.assertRaises(RuntimeError): m.bootstrap_flow(p)
        self.assertNotIn('install',p.events)
    def test_partial_write_and_lost_acceptance_finish_and_restore_without_retry(self):
        for fail in ['install','accept']:
            p=Ports(fail)
            with self.assertRaises(RuntimeError): m.bootstrap_flow(p)
            self.assertEqual(p.events.count('install'),1)
            self.assertEqual(p.events.count('recover'),1)
            self.assertIn('cancel_guard',p.events)
            self.assertIn('archive_post_cleanup_audit',p.events)
    def test_unknown_cleanup_or_restore_keeps_guard_and_contains(self):
        for fail in ['isolate','unseal','finish','restore','cancel_guard']:
            p=Ports(fail)
            with self.assertRaises(RuntimeError): m.bootstrap_flow(p)
            self.assertIn('contain_failure',p.events)
            self.assertNotIn('capture_post_install',p.events)
            if fail in ['isolate','unseal','finish','restore']: self.assertNotIn('cancel_guard',p.events)
    def test_closed_prior_operation_label_is_explicitly_reconciled(self):
        from copy import deepcopy
        expected={'name':'fixture','imageId':'image','network':'normal','mounts':[]}
        previous={'operationId':OP,'rootRevocationVerified':True,'normalRestorationVerified':True,'deadlineCancelled':True}
        current={'Name':'/fixture','Image':'image','State':{'Running':True},
            'Config':{'Labels':{'myims.openbao.recovery.operation':OP}},
            'HostConfig':{'RestartPolicy':{'Name':'unless-stopped'},'PortBindings':{},'ReadonlyRootfs':True,
                'Privileged':False,'CapDrop':['ALL'],'SecurityOpt':['no-new-privileges:true']},
            'NetworkSettings':{'Networks':{'normal':{}}},'Mounts':[]}
        m.validate_closed_provider(current,expected,previous)
        for key,value in [('Image','other'),('Mounts',[{}])]:
            c=deepcopy(current);c[key]=value
            with self.assertRaises(ValueError):m.validate_closed_provider(c,expected,previous)
        p=deepcopy(previous);p['rootRevocationVerified']=False
        with self.assertRaises(ValueError):m.validate_closed_provider(current,expected,p)

    def test_exclusive_journal_replay_refused_and_no_private_payload_api(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/OP
            j=m.Journal(p,OP); j.append('write-started',0)
            with self.assertRaises(FileExistsError): m.Journal(p,OP)
            with self.assertRaises(ValueError): j.append('private body: token')
            self.assertEqual(len((p/'events.jsonl').read_text().splitlines()),2)


if __name__ == '__main__': unittest.main()
