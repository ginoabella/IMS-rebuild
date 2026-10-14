import { readFileSync, statSync } from 'node:fs';
import { isIP } from 'node:net';
import { ConfigurationError } from '@myims/config';
import { onlyFields, uuid } from '../../../identity/domain/storage';
import {
  alias,
  type ApprovedPbxCatalog,
  type PbxProfile,
} from '../../domain/connectivity';
function fail(): never {
  throw new ConfigurationError('PBX catalog is invalid or unavailable');
}
function name(value: unknown): value is string {
  return (
    typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}$/.test(value)
  );
}
export class FilePbxCatalog implements ApprovedPbxCatalog {
  private readonly targets = new Map<string, Readonly<PbxProfile>>();
  constructor(file?: string) {
    if (!file) return;
    try {
      if (statSync(file).size > 65536) fail();
      const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
      if (!Array.isArray(data) || data.length > 100) fail();
      const endpoints = new Map<string, string>();
      for (const item of data) {
        if (
          !item ||
          typeof item !== 'object' ||
          Array.isArray(item) ||
          !onlyFields(item, [
            'installationId',
            'targetAlias',
            'aliases',
            'host',
            'transport',
            'port',
            'tlsServerName',
            'addresses',
            'credentialAliases',
          ])
        )
          fail();
        const p = item as Record<string, unknown>;
        if (
          !uuid(p.installationId) ||
          alias(p.targetAlias) !== p.targetAlias ||
          !name(p.host) ||
          !name(p.tlsServerName) ||
          typeof p.transport !== 'string' ||
          !/^[a-z][a-z0-9-]{0,31}$/.test(p.transport) ||
          typeof p.port !== 'number' ||
          !Number.isInteger(p.port) ||
          p.port < 1 ||
          p.port > 65535
        )
          fail();
        if (
          !Array.isArray(p.aliases) ||
          p.aliases.length > 32 ||
          !p.aliases.every((a) => alias(a) === a)
        )
          fail();
        if (
          !Array.isArray(p.credentialAliases) ||
          p.credentialAliases.length < 1 ||
          p.credentialAliases.length > 32 ||
          !p.credentialAliases.every((a) => alias(a) === a)
        )
          fail();
        if (
          !Array.isArray(p.addresses) ||
          p.addresses.length < 1 ||
          p.addresses.length > 32 ||
          !p.addresses.every((a) => typeof a === 'string' && isIP(a) !== 0)
        )
          fail();
        const profile: Readonly<PbxProfile> = Object.freeze({
          installationId: p.installationId.toLowerCase(),
          targetAlias: p.targetAlias as string,
          aliases: Object.freeze([...p.aliases]),
          host: p.host.toLowerCase(),
          transport: p.transport,
          port: p.port,
          tlsServerName: p.tlsServerName.toLowerCase(),
          addresses: Object.freeze([...p.addresses]),
          credentialAliases: Object.freeze([...p.credentialAliases]),
        });
        const endpoint = JSON.stringify([
          profile.host,
          profile.transport,
          profile.port,
        ]);
        if (
          endpoints.has(endpoint) &&
          endpoints.get(endpoint) !== profile.installationId
        )
          fail();
        endpoints.set(endpoint, profile.installationId);
        for (const a of [profile.targetAlias, ...profile.aliases]) {
          if (this.targets.has(a)) fail();
          this.targets.set(a, profile);
        }
      }
    } catch {
      fail();
    }
  }
  resolve(targetAlias: string) {
    return this.targets.get(targetAlias) ?? null;
  }
}
