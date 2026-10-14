import type { PbxApiErrorDto, PbxInputField } from '@myims/contracts';
import { onlyFields, uuid } from '../../identity/domain/storage';
import {
  alias,
  type ApprovedPbxCatalog,
  type PbxProfile,
} from '../domain/connectivity';
export type InvalidPbx = {
  kind: 'invalid';
  fieldErrors: NonNullable<PbxApiErrorDto['fieldErrors']>;
};
export interface DesiredPbx {
  displayName: string;
  profile: Readonly<PbxProfile>;
  credentialAlias: string;
}
export function invalid(field: PbxInputField): InvalidPbx {
  return { kind: 'invalid', fieldErrors: { [field]: 'Invalid PBX field' } };
}
function validText(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 800) return false;
  // eslint-disable-next-line no-control-regex -- forbid controls before trimming.
  if (/[\u0000-\u001f\u007f-\u009f]/u.test(value)) return false;
  for (let i = 0; i < value.length; i++) {
    const n = value.charCodeAt(i);
    if (n >= 0xd800 && n <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (n >= 0xdc00 && n <= 0xdfff) return false;
  }
  return true;
}
export function desiredInput(
  input: unknown,
  catalog: ApprovedPbxCatalog,
  edit: boolean,
):
  | InvalidPbx
  | {
      kind: 'valid';
      value: DesiredPbx;
      requestId: string;
      expectedVersion: number;
    } {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    !onlyFields(input, [
      edit ? 'expectedVersion' : 'requestId',
      'displayName',
      'management',
      'credentialAlias',
    ])
  )
    return invalid('body');
  const data = input as Record<string, unknown>;
  if (
    edit
      ? !(
          typeof data.expectedVersion === 'number' &&
          Number.isSafeInteger(data.expectedVersion) &&
          data.expectedVersion > 0
        )
      : !uuid(data.requestId)
  )
    return invalid(edit ? 'expectedVersion' : 'requestId');
  if (
    !validText(data.displayName) ||
    !data.displayName.trim() ||
    data.displayName.trim().length > 200
  )
    return invalid('displayName');
  const management = data.management;
  if (
    !management ||
    typeof management !== 'object' ||
    Array.isArray(management) ||
    !onlyFields(management, ['targetAlias', 'transport', 'port'])
  )
    return invalid('management');
  const descriptor = management as Record<string, unknown>;
  const target = alias(descriptor.targetAlias);
  const profile = target ? catalog.resolve(target) : null;
  if (
    !profile ||
    descriptor.transport !== profile.transport ||
    descriptor.port !== profile.port
  )
    return invalid('management');
  const credential = alias(data.credentialAlias);
  if (!credential || !profile.credentialAliases.includes(credential))
    return invalid('credentialAlias');
  return {
    kind: 'valid',
    value: {
      displayName: data.displayName.trim(),
      profile,
      credentialAlias: credential,
    },
    requestId:
      typeof data.requestId === 'string' ? data.requestId.toLowerCase() : '',
    expectedVersion:
      typeof data.expectedVersion === 'number' ? data.expectedVersion : 0,
  };
}
export function listInput(
  input: unknown,
): InvalidPbx | { kind: 'valid'; limit: number; after: string | null } {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    !onlyFields(input, ['limit', 'after'])
  )
    return invalid('body');
  const data = input as Record<string, unknown>;
  const limit =
    data.limit === undefined
      ? 25
      : typeof data.limit === 'string' && /^[1-9][0-9]{0,2}$/.test(data.limit)
        ? Number(data.limit)
        : 0;
  if (limit < 1 || limit > 100) return invalid('limit');
  if (data.after !== undefined && !uuid(data.after)) return invalid('after');
  return {
    kind: 'valid',
    limit,
    after: typeof data.after === 'string' ? data.after.toLowerCase() : null,
  };
}
