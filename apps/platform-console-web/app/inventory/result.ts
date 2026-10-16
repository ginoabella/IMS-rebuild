import type {
  EndpointProfileDetailDto,
  ExtensionDetailDto,
  ExtensionBulkResultDto,
  EndpointCredentialOperationDto,
} from '@myims/contracts';
export type InventoryMutationResult =
  | EndpointProfileDetailDto
  | ExtensionDetailDto
  | ExtensionBulkResultDto
  | EndpointCredentialOperationDto;
/** Describe the canonical result without presenting transport JSON as operator UI. */
export function describeResult(result: InventoryMutationResult): string {
  if ('extension' in result) {
    const e = result.extension;
    return `Extension ${e.number} (${e.kind}), desired ${e.administrativeStatus}, version ${e.version}. ID ${e.id}; selected profile ${e.profile.id} version ${e.profile.version}; credentials ${e.credentials.kind}; available / unallocated.`;
  }
  if ('profile' in result) {
    const p = result.profile;
    return `Profile ${p.name} (${p.kind}), version ${p.version}. ID ${p.id}. Existing extension selections remain pinned.`;
  }
  if ('items' in result) {
    return `Bulk operation ${result.operationId}: ${result.items.map((e) => `${e.number} (ID ${e.id}, version ${e.version})`).join('; ')}. Selected profile ${result.profileId} version ${result.profileVersion}; all saved as desired disabled / unallocated.`;
  }
  return `Credential ${result.action} operation ${result.operationId}: ${result.state.replaceAll('_', ' ')}. Generation ${result.generationOrdinal} (${result.generationId}); ${result.resultingVersion === null ? 'association not yet confirmed' : `resulting desired version ${result.resultingVersion}`}.`;
}
