import type { EndpointCredentialFailure } from '@myims/contracts';
export interface CredentialBinding {
  installationId: string;
  extensionId: string;
  operationId: string;
  generationId: string;
}
/** Material is confined to the adapter. Consumers receive proof of exact usability. */
export interface EndpointSecretProvider {
  prepare(binding: CredentialBinding): Promise<void>;
  verify(binding: CredentialBinding): Promise<'verified' | 'unavailable'>;
}
export interface EndpointSecretCleanup {
  destroy(binding: CredentialBinding): Promise<'destroyed' | 'absent'>;
}
export class CredentialProviderError extends Error {
  constructor(
    readonly code: EndpointCredentialFailure,
    readonly retryable: boolean,
  ) {
    super('Endpoint provider operation failed');
  }
}
/** P3-U5 owns associated-generation dependencies; b never retires them. */
export interface CredentialDependencyPort {
  neverAssociatedMayDestroy(binding: CredentialBinding): Promise<boolean>;
}
