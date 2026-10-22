import copy
import hashlib
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('reconciliation',Path(__file__).with_name('reconcile.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
OP='11111111-1111-4111-8111-111111111111'


class Tests(unittest.TestCase):
    def rows(self):
        owner={k:f'00000000-0000-4000-8000-{i:012d}' for i,k in enumerate(m.IDENTITY[:5],1)}
        owner.update(nodeId='00000000-0000-4000-8000-000000000006',ownerRevision=1,reservationState='cancelled',
            generationOrdinal=1,materialVersion=1,purposes=['outbound-request'])
        material={k:owner[k] for k in m.IDENTITY};material.update(providerVersion=1,destroyed=False,deletionTime='')
        return owner,material

    def test_exact_terminal_reference_can_match_but_never_grants_use(self):
        a,b=self.rows();result=m.reconcile([a],[b],complete=True)
        self.assertTrue(result['identityReconciliationPassed']);self.assertFalse(result['runtimeUseAllowed'])
        self.assertEqual(result['matched'],1);self.assertEqual(result['writesPerformed'],0)

    def test_missing_or_orphaned_material_is_not_accepted(self):
        a,b=self.rows()
        for owners,materials,code in [([a],[],'owner-without-material'),([],[b],'material-without-owner')]:
            result=m.reconcile(owners,materials,complete=True)
            self.assertFalse(result['identityReconciliationPassed']);self.assertIn(code,result['differences'][0]['codes'])

    def test_every_material_identity_field_is_compared_exactly(self):
        for field in m.IDENTITY:
            a,b=self.rows();b=copy.deepcopy(b)
            if field=='materialVersion':b[field]=2
            elif field=='generationOrdinal':b[field]=2
            elif field=='purposes':b[field]=['registration']
            else:b[field]='99999999-9999-4999-8999-999999999999'
            self.assertFalse(m.reconcile([a],[b],complete=True)['identityReconciliationPassed'],field)

    def test_versions_tombstones_and_destroyed_material_block_match(self):
        for key,value,code in [('providerVersion',2,'provider-version-not-one'),('destroyed',True,'material-destroyed'),('deletionTime','2026-10-22T00:00:00Z','material-deleted')]:
            a,b=self.rows();b[key]=value;r=m.reconcile([a],[b],complete=True)
            self.assertFalse(r['identityReconciliationPassed']);self.assertIn(code,r['differences'][0]['codes'])

    def test_duplicates_unknown_secret_fields_and_wrong_types_fail_without_echo(self):
        a,b=self.rows()
        for owners,materials in [([a,a],[b]),([a],[b,b]),([{**a,'password':'sensitive-sentinel'}],[b]),([a],[{**b,'secret':'sensitive-sentinel'}]),([a],[{**b,'materialVersion':True}])]:
            report=m.reconcile(owners,materials,complete=True)
            self.assertFalse(report['identityReconciliationPassed']);self.assertNotIn('sensitive-sentinel',str(report))

    def test_incomplete_inventory_cannot_turn_absence_into_success(self):
        for complete in [False,None,1]:
            self.assertFalse(m.reconcile([],[],complete=complete)['identityReconciliationPassed'])

    def test_pair_binds_both_contents_operation_and_fixture_only_scope(self):
        pg=b'fixture-postgres';bao=b'fixture-bao';checkpoint={'format':1,'fixtureOnly':True,'operationId':OP,'quiescedFixtureWrites':True,
            'postgresSha256':hashlib.sha256(pg).hexdigest(),'openbaoSha256':hashlib.sha256(bao).hexdigest()}
        self.assertEqual(m.verify_pair(checkpoint,pg,bao,OP)['status'],'fixture-pair-integrity-verified')
        for change,p,b,operation in [({},pg+b'x',bao,OP),({},pg,bao+b'x',OP),({},pg,bao,'99999999-9999-4999-8999-999999999999'),({'fixtureOnly':False},pg,bao,OP),({'quiescedFixtureWrites':False},pg,bao,OP)]:
            with self.assertRaises(ValueError):m.verify_pair({**checkpoint,**change},p,b,operation)

    def test_fixture_cleanup_refuses_foreign_or_missing_ownership_labels(self):
        spec=importlib.util.spec_from_file_location('joint_driver',Path(__file__).parents[1]/'backup-evaluation/check-joint-recovery.py')
        driver=importlib.util.module_from_spec(spec);spec.loader.exec_module(driver)
        for container in [True,False]:
            for labels,expected in [(None,False),({},False),({'myims.joint-fixture':'other'},False),({'myims.joint-fixture':OP},True)]:
                metadata={'Config':{'Labels':labels}} if container else {'Labels':labels}
                self.assertEqual(driver.owned_resource(metadata,OP,container),expected)


if __name__=='__main__':unittest.main()
