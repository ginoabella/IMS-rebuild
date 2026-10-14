import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import type { PbxCredentialResolver } from '../../domain/connectivity';
/** Construct only in the telephony process, never in HTTP or the browser graph. */
export class SecretFileCredentials implements PbxCredentialResolver {
  constructor(private readonly files: ReadonlyMap<string, string>) {}
  async resolve(alias: string): ReturnType<PbxCredentialResolver['resolve']> {
    const path = this.files.get(alias);
    if (!path) return { kind: 'secret_missing' };
    try {
      const file = await open(
        path,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const stat = await file.stat();
        if (
          !stat.isFile() ||
          stat.size > 4096 ||
          (stat.mode & 0o077) !== 0 ||
          stat.uid !== process.getuid?.()
        )
          return { kind: 'secret_unavailable' };
        const buffer = Buffer.alloc(4097);
        const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
        if (bytesRead > 4096) return { kind: 'secret_unavailable' };
        const data: unknown = JSON.parse(
          buffer.subarray(0, bytesRead).toString('utf8'),
        );
        if (!data || typeof data !== 'object' || Array.isArray(data))
          return { kind: 'secret_unavailable' };
        const value = data as Record<string, unknown>;
        if (
          Object.keys(value).some((k) => !['username', 'password'].includes(k))
        )
          return { kind: 'secret_unavailable' };
        for (const k of ['username', 'password']) {
          const v = value[k];
          if (
            typeof v !== 'string' ||
            !v ||
            v.length > 512 ||
            // eslint-disable-next-line no-control-regex -- reject protocol injection.
            /[\u0000-\u001f\u007f]/u.test(v)
          )
            return { kind: 'secret_unavailable' };
        }
        return {
          kind: 'resolved',
          username: value.username as string,
          password: value.password as string,
        };
      } finally {
        await file.close();
      }
    } catch (error) {
      return {
        kind:
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'ENOENT'
            ? 'secret_missing'
            : 'secret_unavailable',
      };
    }
  }
}
