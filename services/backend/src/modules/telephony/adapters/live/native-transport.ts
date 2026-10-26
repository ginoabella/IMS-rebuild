import { createServer, request as httpRequest } from 'node:http';
import { chmodSync, chownSync, lstatSync, unlinkSync } from 'node:fs';
import type { NativeOwnerPort } from './owner-executor';
import type { PbxOwnershipToken } from '../../application/observation-ports';
import type { LiveMaterial } from './materialize';
import { uuid } from '../../../identity/domain/storage';
const maximum = 4 * 1024 * 1024;
const failures = [
  'material_invalid',
  'material_missing',
  'material_denied',
  'material_unavailable',
] as const;
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new Error('Native request rejected');
  return value as Record<string, unknown>;
}
function token(value: unknown): PbxOwnershipToken {
  const v = object(value, ['nodeId', 'epoch', 'incarnation', 'desiredVersion']);
  if (
    !uuid(v.nodeId) ||
    !uuid(v.incarnation) ||
    typeof v.epoch !== 'string' ||
    !/^[1-9][0-9]{0,18}$/.test(v.epoch) ||
    !Number.isSafeInteger(v.desiredVersion) ||
    Number(v.desiredVersion) < 1
  )
    throw new Error('Native ownership rejected');
  return v as unknown as PbxOwnershipToken;
}
function material(value: unknown): LiveMaterial {
  const v = object(value, ['endpoints', 'trunks']);
  const collection = (
    entries: unknown,
    trunk: boolean,
  ): Map<string, Record<string, string>> => {
    if (!Array.isArray(entries) || entries.length > 2048)
      throw new Error('Native material rejected');
    const result = new Map<string, Record<string, string>>();
    for (const entry of entries) {
      if (
        !Array.isArray(entry) ||
        entry.length !== 2 ||
        typeof entry[0] !== 'string' ||
        !(trunk
          ? /^[a-f0-9-]{36}:[1-9][0-9]{0,9}$/.test(entry[0])
          : uuid(entry[0])) ||
        result.has(entry[0])
      )
        throw new Error('Native material rejected');
      const fields = object(
        entry[1],
        trunk ? ['username', 'password', 'realm'] : ['password'],
      );
      if (
        Object.keys(fields).length !== (trunk ? 3 : 1) ||
        Object.values(fields).some(
          (field) =>
            typeof field !== 'string' ||
            field.length < 1 ||
            field.length > 1024,
        )
      )
        throw new Error('Native material rejected');
      result.set(entry[0], fields as Record<string, string>);
    }
    return result;
  };
  return {
    endpoints: collection(v.endpoints, false) as LiveMaterial['endpoints'],
    trunks: collection(v.trunks, true) as LiveMaterial['trunks'],
  };
}
/** Root-owned Unix directory is mounted only in native and telephony containers. */
export class NativeOwnerServer {
  private readonly server;
  private active = 0;
  constructor(
    private readonly socket: string,
    private readonly application: NativeOwnerPort,
    private readonly readerGroup = 1000,
  ) {
    this.server = createServer(async (request, response) => {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Type', 'application/json');
      if (
        this.active >= 8 ||
        request.method !== 'POST' ||
        !['/connect', '/inspect', '/execute'].includes(request.url ?? '')
      ) {
        response.writeHead(503).end('{"failure":"boundary_unavailable"}');
        return;
      }
      this.active++;
      try {
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of request) {
          size += chunk.length;
          if (size > maximum) throw new Error('Native request rejected');
          chunks.push(chunk);
        }
        const input = object(
          JSON.parse(Buffer.concat(chunks).toString('utf8')),
          request.url === '/connect'
            ? ['token']
            : request.url === '/inspect'
              ? ['token', 'operationId']
              : ['token', 'operationId', 'preparation'],
        );
        const owner = token(input.token);
        if (request.url === '/connect') {
          await application.connect(owner);
          response.end('{"accepted":true}');
        } else {
          if (!uuid(input.operationId))
            throw new Error('Native request rejected');
          if (request.url === '/inspect')
            response.end(
              JSON.stringify({
                state: await application.inspect(owner, input.operationId),
              }),
            );
          else {
            let preparation: Parameters<NativeOwnerPort['execute']>[2] = null;
            if (input.preparation !== null) {
              const p = object(input.preparation, ['failure', 'material']);
              if (Object.keys(p).length !== 1)
                throw new Error('Native request rejected');
              if ('failure' in p) {
                if (!failures.includes(p.failure as (typeof failures)[number]))
                  throw new Error('Native request rejected');
                preparation = {
                  failure: p.failure as (typeof failures)[number],
                };
              } else preparation = { material: material(p.material) };
            }
            // A bounded transport acknowledgment is not installation/health proof.
            // The native application persists each actual phase under the owner fence.
            void application
              .execute(owner, input.operationId, preparation)
              .catch(() => {});
            response.writeHead(202).end('{"accepted":true}');
          }
        }
      } catch {
        if (!response.headersSent) response.writeHead(503);
        response.end('{"failure":"boundary_unavailable"}');
      } finally {
        this.active--;
      }
    });
    this.server.requestTimeout = 5000;
    this.server.headersTimeout = 3000;
    this.server.maxConnections = 8;
  }
  async start() {
    try {
      const stat = lstatSync(this.socket);
      if (!stat.isSocket() || stat.uid !== 0)
        throw new Error('Native socket unavailable');
      unlinkSync(this.socket);
    } catch (error) {
      if (
        !error ||
        typeof error !== 'object' ||
        !('code' in error) ||
        error.code !== 'ENOENT'
      )
        throw error;
    }
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.socket, () => {
        chownSync(this.socket, 0, this.readerGroup);
        chmodSync(this.socket, 0o660);
        resolve();
      });
    });
  }
  async close() {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }
}
/** Only the protected telephony consumer receives this socket mount. */
export class NativeOwnerClient implements NativeOwnerPort {
  constructor(private readonly socket: string) {}
  private async call(
    path: '/connect' | '/inspect' | '/execute',
    body: object,
  ): Promise<Record<string, unknown>> {
    const payload = Buffer.from(JSON.stringify(body));
    if (payload.length > maximum) throw new Error('Native request unavailable');
    return new Promise((resolve, reject) => {
      const deadline = setTimeout(() => {
        request.destroy();
        reject(new Error('Native boundary unavailable'));
      }, 5000);
      const request = httpRequest(
        {
          socketPath: this.socket,
          path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': payload.length,
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          let size = 0;
          response.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > 1024) request.destroy();
            else chunks.push(chunk);
          });
          response.on('end', () => {
            clearTimeout(deadline);
            try {
              if (![200, 202].includes(response.statusCode ?? 0))
                throw new Error();
              resolve(
                object(JSON.parse(Buffer.concat(chunks).toString('utf8')), [
                  'state',
                  'accepted',
                ]),
              );
            } catch {
              reject(new Error('Native boundary unavailable'));
            }
          });
          response.on('error', () => {
            clearTimeout(deadline);
            reject(new Error('Native boundary unavailable'));
          });
        },
      );
      request.on('error', () => {
        clearTimeout(deadline);
        reject(new Error('Native boundary unavailable'));
      });
      request.end(payload);
    });
  }
  async connect(owner: PbxOwnershipToken) {
    await this.call('/connect', { token: owner });
  }
  async inspect(owner: PbxOwnershipToken, operationId: string) {
    const value = await this.call('/inspect', { token: owner, operationId });
    if (!['not_started', 'pending', 'complete'].includes(String(value.state)))
      throw new Error('Native state unavailable');
    return value.state as 'not_started' | 'pending' | 'complete';
  }
  async execute(
    owner: PbxOwnershipToken,
    operationId: string,
    preparation: Parameters<NativeOwnerPort['execute']>[2],
  ) {
    await this.call('/execute', {
      token: owner,
      operationId,
      preparation:
        preparation && 'material' in preparation
          ? {
              material: {
                endpoints: [...preparation.material.endpoints],
                trunks: [...preparation.material.trunks],
              },
            }
          : preparation,
    });
  }
}
