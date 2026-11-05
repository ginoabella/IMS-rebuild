// Trusted Docker launcher only. The application replicas receive no Docker access.
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  writeFileSync,
  appendFileSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
export class LiveBrowserFixture {
  constructor() {
    this.project = process.env.STORAGE_HOST_PROJECT_ROOT ?? process.cwd();
    this.name = null;
    this.directory = null;
  }
  docker(args) {
    const result = spawnSync('docker', args, {
      encoding: 'utf8',
      timeout: 15000,
      maxBuffer: 1048576,
    });
    if (result.status !== 0)
      throw new Error('Owned live browser fixture failed');
    return result.stdout;
  }
  async start(metadata) {
    if (
      this.name ||
      !/^myims_session_[a-f0-9]{12}$/.test(metadata.database ?? '') ||
      [metadata.nodeId, metadata.installationId].some(
        (id) => !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id ?? ''),
      )
    )
      throw new Error('Invalid live browser fixture identity');
    const relative = `.local/pbx-live/acceptance/${metadata.nodeId}`;
    this.directory = relative;
    mkdirSync(relative, { recursive: true, mode: 0o700 });
    this.name = 'myims-live-browser-' + metadata.nodeId.slice(0, 8);
    writeFileSync(join(relative, 'fault'), 'none', { mode: 0o600 });
    writeFileSync(
      join(relative, 'integration.json'),
      JSON.stringify(metadata),
      { mode: 0o600, flag: 'wx' },
    );
    cpSync('infra/asterisk/bootstrap', join(relative, 'config'), {
      recursive: true,
    });
    appendFileSync(
      join(relative, 'config/pjsip.conf'),
      '\n#tryinclude /var/lib/myims-pbx/managed/current/pjsip.conf\n',
    );
    appendFileSync(
      join(relative, 'config/extensions.conf'),
      '\n#tryinclude /var/lib/myims-pbx/managed/current/extensions.conf\n',
    );
    appendFileSync(
      join(relative, 'config/modules.conf'),
      '\nload = res_pjsip_pubsub.so\nload = res_pjsip_outbound_authenticator_digest.so\nload = app_dial.so\nload = bridge_simple.so\nload = func_strings.so\nload = res_speech.so\nload = res_agi.so\nload = func_channel.so\nload = res_pjsip_header_funcs.so\nload = res_pjsip_endpoint_identifier_ip.so\n',
    );
    const args = [
      'run',
      '-d',
      '--name',
      this.name,
      '--network',
      'myims-rebuild-dev_default',
      '--cap-add',
      'NET_ADMIN',
    ];
    for (const [source, target] of [
      [relative + '/config', '/etc/asterisk'],
      [relative + '/integration.json', '/input/integration.json'],
      [relative + '/fault', '/input/fault'],
      ['scripts/pbx-live-browser-owner.mjs', '/fixture.mjs'],
      ['services/backend/dist', '/workspace/services/backend/dist'],
      [
        'services/backend/package.json',
        '/workspace/services/backend/package.json',
      ],
      ['packages/config', '/workspace/packages/config'],
      ['packages/contracts', '/workspace/packages/contracts'],
      [
        '.local/shared-services/runtime-postgres-password',
        '/input/runtime.password',
      ],
      ['.local/pbx-live/native/db.password', '/input/executor.password'],
    ])
      args.push(
        '--mount',
        `type=bind,src=${this.project}/${source},dst=${target},readonly`,
      );
    for (const [source, target] of [
      ['workspace-deps-0', '/workspace/node_modules'],
      ['workspace-deps-10', '/workspace/services/backend/node_modules'],
      ['workspace-deps-6', '/workspace/packages/config/node_modules'],
      ['workspace-deps-7', '/workspace/packages/contracts/node_modules'],
    ])
      args.push(
        '--mount',
        `type=volume,src=myims-rebuild-dev_${source},dst=${target},readonly`,
      );
    args.push(
      '--entrypoint',
      '/usr/sbin/asterisk',
      'myims-rebuild-dev-asterisk-live',
      '-f',
      '-U',
      'asterisk',
    );
    this.docker(args);
    let ready = false;
    for (let i = 0; i < 100; i++) {
      const result = spawnSync(
        'docker',
        ['exec', this.name, 'asterisk', '-rx', 'core waitfullybooted'],
        { encoding: 'utf8', timeout: 3000 },
      );
      if (result.status === 0 && result.stdout.includes('fully booted')) {
        ready = true;
        break;
      }
      await delay(100);
    }
    if (!ready) throw new Error('Owned browser PBX startup unavailable');
    this.docker([
      'exec',
      '-d',
      this.name,
      '/bin/sh',
      '-c',
      `umask 077; mkdir -p /var/lib/myims-pbx/control/${metadata.nodeId}; chmod 700 /var/lib/myims-pbx/control/${metadata.nodeId}; exec 3>/var/lib/myims-pbx/control/${metadata.nodeId}/boundary.lock; flock -n 3 || exit 1; exec node /fixture.mjs >/var/lib/myims-pbx/browser-owner.log 2>&1`,
    ]);
  }
  stop() {
    if (this.name) {
      const diagnostics = this.docker([
        'exec',
        this.name,
        'node',
        '--input-type=module',
        '-e',
        `import {readFileSync} from 'node:fs'; try { for(const line of readFileSync('/var/lib/myims-pbx/browser-owner.log','utf8').split('\\n')) { try { const e=JSON.parse(line); if(e.fixture==='live-browser-owner' && e.state==='failed') console.log(JSON.stringify(e)); } catch {} } } catch {}`,
      ]);
      if (diagnostics.trim()) console.error(diagnostics.trim());
      this.docker(['rm', '-f', '-v', this.name]);
      this.name = null;
    }
    if (this.directory) {
      rmSync(join(this.directory, 'config'), { recursive: true, force: true });
      writeFileSync(join(this.directory, 'stopped'), 'stopped', {
        mode: 0o600,
      });
      this.directory = null;
    }
  }
}
