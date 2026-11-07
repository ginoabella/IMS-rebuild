// Explicit helper-only deployment. The supervisor retains the live Asterisk PID.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { expectations } from './pbx-profile-inspect.mjs';
const expected = expectations(
  JSON.parse(readFileSync(process.argv[2], 'utf8')),
);
if (process.argv.length !== 3)
  throw new Error('Exact refresh expectations required');
function native(code, argument) {
  const r = spawnSync(
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
      '--refresh',
      JSON.stringify(argument),
    ],
    { input: code, encoding: 'utf8', timeout: 60000, maxBuffer: 1048576 },
  );
  if (r.status !== 0)
    throw new Error(
      'Executor refresh unavailable; inspect exact target before further effects',
    );
  return JSON.parse(r.stdout);
}
const source = readFileSync(
  new URL('./pbx-profile-inspect.mjs', import.meta.url),
  'utf8',
);
const before = native(
  source +
    `
{
  const expected = expectations(JSON.parse(process.argv[3]));
  const report = await inspectProfile(expected, expected);
  if (report.blockers.some(b => b !== 'native_profile_executor_unavailable')) throw Error('Refresh preflight blocked');
  const fs = await import('node:fs');
  const root = '/var/lib/myims-pbx/control/' + expected.nodeId;
  const lock = fs.statSync(root + '/boundary.lock');
  const candidates = fs.readdirSync('/proc').filter(n => /^[1-9][0-9]*$/.test(n)).filter(n => {
    try {
      const cmd = fs.readFileSync('/proc/' + n + '/cmdline','utf8').split('\\0');
      const fd = fs.statSync('/proc/' + n + '/fd/3');
      return cmd[1] === '/workspace/services/backend/dist/entrypoints/telephony/native-main.js' && fd.ino === lock.ino && fd.dev === lock.dev && fs.statSync('/proc/' + n).uid === 0;
    } catch { return false; }
  });
  if (candidates.length !== 1) throw Error('Exact executor unavailable');
  const pbx = Number(fs.readFileSync('/var/run/asterisk/asterisk.pid','utf8'));
  const pbxStat = fs.readFileSync('/proc/' + pbx + '/stat','utf8');
  const pbxUid=fs.readFileSync('/etc/passwd','utf8').split('\\n').find(l=>l.startsWith('asterisk:')).split(':')[2];
  const status=fs.readFileSync('/proc/'+pbx+'/status','utf8').split('\\n');
  const ids=status.find(l=>l.startsWith('Uid:')).trim().split(/\\s+/).slice(1);
  if(status.find(l=>l.startsWith('Name:')).trim().split(/\\s+/)[1]!=='asterisk'||ids.length!==4||ids.some(id=>id!==pbxUid))throw Error('PBX unavailable');
  process.kill(Number(candidates[0]), 'SIGTERM');
  console.log(JSON.stringify({ previousExecutorPid: Number(candidates[0]), pbx, pbxStat }));
}
`,
  expected,
);
const deadline = Date.now() + 45000;
while (Date.now() < deadline) {
  try {
    const result = native(
      `
      const fs = await import('node:fs');
      const v=JSON.parse(process.argv[3]);
      const p=JSON.parse(fs.readFileSync('/var/lib/myims-pbx/control/'+v.expected.nodeId+'/profile-executor.json','utf8'));
      if(p.pid===v.before.previousExecutorPid || p.nodeId!==v.expected.nodeId || p.installationId!==v.expected.installationId || !fs.existsSync('/proc/'+p.pid))throw Error();
      if(fs.readFileSync('/proc/'+v.before.pbx+'/stat','utf8')!==v.before.pbxStat) {
        const ticks=s=>s.slice(s.lastIndexOf(')')+2).split(' ')[19];
        if(ticks(fs.readFileSync('/proc/'+v.before.pbx+'/stat','utf8'))!==ticks(v.before.pbxStat))throw Error();
      }
      console.log(JSON.stringify({executorRefreshed:true,pbxProcessPreserved:true}));
    `,
      { expected, before },
    );
    console.log(JSON.stringify(result));
    process.exit(0);
  } catch {
    /* Wait for supervisor and exact new executor marker. */
  }
  await delay(500);
}
throw new Error('Executor refresh unresolved; passive inspection required');
