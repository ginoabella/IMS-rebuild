// Owned disposable PBX only. Synthetic AMI credentials stay in its filesystem.
import { readFileSync, writeFileSync, mkdirSync, chownSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const user = readFileSync('/etc/passwd', 'utf8')
  .split('\n')
  .find((line) => line.startsWith('asterisk:'))
  .split(':');
const root = '/var/lib/myims-pbx/control/fixture';
mkdirSync(root, { recursive: true, mode: 0o700 });
const secret = randomBytes(32).toString('hex');
writeFileSync(
  root + '/ami.json',
  JSON.stringify({ username: 'fixture-observer', secret }),
  { mode: 0o600 },
);
writeFileSync(
  '/etc/asterisk/manager.conf',
  `[general]\nenabled=yes\nbindaddr=127.0.0.1\nport=5038\ntlsenable=no\nwebenabled=no\ndisplayconnects=no\n[fixture-observer]\nsecret=${secret}\nread=system\nwrite=system\nwritetimeout=2000\n`,
  { mode: 0o600 },
);
chownSync('/etc/asterisk/manager.conf', Number(user[2]), Number(user[3]));
