import { geographyValues } from '@myims/contracts';
import type {
  CreateDraftTenantDto,
  SaveTenantSectionDto,
  SavedTenantSectionDto,
  TenantApiErrorDto,
  TenantDetailDto,
  TenantListDto,
  TenantSummaryDto,
} from '@myims/contracts';
import { AccessError, type AccessFailure } from '../auth/client';
import { tenantUuid } from './validation';
export class TenantError extends Error {
  constructor(
    public status: 400 | 404 | 409,
    public fields: TenantApiErrorDto['fieldErrors'] = {},
    public reason?: TenantApiErrorDto['reason'],
  ) {
    super('Tenant request failed');
  }
}
function summary(value: unknown): value is TenantSummaryDto {
  if (!value || typeof value !== 'object') return false;
  const v = value as TenantSummaryDto;
  return (
    tenantUuid(v.id) &&
    typeof v.displayName === 'string' &&
    v.displayName.length <= 200 &&
    typeof v.tenantCode === 'string' &&
    /^[a-z0-9][a-z0-9_.-]{0,63}$/.test(v.tenantCode) &&
    ['draft', 'active', 'suspended', 'retired'].includes(v.status)
  );
}
function detail(value: unknown): value is TenantDetailDto {
  if (!value || typeof value !== 'object') return false;
  const v = value as TenantDetailDto;
  if (
    !summary(v.tenant) ||
    !Number.isSafeInteger(v.tenant.version) ||
    !Number.isSafeInteger(v.tenant.authorityVersion) ||
    typeof v.tenant.createdAt !== 'string' ||
    typeof v.tenant.updatedAt !== 'string' ||
    !v.tenant.contacts ||
    !['name', 'email', 'phone'].every((k) => {
      const value = v.tenant.contacts[k as keyof typeof v.tenant.contacts];
      return value === null || typeof value === 'string';
    }) ||
    !v.administrator
  )
    return false;
  try {
    if (
      !v.tenant.geography ||
      v.tenant.geography.srid !== 4326 ||
      !Number.isInteger(v.tenant.geography.version) ||
      v.tenant.geography.version < 0
    )
      return false;
    const { area, barangays, defaults } = v.tenant.geography;
    geographyValues({ area, barangays, defaults });
  } catch {
    return false;
  }
  const a = v.administrator;
  return (
    a.kind === 'unavailable' ||
    (a.kind === 'available' &&
      tenantUuid(a.id) &&
      a.tenantId === v.tenant.id &&
      typeof a.username === 'string' &&
      /^[a-z0-9][a-z0-9_.-]{0,127}$/.test(a.username) &&
      Array.isArray(a.roles) &&
      a.roles.every((r) =>
        ['tenant_admin', 'call_taker', 'dispatcher', 'responder'].includes(r),
      ) &&
      ['active', 'disabled'].includes(a.status) &&
      ['unset', 'ready'].includes(a.credentialState))
  );
}
async function request(
  path: string,
  body?: CreateDraftTenantDto | SaveTenantSectionDto,
  proof?: string,
  missingAllowed = false,
) {
  let response: Response;
  try {
    response = await fetch(path, {
      method: body ? 'POST' : 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
      headers: {
        'Content-Type': 'application/json',
        ...(proof ? { 'X-Platform-CSRF': proof } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new AccessError(503);
  }
  if ([400, 409, ...(missingAllowed ? [404] : [])].includes(response.status)) {
    const error: unknown = await response.json().catch(() => null);
    const fields: NonNullable<TenantApiErrorDto['fieldErrors']> = {};
    let reason: TenantApiErrorDto['reason'];
    if (error && typeof error === 'object') {
      const v = error as TenantApiErrorDto;
      if (v.fieldErrors && typeof v.fieldErrors === 'object')
        for (const field of [
          'tenantCode',
          'displayName',
          'administratorUsername',
          'name',
          'email',
          'phone',
          'geography',
        ] as const)
          if (typeof v.fieldErrors[field] === 'string')
            fields[field] =
              field === 'geography'
                ? v.fieldErrors[field].slice(0, 300)
                : `Invalid ${field === 'tenantCode' ? 'tenant code' : field === 'displayName' ? 'organization name' : field === 'administratorUsername' ? 'administrator username' : `contact ${field}`}.`;
      if (
        v.reason === 'tenant_code_conflict' ||
        v.reason === 'request_conflict' ||
        v.reason === 'version_conflict' ||
        v.reason === 'eligibility_conflict'
      )
        reason = v.reason;
    }
    throw new TenantError(response.status as 400 | 404 | 409, fields, reason);
  }
  if (!(body ? [200, 201] : [200]).includes(response.status)) {
    const retry = Number(response.headers.get('retry-after'));
    throw new AccessError(
      [401, 403, 429].includes(response.status)
        ? (response.status as AccessFailure)
        : 503,
      Number.isFinite(retry) ? Math.max(1, Math.min(900, retry)) : 1,
    );
  }
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new AccessError(503);
  }
}
export async function createDraftTenant(
  body: CreateDraftTenantDto,
  proof: string,
) {
  const value = await request('/platform/tenants', body, proof);
  if (!detail(value)) throw new AccessError(503);
  return value;
}
export async function tenantDetail(id: string) {
  if (!tenantUuid(id)) throw new TenantError(400);
  const value = await request(
    `/platform/tenants/${id}`,
    undefined,
    undefined,
    true,
  );
  if (!detail(value) || value.tenant.id !== id.toLowerCase())
    throw new AccessError(503);
  return value;
}
export async function listTenants(
  after: string | null,
  search = '',
  status = '',
) {
  const value = await request(
    `/platform/tenants?limit=25&search=${encodeURIComponent(search)}${status ? `&status=${encodeURIComponent(status)}` : ''}${after ? `&after=${encodeURIComponent(after)}` : ''}`,
  );
  if (!value || typeof value !== 'object') throw new AccessError(503);
  const v = value as TenantListDto;
  if (
    !Array.isArray(v.items) ||
    v.items.length > 25 ||
    !v.items.every(summary) ||
    !(v.nextCursor === null || tenantUuid(v.nextCursor))
  )
    throw new AccessError(503);
  return v;
}

export async function saveTenantSection(
  id: string,
  body: SaveTenantSectionDto,
  proof: string,
): Promise<SavedTenantSectionDto> {
  if (!tenantUuid(id)) throw new TenantError(400);
  const value = await request(
    `/platform/tenants/${id}/configuration`,
    body,
    proof,
    true,
  );
  if (!value || typeof value !== 'object') throw new AccessError(503);
  const v = value as SavedTenantSectionDto;
  if (
    !detail(v.current) ||
    v.current.tenant.id !== id.toLowerCase() ||
    typeof v.replayed !== 'boolean' ||
    !v.outcome ||
    v.outcome.requestId !== body.requestId.toLowerCase() ||
    v.outcome.tenantId !== id.toLowerCase() ||
    v.outcome.section !== body.section ||
    !Number.isSafeInteger(v.outcome.version) ||
    !Number.isSafeInteger(v.outcome.authorityVersion) ||
    (body.section === 'geography' &&
      (!Number.isInteger(v.outcome.geographyVersion) ||
        Number(v.outcome.geographyVersion) < 1))
  )
    throw new AccessError(503);
  return v;
}
