// Disposable native helper death test only; no production fault hooks.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const load = createRequire(
  '/workspace/services/backend/dist/modules/telephony/adapters/live/command-runner.js',
);
const { NativeCommandRunner } = load('./command-runner.js');
const root = '/var/lib/myims-pbx/control/fixture';
writeFileSync(root + '/guardian-helper.pid', String(process.pid), {
  mode: 0o600,
});
const commands = new NativeCommandRunner(root);
try {
  await commands.run('module reload res_pjsip.so');
} catch {
  writeFileSync(root + '/guardian-timeout', 'uncertain\n', { mode: 0o600 });
}
await commands.drain();
