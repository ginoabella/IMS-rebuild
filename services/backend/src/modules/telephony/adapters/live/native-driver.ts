import { createSocket } from 'node:dgram';
import { execFile, spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  lstatSync,
  chownSync,
  chmodSync,
  symlinkSync,
  renameSync,
  readlinkSync,
  openSync,
  closeSync,
  fsyncSync,
  constants,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { uuid } from '../../../identity/domain/storage';
import type { ArtifactIdentity } from './artifact-store';
import { ProtectedArtifactStore } from './artifact-store';
import { NativeAdmissionBarrier } from './admission';
import { NativeCommandRunner } from './command-runner';
import type { RevisionSnapshot } from '../../domain/revision-snapshot';
import { canonical } from '../../domain/revision-snapshot';
import { runtimeNames } from './materialize';
export class NativePbxFailure extends Error {
  constructor(
    readonly code:
      | 'validation_failed'
      | 'install_failed'
      | 'reload_failed'
      | 'verification_failed'
      | 'boundary_unavailable',
    readonly reason?: 'startup' | 'runtime' | 'parser',
  ) {
    super('Controlled PBX operation failed');
  }
}
const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
export function nativeCli(
  command: string,
  configuration?: string,
): Promise<string> {
  // This function stays private to protected native composition. Callers below
  // construct only fixed queries and UUID-derived identities, never browser text.
  return new Promise((resolve, reject) =>
    execFile(
      '/usr/sbin/asterisk',
      [...(configuration ? ['-C', configuration] : []), '-rx', command],
      { timeout: 3000, maxBuffer: 1048576, encoding: 'utf8' },
      (error, stdout) =>
        error
          ? reject(new NativePbxFailure('boundary_unavailable'))
          : resolve(stdout),
    ),
  );
}
/** Existing PBX container only. Start under installation flock; no Docker socket. */
export class NativePbxDriver {
  private readonly readerGid: number;
  private readonly validatorUid: number;
  private readonly commands: NativeCommandRunner;
  constructor(
    private readonly privateRoot: string,
    private readonly runtimeRoot: string,
    private readonly store: ProtectedArtifactStore,
    private readonly barrier: NativeAdmissionBarrier,
  ) {
    if (
      process.getuid?.() !== 0 ||
      runtimeRoot !== '/var/lib/myims-pbx/managed' ||
      !privateRoot.startsWith('/var/lib/myims-pbx/control/')
    )
      throw new NativePbxFailure('boundary_unavailable');
    const parent = lstatSync('/var/lib/myims-pbx');
    if (!parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== 0)
      throw new NativePbxFailure('boundary_unavailable');
    chmodSync('/var/lib/myims-pbx', 0o751);
    this.commands = new NativeCommandRunner(privateRoot);
    const group = readFileSync('/etc/group', 'utf8')
      .split('\n')
      .find((line) => line.startsWith('asterisk:'));
    const user = readFileSync('/etc/passwd', 'utf8')
      .split('\n')
      .find((line) => line.startsWith('myims-validator:'));
    this.readerGid = Number(group?.split(':')[2]);
    this.validatorUid = Number(user?.split(':')[2]);
    if (
      !Number.isSafeInteger(this.readerGid) ||
      this.readerGid < 1 ||
      !Number.isSafeInteger(this.validatorUid) ||
      this.validatorUid < 1
    )
      throw new NativePbxFailure('boundary_unavailable');
    mkdirSync('/var/lib/myims-pbx/validators', {
      recursive: true,
      mode: 0o750,
    });
    chownSync('/var/lib/myims-pbx/validators', 0, this.readerGid);
    chmodSync('/var/lib/myims-pbx/validators', 0o750);
    mkdirSync(runtimeRoot, { recursive: true, mode: 0o750 });
    chownSync(runtimeRoot, 0, this.readerGid);
    chmodSync(runtimeRoot, 0o750);
  }
  unmanaged(): string {
    const files = readdirSync('/etc/asterisk')
      .filter((n) => n.endsWith('.conf'))
      .sort();
    const fingerprints = files.map((name) => {
      const path = join('/etc/asterisk', name),
        s = lstatSync(path);
      if (!s.isFile() || s.isSymbolicLink() || s.size > 1048576)
        throw new NativePbxFailure('boundary_unavailable');
      return [name, hash(readFileSync(path))];
    });
    return hash(Buffer.from(canonical(fingerprints)));
  }
  private async baselineFacts() {
    const values: Record<string, string> = { unmanaged: this.unmanaged() };
    for (const type of ['endpoints', 'auths', 'aors']) {
      const out = await nativeCli(`pjsip show ${type}`);
      if (!out.includes('No objects found.'))
        throw new NativePbxFailure('verification_failed');
      values[type] = hash(Buffer.from(out));
    }
    const denied = await nativeCli('dialplan show default');
    if (!denied.includes('Hangup()') || /\b(?:Dial|Goto|Gosub)\(/.test(denied))
      throw new NativePbxFailure('verification_failed');
    values.dialplan = hash(Buffer.from(await nativeCli('dialplan show')));
    return values;
  }
  async captureBaseline() {
    const path = join(this.privateRoot, 'baseline-facts.json');
    try {
      lstatSync(path);
      await this.verifyBaseline();
      return;
    } catch (error) {
      if (
        !error ||
        typeof error !== 'object' ||
        !('code' in error) ||
        error.code !== 'ENOENT'
      )
        throw error;
    }
    const facts = await this.baselineFacts();
    const fd = openSync(
      path,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      writeFileSync(fd, canonical(facts));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    this.syncDirectory(this.privateRoot);
  }
  private async verifyBaseline() {
    const path = join(this.privateRoot, 'baseline-facts.json'),
      stat = lstatSync(path);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.uid !== 0 ||
      stat.mode & 0o077 ||
      stat.size > 4096
    )
      throw new NativePbxFailure('verification_failed');
    const facts: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (canonical(facts) !== canonical(await this.baselineFacts()))
      throw new NativePbxFailure('verification_failed');
  }
  private syncDirectory(path: string) {
    const fd = openSync(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY,
    );
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }
  private protectedFile(path: string, bytes: Buffer) {
    const fd = openSync(
      path,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o640,
    );
    try {
      writeFileSync(fd, bytes);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    chownSync(path, 0, this.readerGid);
    chmodSync(path, 0o640);
  }
  async validate(
    identity: ArtifactIdentity,
    snapshot: RevisionSnapshot,
  ): Promise<void> {
    const files = this.store.load(identity),
      work = join('/var/lib/myims-pbx/validators', `validate-${randomUUID()}`),
      configuration = join(work, 'asterisk.conf');
    mkdirSync(work, { mode: 0o750 });
    chownSync(work, 0, this.readerGid);
    chmodSync(work, 0o750);
    for (const name of ['run', 'log', 'spool', 'data']) {
      mkdirSync(join(work, name), { mode: 0o700 });
      chownSync(join(work, name), this.validatorUid, this.readerGid);
    }
    const socket = createSocket('udp4');
    await new Promise<void>((resolve, reject) => {
      socket.once('error', reject);
      socket.bind(0, '127.0.0.1', resolve);
    });
    const port = socket.address().port;
    await new Promise<void>((resolve) => socket.close(() => resolve()));
    const config = `[directories]\nastetcdir => ${work}\nastmoddir => /usr/lib/asterisk/modules\nastvarlibdir => ${work}/data\nastdbdir => ${work}/data\nastdatadir => /var/lib/asterisk\nastspooldir => ${work}/spool\nastrundir => ${work}/run\nastlogdir => ${work}/log\n[options]\nverbose = 0\nnocolor = yes\n`;
    const inputs: Record<string, Buffer> = {
      'asterisk.conf': Buffer.from(config),
      'modules.conf': readFileSync('/etc/asterisk/modules.conf'),
      'pjsip.conf': Buffer.concat([
        Buffer.from(
          `[transport-udp]\ntype=transport\nprotocol=udp\nbind=127.0.0.1:${port}\n`,
        ),
        files.pjsip,
      ]),
      'extensions.conf': Buffer.concat([
        Buffer.from(
          readFileSync('/etc/asterisk/extensions.conf', 'utf8').replace(
            /^#tryinclude \/var\/lib\/myims-pbx\/managed\/current\/extensions\.conf[^\S\r\n]*$/gm,
            '',
          ),
        ),
        Buffer.from('\n'),
        files.dialplan,
      ]),
      'stasis.conf': Buffer.from('[declined_message_types]\n'),
      'ccss.conf': Buffer.from('[general]\n'),
      'cdr.conf': Buffer.from('[general]\nenable=no\n'),
      'cel.conf': Buffer.from('[general]\nenable=no\n'),
      'features.conf': Buffer.from('[general]\n'),
      'indications.conf': Buffer.from(
        '[general]\ncountry=us\n[us]\ndescription=Controlled validator\nringcadence=2000,4000\ndial=350+440\n',
      ),
      'acl.conf': Buffer.from(''),
      'udptl.conf': Buffer.from('[general]\n'),
      'pjproject.conf': Buffer.from('[global]\n'),
      'manager.conf': Buffer.from('[general]\nenabled=no\n'),
      'http.conf': Buffer.from('[general]\nenabled=no\n'),
      'logger.conf': Buffer.from(
        '[general]\n[logfiles]\nconsole=>error,warning\n',
      ),
    };
    for (const [name, bytes] of Object.entries(inputs))
      this.protectedFile(join(work, name), bytes);
    // Isolate the validator by its dedicated UID in the existing network namespace.
    // It has no provider token, public listener, outbound packets or live control socket.
    const tables = await new Promise<string>((resolve, reject) =>
      execFile(
        '/usr/sbin/nft',
        ['-j', 'list', 'tables'],
        { timeout: 3000, maxBuffer: 262144, encoding: 'utf8' },
        (error, stdout) =>
          error
            ? reject(new NativePbxFailure('boundary_unavailable'))
            : resolve(stdout),
      ),
    );
    let present: boolean;
    try {
      const parsed: unknown = JSON.parse(tables);
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !('nftables' in parsed) ||
        !Array.isArray(parsed.nftables)
      )
        throw new Error();
      present = parsed.nftables.some(
        (entry: unknown) =>
          !!entry &&
          typeof entry === 'object' &&
          'table' in entry &&
          !!entry.table &&
          typeof entry.table === 'object' &&
          'family' in entry.table &&
          entry.table.family === 'inet' &&
          'name' in entry.table &&
          entry.table.name === 'myims_validator',
      );
    } catch {
      throw new NativePbxFailure('boundary_unavailable');
    }
    // Replace atomically and retain this rule after success/failure. An orphaned
    // validator can survive helper death; a later run must never unblock it.
    await new Promise<void>((resolve, reject) =>
      execFile('/usr/sbin/nft', ['-f', '-'], { timeout: 3000 }, (error) =>
        error
          ? reject(new NativePbxFailure('boundary_unavailable'))
          : resolve(),
      ).stdin?.end(
        `${present ? 'delete table inet myims_validator\n' : ''}add table inet myims_validator\nadd chain inet myims_validator output { type filter hook output priority -20; policy accept; }\nadd rule inet myims_validator output meta skuid ${this.validatorUid} drop\n`,
      ),
    );
    const logPath = join(work, 'validator.log'),
      log = openSync(
        logPath,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
        0o600,
      );
    const child = spawn(
      '/usr/sbin/asterisk',
      ['-C', configuration, '-f', '-G', 'asterisk', '-U', 'myims-validator'],
      {
        env: { PATH: '/usr/sbin:/usr/bin:/bin' },
        cwd: work,
        stdio: ['ignore', log, log],
      },
    );
    closeSync(log);
    let exited = false,
      passed = false;
    child.once('exit', () => {
      exited = true;
    });
    child.on('error', () => {
      exited = true;
    });
    try {
      const deadline = Date.now() + 9000;
      let ready = false;
      while (Date.now() < deadline && !exited) {
        try {
          const out = await nativeCli('core waitfullybooted', configuration);
          if (!/No such|Unable|Error/i.test(out)) {
            ready = true;
            break;
          }
        } catch {
          /* bounded startup */
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!ready) throw new NativePbxFailure('validation_failed', 'startup');
      await this.runtime(identity, snapshot, configuration);
      const logBytes = readFileSync(logPath);
      if (
        logBytes.length > 1048576 ||
        /ERROR|Unable to create|Could not create|parse error|not found|Unable to load/i.test(
          logBytes.toString('utf8'),
        )
      )
        throw new NativePbxFailure('validation_failed', 'parser');
      passed = true;
    } catch (e) {
      throw new NativePbxFailure(
        'validation_failed',
        e instanceof NativePbxFailure
          ? (e.reason ??
              (e.code === 'verification_failed' ? 'runtime' : 'startup'))
          : 'startup',
      );
    } finally {
      if (!exited) child.kill('SIGTERM');
      const deadline = Date.now() + 3000;
      while (!exited && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 50));
      if (!exited) {
        child.kill('SIGKILL');
        await new Promise<void>((resolve) =>
          child.once('exit', () => resolve()),
        );
      }
      if (passed) rmSync(work, { recursive: true, force: true });
    }
  }
  select(identity: ArtifactIdentity): void {
    try {
      if (!uuid(identity.revisionId)) throw new Error();
      const files = this.store.load(identity),
        target = join(this.runtimeRoot, identity.revisionId),
        temporary = join(this.runtimeRoot, `.install-${randomUUID()}`);
      let present = false;
      try {
        const s = lstatSync(target);
        if (!s.isDirectory() || s.isSymbolicLink() || s.uid !== 0)
          throw new Error();
        present = true;
      } catch (e) {
        if (
          !e ||
          typeof e !== 'object' ||
          !('code' in e) ||
          e.code !== 'ENOENT'
        )
          throw e;
      }
      if (present) {
        if (
          !readFileSync(join(target, 'pjsip.conf')).equals(files.pjsip) ||
          !readFileSync(join(target, 'extensions.conf')).equals(files.dialplan)
        )
          throw new Error();
      } else {
        mkdirSync(temporary, { mode: 0o750 });
        chownSync(temporary, 0, this.readerGid);
        chmodSync(temporary, 0o750);
        this.protectedFile(join(temporary, 'pjsip.conf'), files.pjsip);
        this.protectedFile(join(temporary, 'extensions.conf'), files.dialplan);
        this.syncDirectory(temporary);
        renameSync(temporary, target);
      }
      const pointer = join(this.runtimeRoot, `.select-${randomUUID()}`);
      symlinkSync(identity.revisionId, pointer);
      renameSync(pointer, join(this.runtimeRoot, 'current'));
      this.syncDirectory(this.runtimeRoot);
    } catch {
      throw new NativePbxFailure('install_failed');
    }
  }
  async drain() {
    await this.commands.drain();
  }
  async reload(guard: () => Promise<void>): Promise<void> {
    for (const command of [
      'module reload res_pjsip.so',
      'dialplan reload',
    ] as const) {
      await guard();
      await this.barrier.assertClosed();
      const out = await this.commands.run(command);
      if (/No such|Unable|Error|failed/i.test(out))
        throw new NativePbxFailure('reload_failed');
    }
  }
  private async runtime(
    identity: ArtifactIdentity,
    snapshot: RevisionSnapshot,
    configuration?: string,
  ) {
    if (identity.compilerVersion === 'baseline-1') {
      if (configuration) {
        for (const type of ['endpoints', 'auths', 'aors'])
          if (
            !(await nativeCli(`pjsip show ${type}`, configuration)).includes(
              'No objects found.',
            )
          )
            throw new NativePbxFailure('verification_failed');
        const denied = await nativeCli('dialplan show default', configuration);
        if (
          !denied.includes('Hangup()') ||
          /\b(?:Dial|Goto|Gosub)\(/.test(denied)
        )
          throw new NativePbxFailure('verification_failed');
      } else await this.verifyBaseline();
      return;
    }
    const deadline = Date.now() + 15000;
    const query = async (command: string) => {
      if (Date.now() > deadline)
        throw new NativePbxFailure('verification_failed');
      return nativeCli(command, configuration);
    };
    const enabled = snapshot.extensions.filter(
      (endpoint) => endpoint.administrativeStatus === 'enabled',
    );
    for (const [type, count] of [
      ['endpoints', 1 + enabled.length + snapshot.trunks.length],
      [
        'auths',
        enabled.length +
          snapshot.trunks.filter((trunk) => trunk.settings.credential).length,
      ],
      ['aors', enabled.length + snapshot.trunks.length],
    ] as const) {
      const out = await query(`pjsip show ${type}`);
      const found = /Objects found: (\d+)/.exec(out);
      if (
        count === 0
          ? !out.includes('No objects found.')
          : !found || Number(found[1]) !== count
      )
        throw new NativePbxFailure('verification_failed');
    }
    const field = (out: string, name: string, expected: string) => {
      const values = out
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith(name + ' '));
      return values.some(
        (line) => line.slice(line.indexOf(':') + 1).trim() === expected,
      );
    };
    // The pinned privileged auth inventory exposes actual loaded values. Keep
    // these observations inside the protected helper and compare to exact staged
    // bytes; never return them or include protocol output in diagnostics.
    const expectedAuth = new Map<string, Record<string, string>>();
    let section: string | undefined,
      parameters: Record<string, string> = {};
    const remember = () => {
      if (section && parameters.type === 'auth')
        expectedAuth.set(section, parameters);
    };
    for (const line of this.store
      .load(identity)
      .pjsip.toString('utf8')
      .split('\n')) {
      const heading = /^\[([a-zA-Z0-9_.:-]{1,128})\]$/.exec(line);
      if (heading) {
        remember();
        section = heading[1];
        parameters = {};
        continue;
      }
      const pair = /^([a-z_]+)=(.*)$/.exec(line);
      if (pair) parameters[pair[1]!] = pair[2]!;
    }
    remember();
    const authFacts = new Map<string, string>();
    for (const [id, expected] of expectedAuth) {
      const actual = await query(`pjsip show auth ${id}`);
      for (const name of ['username', 'password', 'auth_type', 'realm'])
        if (
          expected[name] !== undefined &&
          !field(actual, name, expected[name]!)
        )
          throw new NativePbxFailure('verification_failed');
      authFacts.set(id, actual);
    }
    const contexts = new Map<string, Map<string, string>>();
    let selectedContext: Map<string, string> | undefined;
    for (const line of this.store
      .load(identity)
      .dialplan.toString('utf8')
      .split('\n')) {
      const context = /^\[([a-z0-9-]{1,79})\]$/.exec(line);
      if (context) {
        selectedContext = new Map();
        contexts.set(context[1]!, selectedContext);
        continue;
      }
      const step = /^exten => ([^,]+),(\d+),(.*)$/.exec(line);
      if (step && selectedContext)
        selectedContext.set(`${step[1]}:${step[2]}`, step[3]!);
    }
    for (const [context, expected] of contexts) {
      const actual = new Map<string, string>();
      let extension: string | undefined;
      for (const line of (await query(`dialplan show ${context}`)).split(
        '\n',
      )) {
        const first =
          /^\s*'([^']+)'\s*=>\s*(\d+)\.\s+(.*?)\s+\[[^\]\r\n]+\]\s*$/.exec(
            line,
          );
        const next = /^\s*(\d+)\.\s+(.*?)\s+\[[^\]\r\n]+\]\s*$/.exec(line);
        if (first) {
          extension = first[1]!;
          actual.set(`${extension}:${first[2]}`, first[3]!);
        } else if (next && extension)
          actual.set(`${extension}:${next[1]}`, next[2]!);
      }
      if (canonical([...actual].sort()) !== canonical([...expected].sort()))
        throw new NativePbxFailure('verification_failed');
    }
    const names = runtimeNames(snapshot, identity.revisionId),
      marker = await query(`pjsip show endpoint ${names.marker}`),
      dialplan = await query(`dialplan show ${names.marker}`);
    if (
      !marker.includes(names.marker) ||
      !marker.includes(names.deny) ||
      !dialplan.includes('Hangup()')
    )
      throw new NativePbxFailure('verification_failed');
    for (const e of snapshot.extensions.filter(
      (e) => e.administrativeStatus === 'enabled',
    )) {
      const out = await query(`pjsip show endpoint ${e.endpointKey}`);
      const profile = snapshot.profiles.find(
        (value) =>
          value.id === e.profileId && value.version === e.profileVersion,
      );
      const aor = await query(`pjsip show aor ${e.aorKey}`);
      const auth = authFacts.get(e.authKey);
      if (
        !profile ||
        !field(out, 'allow', `(${profile.settings.codecs.join('|')})`) ||
        !field(out, 'direct_media', 'false') ||
        !field(out, 'rtp_symmetric', 'true') ||
        !field(out, 'force_rport', 'true') ||
        !field(out, 'rewrite_contact', 'true') ||
        !field(out, 'ice_support', 'false') ||
        !field(out, 'use_avpf', 'false') ||
        !field(out, 'rtcp_mux', 'false') ||
        !field(out, 'media_encryption', 'no') ||
        !field(out, 'media_use_received_transport', 'false') ||
        !field(aor, 'max_contacts', String(profile.settings.maxContacts)) ||
        !field(aor, 'remove_existing', 'false') ||
        !auth ||
        !field(auth, 'username', e.endpointKey)
      )
        throw new NativePbxFailure('verification_failed');
      if (
        !out.includes(e.endpointKey) ||
        !out.includes(e.authKey) ||
        !out.includes(e.aorKey) ||
        !out.includes(names.deny)
      )
        throw new NativePbxFailure('verification_failed');
    }
    for (const trunk of snapshot.trunks) {
      const key = names.trunk(trunk.id),
        out = await query(`pjsip show endpoint ${key}`),
        aor = await query(`pjsip show aor ${key}-aor`),
        host = trunk.settings.host.includes(':')
          ? `[${trunk.settings.host}]`
          : trunk.settings.host;
      if (
        !out.includes(key) ||
        !out.includes(names.deny) ||
        !out.includes(`${key}-aor`) ||
        !field(out, 'allow', `(${trunk.settings.codecs.join('|')})`) ||
        !field(out, 'direct_media', 'false') ||
        !field(out, 'rtp_symmetric', 'true') ||
        !field(out, 'force_rport', 'true') ||
        !field(out, 'media_encryption', 'no') ||
        !field(aor, 'qualify_frequency', '0') ||
        !aor.includes(`sip:${host}:${trunk.settings.port}`)
      )
        throw new NativePbxFailure('verification_failed');
    }
    const denied = await query(`dialplan show ${names.deny}`);
    if (!denied.includes('Hangup()') || /\b(?:Dial|Goto|Gosub)\(/.test(denied))
      throw new NativePbxFailure('verification_failed');
  }
  async verify(
    identity: ArtifactIdentity,
    snapshot: RevisionSnapshot,
    unmanaged: string,
  ): Promise<void> {
    if (
      readlinkSync(join(this.runtimeRoot, 'current')) !== identity.revisionId ||
      this.unmanaged() !== unmanaged
    )
      throw new NativePbxFailure('verification_failed');
    const expected = this.store.load(identity);
    if (
      !readFileSync(
        join(this.runtimeRoot, identity.revisionId, 'pjsip.conf'),
      ).equals(expected.pjsip) ||
      !readFileSync(
        join(this.runtimeRoot, identity.revisionId, 'extensions.conf'),
      ).equals(expected.dialplan)
    )
      throw new NativePbxFailure('verification_failed');
    await this.runtime(identity, snapshot);
  }
}
