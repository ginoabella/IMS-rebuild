// Actual passive preflight, including rejected expectations and filesystem preservation.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { expectations } from './pbx-profile-inspect.mjs';
const expected = expectations(
  JSON.parse(readFileSync(process.argv[2], 'utf8')),
);
const source = readFileSync(
  new URL('./pbx-profile-inspect.mjs', import.meta.url),
  'utf8',
);
const result = spawnSync(
  'docker',
  [
    'exec',
    '-i',
    '--user',
    '0',
    'myims-rebuild-dev-asterisk-1',
    'node',
    '--input-type=module',
    '-',
    '--passive-check',
    JSON.stringify(expected),
  ],
  {
    input:
      source +
      `
{
  const fs = await import('node:fs');
  const assert = (await import('node:assert/strict')).default;
  const expected = expectations(JSON.parse(process.argv[3]));
  const paths = ['/etc/asterisk','/var/lib/myims-pbx/control/'+expected.nodeId,'/var/lib/myims-pbx/managed'];
  function snapshot(path, result=[]) {
    const s=fs.lstatSync(path);
    result.push([path,s.uid,s.gid,s.mode,s.nlink,s.mtimeMs,s.isSymbolicLink()?fs.readlinkSync(path):s.isFile()?createHash('sha256').update(fs.readFileSync(path)).digest('hex'):null]);
    if(s.isDirectory())for(const name of fs.readdirSync(path).sort())snapshot(path+'/'+name,result);
    return result;
  }
  const before=paths.map(p=>snapshot(p));
  const target={nodeId:expected.nodeId,installationId:expected.installationId};
  const correct=await inspectProfile(expected,target);
  assert.deepEqual(correct.blockers,[]);
  const wrong=await inspectProfile(expected,{...target,nodeId:'00000000-0000-4000-8000-000000000001'});
  assert.deepEqual(wrong.blockers,['wrong_target']);
  for(const change of [{nodeVersion:expected.nodeVersion+1},{compilerVersion:'unsupported-1'},{policyVersion:'unsupported-1'},{unmanagedDigest:'0'.repeat(64)},{artifactId:'00000000-0000-4000-8000-000000000002'},{initialBaselineId:'00000000-0000-4000-8000-000000000003'}]) {
    const report=await inspectProfile({...expected,...change},target);
    assert.ok(report.blockers.includes('expected_profile_mismatch'));
  }
  assert.deepEqual(paths.map(p=>snapshot(p)),before);
  console.log(JSON.stringify({check:'actual-passive-profile-preflight',passed:true,rejectedExpectations:7,protectedBytesModesOwnershipAndMtimePreserved:true,callsPlaced:0}));
}
`,
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 1048576,
  },
);
if (result.status !== 0)
  throw new Error('Actual passive preflight regression failed');
process.stdout.write(result.stdout);
