import {
  readFileSync,
  openSync,
  closeSync,
  fstatSync,
  constants,
} from 'node:fs';
import { request } from 'node:https';
import { uuid } from '../../../identity/domain/storage';
import {
  exactTrunkEnvelope,
  sameTrunkMaterial,
  trunkImportMaterial,
  trunkMaterialIdentity,
} from '../../domain/trunk-material';
import {
  TrunkProviderError,
  type TrunkImportMaterial,
  type TrunkMaterialIdentity,
  type TrunkSecretImporter,
  type TrunkSecretVerifier,
} from '../../application/trunk-credential-ports';
export interface TrunkBaoSettings {
  endpoint: string;
  caFile: string;
  tokenFile: string;
  installationId: string;
  exactRealm: string;
}
interface ProviderResponse {
  status: number;
  value: unknown;
}
/** Protected composition only. No provider dependency is wired into HTTP/Next/ordinary workers. */
export class OpenBaoTrunkProvider
  implements TrunkSecretImporter, TrunkSecretVerifier
{
  readonly #token: string;
  readonly #ca: Buffer;
  readonly #settings: Readonly<TrunkBaoSettings>;
  constructor(settings: TrunkBaoSettings) {
    this.#settings = Object.freeze({ ...settings });
    let url: URL;
    try {
      url = new URL(settings.endpoint);
    } catch {
      throw new TrunkProviderError('material_invalid', false);
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      !uuid(settings.installationId) ||
      settings.installationId !== settings.installationId.toLowerCase()
    )
      throw new TrunkProviderError('material_invalid', false);
    trunkImportMaterial(
      {
        username: 'validation',
        password: 'validation',
        realm: settings.exactRealm,
      },
      settings.exactRealm,
    );
    try {
      const fd = openSync(
        settings.tokenFile,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      try {
        const file = fstatSync(fd);
        if (
          !file.isFile() ||
          file.mode & 0o077 ||
          file.size < 16 ||
          file.size > 4096
        )
          throw new TrunkProviderError('access_denied', false);
        this.#token = readFileSync(fd, 'utf8').trim();
      } finally {
        closeSync(fd);
      }
      if (!/^[a-zA-Z0-9._-]{16,4096}$/.test(this.#token))
        throw new TrunkProviderError('access_denied', false);
      this.#ca = readFileSync(settings.caFile);
    } catch {
      throw new TrunkProviderError('access_denied', false);
    }
  }
  private path(b: TrunkMaterialIdentity) {
    trunkMaterialIdentity(b, this.#settings.installationId);
    return `myims-trunk/data/installations/${b.installationId}/bindings/${b.bindingId}/generations/${b.generationId}`;
  }
  private call(path: string, body?: unknown): Promise<ProviderResponse> {
    return new Promise((resolve, reject) => {
      const fail = () =>
        reject(new TrunkProviderError('provider_unavailable', true));
      const req = request(
        `${this.#settings.endpoint.replace(/\/$/, '')}/v1/${path}`,
        {
          ca: this.#ca,
          method: body === undefined ? 'GET' : 'POST',
          headers: {
            'X-Vault-Token': this.#token,
            'Content-Type': 'application/json',
          },
        },
        (res) => {
          let data = '';
          res.on('data', (b: Buffer) => {
            data += b.toString('utf8');
            if (Buffer.byteLength(data) > 32768) req.destroy();
          });
          res.on('error', fail);
          res.on('end', () => {
            const status = res.statusCode ?? 503;
            if (status === 403)
              return reject(new TrunkProviderError('access_denied', false));
            if (status === 429 || status >= 500) return fail();
            try {
              resolve({ status, value: data ? JSON.parse(data) : {} });
            } catch {
              reject(new TrunkProviderError('material_invalid', false));
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
    b: TrunkMaterialIdentity,
  ): Promise<TrunkImportMaterial | null> {
    const response = await this.call(`${this.path(b)}?version=1`);
    if (response.status === 404) return null;
    if (response.status !== 200)
      throw new TrunkProviderError('material_invalid', false);
    return exactTrunkEnvelope(response.value, b, this.#settings.exactRealm);
  }
  async verify(b: TrunkMaterialIdentity) {
    return (await this.read(b)) ? ('verified' as const) : ('missing' as const);
  }
  async import(b: TrunkMaterialIdentity, input: TrunkImportMaterial) {
    const path = this.path(b),
      material = trunkImportMaterial(input, this.#settings.exactRealm);
    const prior = await this.read(b);
    if (prior) {
      if (!sameTrunkMaterial(prior, material))
        throw new TrunkProviderError('import_conflict', false);
      return;
    }
    const response = await this.call(path, {
      options: { cas: 0 },
      data: { ...b, ...material },
    });
    if (response.status !== 200 && response.status !== 400)
      throw new TrunkProviderError('provider_unavailable', true);
    const saved = await this.read(b);
    if (!saved) throw new TrunkProviderError('provider_unavailable', true);
    if (!sameTrunkMaterial(saved, material))
      throw new TrunkProviderError('import_conflict', false);
  }
  /** Call before new work and at most every 20 minutes; failure pauses consumption.
   * A token reaching its 24h maximum requires explicit trusted reprovisioning. */
  async renew(): Promise<number> {
    const response = await this.call('auth/token/renew-self', {
      increment: '1h',
    });
    const value = response.value as {
      auth?: { lease_duration?: unknown; renewable?: unknown };
    };
    const lease = value?.auth?.lease_duration;
    if (
      response.status !== 200 ||
      typeof lease !== 'number' ||
      !Number.isInteger(lease) ||
      lease < 60 ||
      lease > 3600 ||
      value?.auth?.renewable !== true
    )
      throw new TrunkProviderError('token_reprovision_required', false);
    return lease;
  }
}
