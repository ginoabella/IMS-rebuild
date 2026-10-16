import { randomBytes } from 'node:crypto';
import { readFileSync, lstatSync } from 'node:fs';
import { request } from 'node:https';
import { uuid } from '../../../identity/domain/storage';
import {
  CredentialProviderError,
  type CredentialBinding,
  type EndpointSecretProvider,
  type EndpointSecretCleanup,
} from '../../application/credential-ports';
export interface OpenBaoSettings {
  endpoint: string;
  caFile: string;
  tokenFile: string;
  installationId: string;
}
export function openBaoSettings(env: NodeJS.ProcessEnv): OpenBaoSettings {
  const endpoint = env.ENDPOINT_PROVIDER_URL;
  const caFile = env.ENDPOINT_PROVIDER_CA_FILE;
  const tokenFile = env.ENDPOINT_PROVIDER_TOKEN_FILE;
  const installationId = env.ENDPOINT_PROVIDER_INSTALLATION_ID;
  if (!endpoint || !caFile || !tokenFile || !uuid(installationId))
    throw new Error('Invalid endpoint provider configuration');
  const url = new URL(endpoint);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error('Invalid endpoint provider configuration');
  return {
    endpoint: url.origin,
    caFile,
    tokenFile,
    installationId: installationId.toLowerCase(),
  };
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new CredentialProviderError('material_invalid', false);
  return value as Record<string, unknown>;
}
export class OpenBaoEndpointProvider
  implements EndpointSecretProvider, EndpointSecretCleanup
{
  private readonly ca: Buffer;
  private readonly token: string;
  constructor(private readonly settings: OpenBaoSettings) {
    const file = lstatSync(settings.tokenFile);
    if (
      !file.isFile() ||
      file.isSymbolicLink() ||
      file.mode & 0o077 ||
      file.size > 4096
    )
      throw new Error('Invalid endpoint provider token file');
    this.ca = readFileSync(settings.caFile);
    this.token = readFileSync(settings.tokenFile, 'utf8').trim();
    if (!/^[a-zA-Z0-9._-]{16,4096}$/.test(this.token))
      throw new Error('Invalid endpoint provider token');
  }
  private path(b: CredentialBinding) {
    if (
      Object.values(b).some((v) => !uuid(v)) ||
      b.installationId !== this.settings.installationId
    )
      throw new CredentialProviderError('material_invalid', false);
    return `installations/${b.installationId}/extensions/${b.extensionId}/operations/${b.operationId}`;
  }
  private call(
    path: string,
    body?: unknown,
  ): Promise<{ status: number; value: unknown }> {
    return new Promise((resolve, reject) => {
      const fail = () =>
        reject(new CredentialProviderError('provider_unavailable', true));
      const req = request(
        `${this.settings.endpoint}/v1/${path}`,
        {
          ca: this.ca,
          method: body === undefined ? 'GET' : 'POST',
          headers: {
            'X-Vault-Token': this.token,
            'Content-Type': 'application/json',
          },
          // A socket inactivity timeout alone is not an absolute request deadline.
        },
        (response) => {
          let data = '';
          response.on('data', (chunk: Buffer) => {
            data += chunk.toString('utf8');
            if (Buffer.byteLength(data) > 32768) req.destroy();
          });
          response.on('error', fail);
          response.on('end', () => {
            const status = response.statusCode ?? 503;
            if (status === 403)
              return reject(
                new CredentialProviderError('provider_access_denied', false),
              );
            if (status >= 500 || status === 429) return fail();
            try {
              resolve({
                status,
                value: data ? (JSON.parse(data) as unknown) : {},
              });
            } catch {
              reject(new CredentialProviderError('material_invalid', false));
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
  private async read(
    b: CredentialBinding,
  ): Promise<'verified' | 'unavailable'> {
    const response = await this.call(
      `myims-endpoint/data/${this.path(b)}?version=1`,
    );
    if (response.status === 404) return 'unavailable';
    if (response.status !== 200)
      throw new CredentialProviderError('material_invalid', false);
    const envelope = record(record(response.value).data);
    const metadata = record(envelope.metadata),
      data = record(envelope.data);
    if (
      metadata.version !== 1 ||
      metadata.destroyed !== false ||
      metadata.deletion_time !== '' ||
      Object.keys(data).sort().join(',') !==
        'extensionId,generationId,installationId,operationId,password' ||
      Object.entries(b).some(([key, value]) => data[key] !== value) ||
      typeof data.password !== 'string' ||
      !/^[a-f0-9]{64}$/.test(data.password)
    )
      throw new CredentialProviderError('material_invalid', false);
    return 'verified';
  }
  async prepare(b: CredentialBinding) {
    if ((await this.read(b)) === 'verified') return;
    const response = await this.call(`myims-endpoint/data/${this.path(b)}`, {
      options: { cas: 0 },
      data: { ...b, password: randomBytes(32).toString('hex') },
    });
    // CAS races/unknown responses are always reconciled by exact read; never overwrite.
    if (response.status !== 200 && response.status !== 400)
      throw new CredentialProviderError('material_invalid', false);
    if ((await this.read(b)) !== 'verified')
      throw new CredentialProviderError('material_unavailable', false);
  }
  verify(b: CredentialBinding) {
    return this.read(b);
  }
  async renew() {
    const r = await this.call('auth/token/renew-self', { increment: '1h' });
    if (r.status !== 200)
      throw new CredentialProviderError('provider_access_denied', false);
  }
  async destroy(b: CredentialBinding): Promise<'destroyed' | 'absent'> {
    const path = this.path(b);
    const metadata = await this.call(`myims-endpoint/metadata/${path}`);
    if (metadata.status === 404) return 'absent';
    if (metadata.status !== 200)
      throw new CredentialProviderError('material_invalid', false);
    const data = record(record(metadata.value).data);
    if (data.current_version !== 1)
      throw new CredentialProviderError('material_invalid', false);
    const version = record(record(data.versions)['1']);
    if (version.destroyed === true) return 'destroyed';
    // Exact immutable binding is verified before destructive access.
    if ((await this.read(b)) !== 'verified')
      throw new CredentialProviderError('material_invalid', false);
    const destroyed = await this.call(`myims-endpoint/destroy/${path}`, {
      versions: [1],
    });
    if (destroyed.status !== 204)
      throw new CredentialProviderError('material_invalid', false);
    return 'destroyed';
  }
}
