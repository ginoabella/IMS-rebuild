import {
  constants,
  openSync,
  fstatSync,
  readFileSync,
  closeSync,
} from 'node:fs';
import { request } from 'node:https';
export function protectedInput(path: string, max = 16384): Buffer {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const s = fstatSync(fd);
    if (!s.isFile() || s.mode & 0o077 || s.size < 1 || s.size > max)
      throw new Error('Use a regular owner-only protected input file.');
    const data = readFileSync(fd);
    if (data.length > max) throw new Error('Protected input too large.');
    return data;
  } finally {
    closeSync(fd);
  }
}
export class SimpleTrunkAccessDenied extends Error {
  constructor() {
    super(
      'OpenBao setup credential expired or denied. Replace the token through the documented custodian command and retry.',
    );
  }
}
/** Trusted deployment only; HTTP and Next never import this adapter. */
export class SimpleTrunkProvider {
  private readonly token: string;
  private readonly ca: Buffer;
  constructor(
    private readonly endpoint: string,
    caFile: string,
    tokenFile: string,
  ) {
    const url = new URL(endpoint);
    if (
      url.protocol !== 'https:' ||
      url.pathname !== '/' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error('Configure a verified HTTPS provider origin.');
    this.ca = readFileSync(caFile);
    this.token = protectedInput(tokenFile, 4096).toString('utf8').trim();
    if (!/^[a-zA-Z0-9._-]{16,4096}$/.test(this.token))
      throw new Error('Invalid setup token file.');
  }
  call(
    path: string,
    body?: unknown,
  ): Promise<{ status: number; value: Record<string, unknown> }> {
    return new Promise((resolve, reject) => {
      const fail = () =>
        reject(
          new Error(
            'OpenBao unavailable; resume the same operation ID to reconcile any pending write.',
          ),
        );
      const req = request(
        `${this.endpoint.replace(/\/$/, '')}/v1/${path}`,
        {
          ca: this.ca,
          method: body === undefined ? 'GET' : 'POST',
          headers: {
            'X-Vault-Token': this.token,
            'Content-Type': 'application/json',
          },
        },
        (res) => {
          let bytes = '';
          res.on('data', (b: Buffer) => {
            bytes += b.toString('utf8');
            if (Buffer.byteLength(bytes) > 32768) req.destroy();
          });
          res.on('error', fail);
          res.on('end', () => {
            if (res.statusCode === 403)
              return reject(new SimpleTrunkAccessDenied());
            if ((res.statusCode ?? 503) >= 500) return fail();
            try {
              resolve({
                status: res.statusCode ?? 503,
                value: JSON.parse(bytes || '{}') as Record<string, unknown>,
              });
            } catch {
              fail();
            }
          });
        },
      );
      const timer = setTimeout(() => req.destroy(), 5000);
      req.on('close', () => clearTimeout(timer));
      req.on('error', fail);
      req.end(body === undefined ? undefined : JSON.stringify(body));
    });
  }
  async lifetime() {
    const result = await this.call('auth/token/lookup-self');
    const data = result.value.data as
      { ttl?: number; policies?: string[] } | undefined;
    if (
      result.status !== 200 ||
      !Number.isInteger(data?.ttl) ||
      (data?.ttl ?? 0) < 60 ||
      data?.policies?.includes('root')
    )
      throw new Error(
        'Use a nonroot setup token with at least 60 seconds remaining; replace expired credentials.',
      );
    return data!.ttl!;
  }
}
