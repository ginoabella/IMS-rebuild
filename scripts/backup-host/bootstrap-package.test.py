import importlib.util
from pathlib import Path
from unittest.mock import patch
import unittest

def load(name):
 p=Path(__file__).with_name(name+'.py');s=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
builder=load('bootstrap-request');launcher=load('execute-bootstrap');staging=load('bootstrap-staging')
OP='99999999-9999-4999-8999-999999999999'
class Tests(unittest.TestCase):
 def test_public_package_exactly_regenerates_and_cannot_execute(self):
  r=builder.build_request(OP);launcher.validate_request(r)
  with patch.object(launcher.subprocess,'run',side_effect=AssertionError('Docker before approval')):
   with self.assertRaises(ValueError):launcher.preflight(r)
 def test_changed_paths_and_source_hashes_refuse_before_custody(self):
  for key in ['directories','candidate','artifacts']:
   r=builder.build_request(OP);r[key]={'unexpected':True}
   with self.assertRaises(ValueError):launcher.validate_request(r)
 def test_root_staging_refuses_noncanonical_path_before_mkdir(self):
  r=builder.build_request(OP);r['directories']['maintenance']='/tmp/unreviewed-target'
  with patch.object(staging.os,'geteuid',return_value=0),patch.object(staging.Path,'mkdir',side_effect=AssertionError('unreviewed path')):
   with self.assertRaises(ValueError):staging.prepare(r)
 def test_only_exact_private_backup_service_ancestor_is_allowed(self):
  import stat
  from types import SimpleNamespace
  path=Path('/srv/myims-backup-development')
  good=SimpleNamespace(st_uid=12010,st_gid=12010,st_mode=stat.S_IFDIR|0o700)
  with patch.object(staging.Path,'lstat',return_value=good):
   staging.validate_parent(path)
   for other in [Path('/srv'),path/'bootstrap',Path('/srv/other-backup')]:
    with self.assertRaises(ValueError):staging.validate_parent(other)
  for uid,gid,mode in [(0,0,stat.S_IFDIR|0o700),(12010,0,stat.S_IFDIR|0o700),(12010,12010,stat.S_IFDIR|0o750),(12010,12010,stat.S_IFLNK|0o700)]:
   with patch.object(staging.Path,'lstat',return_value=SimpleNamespace(st_uid=uid,st_gid=gid,st_mode=mode)):
    with self.assertRaises(ValueError):staging.validate_parent(path)
 def test_all_ancestors_checked_before_creating_missing_parents(self):
  r=builder.build_request(OP)
  def validate(path):
   if path==Path('/srv/myims-backup-development'):raise ValueError('unsafe_backup_service_parent')
  with patch.object(staging.os,'geteuid',return_value=0),patch.object(staging.os.path,'lexists',return_value=False),patch.object(staging,'validate_parent',side_effect=validate),patch.object(staging.Path,'mkdir',side_effect=AssertionError('mkdir before parent validation')):
   with self.assertRaisesRegex(ValueError,'unsafe_backup_service_parent'):staging.prepare(r)
 def test_new_status_record_is_operation_bound_before_any_provider_call(self):
  import tempfile,json
  with tempfile.TemporaryDirectory() as d:
   r=builder.build_request(OP);r['statusOutput']=str(Path(d)/'status.json');r['hostWork']=str(Path(d)/'work')
   p=Path(d)/'request.json';p.write_text(json.dumps(r))
   with patch.object(launcher.subprocess,'run',side_effect=AssertionError('unexpected Docker')):
    c=launcher.controller_for(r,p)
   self.assertEqual(c.record['operationId'],OP)
   self.assertFalse(Path(r['hostWork']).exists())

 def test_rendered_host_plan_has_separate_credential_mounts_and_no_initializer(self):
  import tempfile,json,os
  from types import SimpleNamespace
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'.local').mkdir(mode=0o700);(root/'infra/openbao').mkdir(parents=True)
   normal='disable_unauthed_generate_root_endpoints = true\n'
   (root/'infra/openbao/server.hcl').write_text(normal)
   request=builder.build_request(OP)
   import hashlib
   request['recoveryConfigurationSha256']=hashlib.sha256(normal.replace(' = true',' = false').encode()).hexdigest()
   calls=[]
   rendered={'services':{'capture-helper':{'volumes':[],'profiles':['manual-capture']},'restoration-helper':{'volumes':[],'profiles':['manual-restoration']}}}
   def run(args):calls.append(args);return SimpleNamespace(stdout=json.dumps(rendered).encode())
   c=SimpleNamespace(work=root/'.local/bootstrap-operations'/OP,op=OP,run=run,save=lambda *a,**kw:None)
   with patch.object(launcher,'ROOT',root):launcher.prepare_host(c,request)
   plan=json.loads((c.work/'capture.json').read_text())
   targets=[v['target'] for v in plan['services']['capture-helper']['volumes']]
   self.assertTrue(all(x in targets for x in ['/snapshot-credentials','/maintenance-output','/install-state']))
   self.assertEqual(len(calls),1);self.assertIn('config',calls[0]);self.assertNotIn('init',calls[0])
   self.assertTrue((c.work/'execution-started.json').exists())
   with patch.object(launcher,'ROOT',root):
    with self.assertRaises(FileExistsError):launcher.prepare_host(c,request)

if __name__=='__main__':unittest.main()
