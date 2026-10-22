import importlib.util
from pathlib import Path
import sys
import unittest
spec=importlib.util.spec_from_file_location('bridge',Path(__file__).with_name('guard-bridge.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
OP='11111111-1111-4111-8111-111111111111'
CHILD="""import json,sys
op=sys.argv[1]
for i in range(10):
 print(json.dumps({'event':'gate-request','operationId':op,'sequence':i}),flush=True)
 ack=json.loads(sys.stdin.readline())
 if ack.get('allow') is not True:sys.exit(1)
print(json.dumps({'status':'nine-writes-acknowledged','operationId':op}),flush=True)
"""
class Tests(unittest.TestCase):
 def test_ten_live_host_checks_and_exact_result(self):
  checks=[]
  result=m.guarded_command([sys.executable,'-c',CHILD,OP],OP,lambda:checks.append(True),timeout=3)
  self.assertEqual(result['guardChecks'],10);self.assertEqual(len(checks),10)
 def test_refused_guard_never_acknowledges_next_write(self):
  count=[]
  def check():
   count.append(True)
   if len(count)==3:raise RuntimeError('dead-guard')
  with self.assertRaises(RuntimeError):m.guarded_command([sys.executable,'-c',CHILD,OP],OP,check,timeout=3)
  self.assertEqual(len(count),3)
 def test_wrong_operation_and_unexpected_output_fail_without_guard_check(self):
  for child in [CHILD.replace("'operationId':op","'operationId':'other'"),"print('{\"private\":\"discard\"}')"]:
   with self.assertRaises(RuntimeError):m.guarded_command([sys.executable,'-c',child,OP],OP,lambda:self.fail('unexpected check'),timeout=3)
if __name__=='__main__':unittest.main()
