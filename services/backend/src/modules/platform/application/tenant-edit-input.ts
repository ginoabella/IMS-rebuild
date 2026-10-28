import {
  geographyValues,
  GeographyInputError,
  GEOGRAPHY_BODY_BYTES,
} from '@myims/contracts';
import type { SaveTenantSectionDto, TenantContactsDto } from '@myims/contracts';
import {
  onlyFields,
  positiveVersion,
  uuid,
} from '../../identity/domain/storage';
import { text, type Parsed } from './draft-tenant-input';
export function tenantEditInput(input: unknown): Parsed<SaveTenantSectionDto> {
  const invalid = {
    kind: 'invalid' as const,
    fieldErrors: { body: 'Invalid section fields' },
  };
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    !onlyFields(input, [
      'requestId',
      'expectedVersion',
      'expectedAuthorityVersion',
      'section',
      'values',
      'expectedGeographyVersion',
      'ownershipConfirmed',
    ])
  )
    return invalid;
  const v = input as Record<string, unknown>;
  let bytes: number;
  try {
    bytes = Buffer.byteLength(JSON.stringify(input));
  } catch {
    return invalid;
  }
  if (bytes > (v.section === 'geography' ? GEOGRAPHY_BODY_BYTES : 4096))
    return invalid;
  if (
    !uuid(v.requestId) ||
    !positiveVersion(v.expectedVersion) ||
    !positiveVersion(v.expectedAuthorityVersion)
  )
    return invalid;
  if (!v.values || typeof v.values !== 'object' || Array.isArray(v.values))
    return invalid;
  const values = v.values as Record<string, unknown>;
  const base = {
    requestId: v.requestId.toLowerCase(),
    expectedVersion: v.expectedVersion,
    expectedAuthorityVersion: v.expectedAuthorityVersion,
  };
  if (v.section === 'geography') {
    if (
      !Number.isInteger(v.expectedGeographyVersion) ||
      Number(v.expectedGeographyVersion) < 0 ||
      Number(v.expectedGeographyVersion) >= 2147483646 ||
      typeof v.ownershipConfirmed !== 'boolean'
    )
      return invalid;
    try {
      return {
        kind: 'valid',
        value: {
          ...base,
          section: 'geography',
          expectedGeographyVersion: Number(v.expectedGeographyVersion),
          ownershipConfirmed: v.ownershipConfirmed,
          values: geographyValues(v.values),
        },
      };
    } catch (error) {
      return {
        kind: 'invalid',
        fieldErrors: {
          geography:
            error instanceof GeographyInputError
              ? error.message
              : 'Invalid geography.',
        },
      };
    }
  }
  if (
    Object.hasOwn(v, 'expectedGeographyVersion') ||
    Object.hasOwn(v, 'ownershipConfirmed')
  )
    return invalid;
  if (v.section === 'name') {
    if (!onlyFields(values, ['displayName'])) return invalid;
    if (
      !text(values.displayName, 800) ||
      !values.displayName.trim() ||
      values.displayName.trim().length > 200
    )
      return {
        kind: 'invalid',
        fieldErrors: { displayName: 'Invalid organization name' },
      };
    return {
      kind: 'valid',
      value: {
        ...base,
        section: 'name',
        values: { displayName: values.displayName.trim() },
      },
    };
  }
  if (
    v.section !== 'contacts' ||
    !Object.keys(values).length ||
    !onlyFields(values, ['name', 'email', 'phone'])
  )
    return invalid;
  const normalized: Partial<TenantContactsDto> = {};
  for (const field of ['name', 'email', 'phone'] as const) {
    if (!(field in values)) continue;
    const raw = values[field];
    if (raw === null) {
      normalized[field] = null;
      continue;
    }
    const bound = field === 'name' ? 200 : field === 'email' ? 254 : 50;
    if (!text(raw, bound * 4))
      return {
        kind: 'invalid',
        fieldErrors: { [field]: 'Invalid contact field' },
      };
    const value = raw.trim();
    if (
      value.length > bound ||
      (value &&
        (field === 'phone'
          ? !/^[0-9 +().-]+$/.test(value) || !/[0-9]/.test(value)
          : field === 'email'
            ? !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(
                value,
              ) ||
              value.slice(0, value.indexOf('@')).length > 64 ||
              value
                .slice(value.lastIndexOf('@') + 1)
                .split('.')
                .some((label) => label.length > 63) ||
              value.startsWith('.') ||
              value.includes('..') ||
              value.includes('.@')
            : false))
    )
      return {
        kind: 'invalid',
        fieldErrors: { [field]: 'Invalid contact field' },
      };
    normalized[field] = value || null;
  }
  return {
    kind: 'valid',
    value: { ...base, section: 'contacts', values: normalized },
  };
}
