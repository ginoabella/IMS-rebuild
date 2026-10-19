import {
  constants,
  closeSync,
  fstatSync,
  openSync,
  readFileSync,
} from 'node:fs';
import { request } from 'node:https';
export function protectedFile(path, max = 4096) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const s = fstatSync(fd);
    if (!s.isFile() || s.mode & 0o077 || s.size < 1 || s.size > max)
      throw new Error('Invalid protected input');
    const data = readFileSync(fd);
    if (data.length > max) throw new Error('Invalid protected input');
    return data;
  } finally {
    closeSync(fd);
  }
}
export class ProtectedBaoClient {
  #token;
  #ca;
  constructor(tokenFile, caFile) {
    this.#token = protectedFile(tokenFile).toString('utf8').trim();
    if (!/^[a-zA-Z0-9._-]{16,4096}$/.test(this.#token))
      throw new Error('Invalid protected input');
    this.#ca = readFileSync(caFile);
  }
  call(
    path,
    body,
    method = body === undefined ? 'GET' : 'POST',
    token = this.#token,
  ) {
    if (!/^[a-zA-Z0-9/_-]+$/.test(path))
      throw new Error('Invalid provisioning operation');
    return new Promise((resolve, reject) => {
      const fail = () =>
        reject(new Error('Protected provider operation unavailable'));
      const req = request(
        `https://endpoint-secrets:8200/v1/${path}`,
        {
          method,
          ca: this.#ca,
          headers: {
            'X-Vault-Token': token,
            'Content-Type': 'application/json',
          },
        },
        (res) => {
          let data = '';
          res.on('data', (b) => {
            data += b;
            if (Buffer.byteLength(data) > 262144) req.destroy();
          });
          res.on('error', fail);
          res.on('end', () => {
            try {
              resolve({
                status: res.statusCode,
                value: data ? JSON.parse(data) : {},
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
  async revokeIssued(token) {
    if (typeof token !== 'string' || !/^[a-zA-Z0-9._-]{16,4096}$/.test(token))
      throw new Error('Invalid protected response');
    const result = await this.call('auth/token/revoke-self', {}, 'POST', token);
    if (result.status !== 204 && result.status !== 200)
      throw new Error('Issued token revocation uncertain');
  }
  async required(path, body, method) {
    const result = await this.call(path, body, method);
    if (result.status < 200 || result.status > 299)
      throw new Error('Protected provider operation rejected');
    return result.value;
  }
}
