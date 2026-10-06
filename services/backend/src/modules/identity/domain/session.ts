import { uuid, onlyFields } from './storage';
export type SessionConsumer = 'web' | 'mobile';
export type SessionAuthority =
  | { plane: 'platform'; identityId: string; authenticationVersion: number }
  | {
      plane: 'tenant';
      identityId: string;
      authenticationVersion: number;
      tenantId: string;
      tenantAuthorityVersion: number;
    };
export type SessionRecord = SessionAuthority & {
  schema: 1;
  state: 'active';
  lifecycleId: string;
  generation: number;
  consumer: SessionConsumer;
  idleMs: number;
  createdAt: number;
  lastActivityAt: number;
  idleExpiresAt: number;
  absoluteExpiresAt: number;
};
export interface SessionReference {
  lifecycleId: string;
  generation: number;
}
export function version(n: unknown): n is number {
  return (
    typeof n === 'number' &&
    Number.isSafeInteger(n) &&
    n >= 1 &&
    n <= 2147483647
  );
}
export function authority(input: unknown): input is SessionAuthority {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const r = input as Record<string, unknown>;
  return (
    uuid(r.identityId) &&
    version(r.authenticationVersion) &&
    ((r.plane === 'platform' &&
      onlyFields(r, ['plane', 'identityId', 'authenticationVersion'])) ||
      (r.plane === 'tenant' &&
        uuid(r.tenantId) &&
        version(r.tenantAuthorityVersion) &&
        onlyFields(r, [
          'plane',
          'identityId',
          'authenticationVersion',
          'tenantId',
          'tenantAuthorityVersion',
        ])))
  );
}
export function reference(input: unknown): input is SessionReference {
  if (!input || typeof input !== 'object') return false;
  const r = input as Record<string, unknown>;
  return (
    uuid(r.lifecycleId) &&
    version(r.generation) &&
    onlyFields(r, ['lifecycleId', 'generation'])
  );
}
export function record(input: unknown): input is SessionRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const r = input as Record<string, unknown>;
  const base = [
    'schema',
    'state',
    'lifecycleId',
    'generation',
    'consumer',
    'idleMs',
    'createdAt',
    'lastActivityAt',
    'idleExpiresAt',
    'absoluteExpiresAt',
    'plane',
    'identityId',
    'authenticationVersion',
  ];
  if (
    !onlyFields(r, [
      ...base,
      ...(r.plane === 'tenant' ? ['tenantId', 'tenantAuthorityVersion'] : []),
    ])
  )
    return false;
  const facts = {
    plane: r.plane,
    identityId: r.identityId,
    authenticationVersion: r.authenticationVersion,
    ...(r.plane === 'tenant'
      ? {
          tenantId: r.tenantId,
          tenantAuthorityVersion: r.tenantAuthorityVersion,
        }
      : {}),
  };
  if (
    !authority(facts) ||
    r.schema !== 1 ||
    r.state !== 'active' ||
    !uuid(r.lifecycleId) ||
    !version(r.generation) ||
    !(r.consumer === 'web' || r.consumer === 'mobile')
  )
    return false;
  for (const key of [
    'idleMs',
    'createdAt',
    'lastActivityAt',
    'idleExpiresAt',
    'absoluteExpiresAt',
  ]) {
    const n = r[key];
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 1)
      return false;
  }
  // Scalars are validated above before arithmetic.
  const s = r as unknown as SessionRecord;
  const cap =
    s.consumer === 'web'
      ? { idle: 3600000, absolute: 43200000 }
      : { idle: 86400000, absolute: 604800000 };
  return (
    s.idleMs <= cap.idle &&
    s.createdAt <= s.lastActivityAt &&
    s.lastActivityAt < s.idleExpiresAt &&
    s.idleExpiresAt <= s.absoluteExpiresAt &&
    s.idleExpiresAt - s.lastActivityAt <= s.idleMs &&
    s.absoluteExpiresAt - s.createdAt <= cap.absolute
  );
}
export function live(r: SessionRecord, now: number): boolean {
  return (
    Number.isSafeInteger(now) &&
    now >= r.createdAt &&
    now >= r.lastActivityAt &&
    now < r.idleExpiresAt &&
    now < r.absoluteExpiresAt
  );
}
export function same(a: SessionAuthority, b: SessionAuthority): boolean {
  return (
    a.plane === b.plane &&
    a.identityId === b.identityId &&
    a.authenticationVersion === b.authenticationVersion &&
    (a.plane !== 'tenant' ||
      (b.plane === 'tenant' &&
        a.tenantId === b.tenantId &&
        a.tenantAuthorityVersion === b.tenantAuthorityVersion))
  );
}
