/** These ports belong only to protected importer/verifier composition, never HTTP. */
export interface TrunkMaterialIdentity {
  installationId: string;
  bindingId: string;
  peerId: string;
  generationId: string;
  operationId: string;
  generationOrdinal: number;
  materialVersion: 1;
  purposes: ('outbound-request' | 'registration')[];
}
export interface TrunkImportMaterial {
  username: string;
  password: string;
  realm: string;
}
export type TrunkQualification = 'verified' | 'missing';
export type TrunkProviderFailure =
  | 'provider_unavailable'
  | 'access_denied'
  | 'material_invalid'
  | 'import_conflict'
  | 'token_reprovision_required';
export class TrunkProviderError extends Error {
  constructor(
    readonly code: TrunkProviderFailure,
    readonly retryable: boolean,
  ) {
    super('Protected trunk operation failed');
  }
}
export interface TrunkSecretVerifier {
  verify(identity: TrunkMaterialIdentity): Promise<TrunkQualification>;
}
export interface TrunkSecretImporter {
  import(
    identity: TrunkMaterialIdentity,
    material: TrunkImportMaterial,
  ): Promise<void>;
}
/** Cleanup authorization must be established canonically BEFORE this effect port. */
export interface TrunkSecretCleanup {
  destroy(identity: TrunkMaterialIdentity): Promise<'destroyed' | 'absent'>;
}
