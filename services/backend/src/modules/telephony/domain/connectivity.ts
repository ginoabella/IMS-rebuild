export interface PbxProfile {
  installationId: string;
  targetAlias: string;
  aliases: readonly string[];
  host: string;
  transport: string;
  port: number;
  tlsServerName: string;
  addresses: readonly string[];
  credentialAliases: readonly string[];
}
export interface ApprovedPbxCatalog {
  resolve(targetAlias: string): Readonly<PbxProfile> | null;
}
export interface PbxCredentialResolver {
  resolve(
    alias: string,
  ): Promise<
    | { kind: 'resolved'; username: string; password: string }
    | { kind: 'secret_missing' | 'secret_unavailable' }
  >;
}
export interface PbxDestinationPolicy {
  destination(
    profile: Readonly<PbxProfile>,
    signal?: AbortSignal,
  ): Promise<
    | {
        kind: 'approved';
        address: string;
        family: 4 | 6;
        port: number;
        servername: string;
      }
    | { kind: 'destination_denied' | 'resolution_unavailable' }
  >;
}
export function alias(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 128) return null;
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(normalized) ? normalized : null;
}
