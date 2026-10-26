import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  constants,
  openSync,
  closeSync,
  fstatSync,
  lstatSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
export class NativeCommandFailure extends Error {
  constructor(readonly code: 'reload_failed' | 'reconciliation_required') {
    super('Native PBX command outcome uncertain');
  }
}
/**
 * Native process-lifetime flock is inherited as FD 3. A fixed guardian shell
 * retains that SAME open-file description until Asterisk's synchronous CLI has
 * finished, even if the JS helper dies. Output goes to a protected regular file,
 * so parent death cannot kill the CLI through a broken stdout pipe.
 * A caller deadline never kills a mutating command or releases its physical fence.
 */
export class NativeCommandRunner {
  private readonly commands = new Set<Promise<void>>();
  constructor(private readonly root: string) {
    try {
      const inherited = fstatSync(3),
        lock = lstatSync(join(root, 'boundary.lock'));
      if (
        !inherited.isFile() ||
        !lock.isFile() ||
        inherited.ino !== lock.ino ||
        inherited.dev !== lock.dev ||
        inherited.uid !== process.getuid?.() ||
        inherited.mode & 0o077
      )
        throw new Error();
    } catch {
      throw new NativeCommandFailure('reconciliation_required');
    }
  }
  async drain(): Promise<void> {
    await Promise.all([...this.commands]);
  }
  run(
    command: 'module reload res_pjsip.so' | 'dialplan reload',
  ): Promise<string> {
    const path = join(this.root, `command-${randomUUID()}.out`);
    const output = openSync(
      path,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    // The script is fixed; command text is a code-owned argv value, never shell code.
    const child = spawn(
      '/bin/sh',
      [
        '-c',
        '"$@" & wait "$!"',
        'myims-fixed-reload',
        '/usr/sbin/asterisk',
        '-rx',
        command,
      ],
      {
        stdio: ['ignore', output, output, 3],
        env: { PATH: '/usr/sbin:/usr/bin:/bin' },
      },
    );
    closeSync(output);
    let complete: () => void = () => {};
    const finished = new Promise<void>((resolve) => {
      complete = resolve;
    });
    this.commands.add(finished);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new NativeCommandFailure('reconciliation_required')),
        3000,
      );
      const end = (success: boolean) => {
        clearTimeout(timer);
        try {
          const fd = openSync(
            path,
            constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
          );
          let bytes: Buffer;
          try {
            const stat = fstatSync(fd);
            if (!stat.isFile() || stat.nlink !== 1 || stat.size > 1048576)
              throw new Error();
            bytes = readFileSync(fd);
          } finally {
            closeSync(fd);
          }
          if (!success) throw new Error();
          resolve(bytes.toString('utf8'));
          rmSync(path);
        } catch {
          reject(new NativeCommandFailure('reload_failed'));
        } finally {
          this.commands.delete(finished);
          complete();
        }
      };
      child.once('error', () => end(false));
      child.once('exit', (code) => end(code === 0));
    });
  }
}
