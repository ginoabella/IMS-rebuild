import {
  constants,
  openSync,
  closeSync,
  fstatSync,
  readFileSync,
} from 'node:fs';
import { request } from 'node:https';
import { uuid } from '../../../identity/domain/storage';
import type { CredentialBinding } from '../../application/credential-ports';
export class LiveMaterialFailure extends Error {
  constructor(
    readonly code:
      | 'material_invalid'
      | 'material_missing'
      | 'material_denied'
      | 'material_unavailable',
  ) {
    super('Exact PBX material unavailable');
  }
}
export interface LiveMaterialSettings {
  installationId: string;
  endpoint: string;
  tokenFile: string;
  caFile: string;
}
export interface TrunkMaterialReference {
  installationId: string;
  credentialId: string;
  operationId: string;
  version: number;
  realm: string | null;
}
function fail(): never {
  throw new LiveMaterialFailure('material_invalid');
}
function record(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail();
  return v as Record<string, unknown>;
}
function identifiers(v: Record<string, unknown>, keys: string[]) {
  if (
    Object.keys(v).sort().join(',') !== [...keys].sort().join(',') ||
    keys.some((k) => !uuid(v[k]) || v[k] !== String(v[k]).toLowerCase())
  )
    fail();
}
function envelope(value: unknown, version: number) {
  const outer = record(record(value).data),
    metadata = record(outer.metadata),
    material = record(outer.data);
  if (
    metadata.version !== version ||
    metadata.destroyed !== false ||
    metadata.deletion_time !== ''
  )
    fail();
  return material;
}
/**
 * Telephony protected composition only. Fixed GET paths and exact KV versions;
 * no write/list/metadata/destruction/renewal methods and no latest-version fallback.
 * Returned material stays in the protected compiler/staging boundary.
 */
export class ExactLiveMaterialConsumer {
  readonly #token: string;
  readonly #ca: Buffer;
  readonly #origin: string;
  readonly #installation: string;
  constructor(settings: LiveMaterialSettings) {
    try {
      const origin = new URL(settings.endpoint);
      if (
        origin.protocol !== 'https:' ||
        origin.username ||
        origin.password ||
        origin.pathname !== '/' ||
        origin.search ||
        origin.hash ||
        !uuid(settings.installationId) ||
        settings.installationId !== settings.installationId.toLowerCase()
      )
        fail();
      this.#origin = origin.origin;
      this.#installation = settings.installationId;
      const fd = openSync(
        settings.tokenFile,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const stat = fstatSync(fd);
        if (
          !stat.isFile() ||
          stat.nlink !== 1 ||
          stat.uid !== process.getuid?.() ||
          (stat.mode & 0o077) !== 0 ||
          stat.size < 16 ||
          stat.size > 4096
        )
          fail();
        this.#token = readFileSync(fd, 'utf8').trim();
      } finally {
        closeSync(fd);
      }
      if (!/^[a-zA-Z0-9._-]{16,4096}$/.test(this.#token)) fail();
      this.#ca = readFileSync(settings.caFile);
    } catch {
      throw new LiveMaterialFailure('material_invalid');
    }
  }
  private get(path: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const unavailable = () =>
        reject(new LiveMaterialFailure('material_unavailable'));
      const req = request(
        this.#origin + '/v1/' + path,
        {
          method: 'GET',
          ca: this.#ca,
          headers: { 'X-Vault-Token': this.#token, Accept: 'application/json' },
        },
        (res) => {
          const chunks: Buffer[] = [];
          let bytes = 0;
          res.on('data', (b: Buffer) => {
            bytes += b.length;
            if (bytes > 32768) {
              req.destroy();
              unavailable();
              return;
            }
            chunks.push(b);
          });
          res.on('aborted', unavailable);
          res.on('error', unavailable);
          res.on('end', () => {
            if (res.statusCode === 404)
              return reject(new LiveMaterialFailure('material_missing'));
            if (res.statusCode === 401 || res.statusCode === 403)
              return reject(new LiveMaterialFailure('material_denied'));
            if (res.statusCode !== 200) return unavailable();
            try {
              resolve(
                JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown,
              );
            } catch {
              reject(new LiveMaterialFailure('material_invalid'));
            }
          });
        },
      );
      const timer = setTimeout(() => {
        req.destroy();
        unavailable();
      }, 5000);
      req.on('close', () => clearTimeout(timer));
      req.on('error', unavailable);
      req.end();
    });
  }
  async endpoint(binding: CredentialBinding): Promise<{ password: string }> {
    const exact = { ...binding };
    identifiers(exact, [
      'installationId',
      'extensionId',
      'operationId',
      'generationId',
    ]);
    if (exact.installationId !== this.#installation) fail();
    const material = envelope(
      await this.get(
        `myims-endpoint/data/installations/${exact.installationId}/extensions/${exact.extensionId}/operations/${exact.operationId}?version=1`,
      ),
      1,
    );
    if (
      Object.keys(material).sort().join(',') !==
        'extensionId,generationId,installationId,operationId,password' ||
      Object.entries(exact).some(([k, v]) => material[k] !== v) ||
      typeof material.password !== 'string' ||
      !/^[a-f0-9]{64}$/.test(material.password)
    )
      fail();
    return { password: material.password };
  }
  async trunk(
    reference: TrunkMaterialReference,
  ): Promise<{ username: string; password: string; realm: string }> {
    const exact = { ...reference };
    identifiers(
      {
        installationId: exact.installationId,
        credentialId: exact.credentialId,
        operationId: exact.operationId,
      },
      ['installationId', 'credentialId', 'operationId'],
    );
    if (
      Object.keys(exact).sort().join(',') !==
        'credentialId,installationId,operationId,realm,version' ||
      exact.installationId !== this.#installation ||
      !Number.isSafeInteger(exact.version) ||
      exact.version < 1 ||
      exact.version > 2147483647 ||
      (exact.realm !== null &&
        (typeof exact.realm !== 'string' ||
          !/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?$/.test(
            exact.realm,
          )))
    )
      fail();
    const material = envelope(
      await this.get(
        `myims-trunk/data/installations/${exact.installationId}/bindings/${exact.credentialId}/generations/${exact.credentialId}?version=${exact.version}`,
      ),
      exact.version,
    );
    if (
      Object.keys(material).sort().join(',') !==
        'credentialId,installationId,operationId,password,purpose,realm,username' ||
      material.installationId !== exact.installationId ||
      material.credentialId !== exact.credentialId ||
      material.operationId !== exact.operationId ||
      material.purpose !== 'outbound-digest' ||
      (exact.realm !== null && material.realm !== exact.realm) ||
      typeof material.realm !== 'string' ||
      !/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?$/.test(
        material.realm,
      ) ||
      typeof material.username !== 'string' ||
      !/^[a-zA-Z0-9_.+@-]{1,128}$/.test(material.username) ||
      typeof material.password !== 'string' ||
      !/^[\x20-\x7e]{1,1024}$/.test(material.password)
    )
      fail();
    return {
      username: material.username,
      password: material.password,
      realm: material.realm,
    };
  }
}
