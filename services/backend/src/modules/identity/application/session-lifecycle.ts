import { randomBytes, randomUUID, createHash } from 'node:crypto';
import type { SessionConfig } from '@myims/config';
import {
  authority,
  record,
  reference,
  live,
  same,
  type SessionAuthority,
  type SessionConsumer,
  type SessionRecord,
  type SessionReference,
} from '../domain/session';
import type {
  SessionLifecycle,
  SessionFences,
  SessionRecords,
  SessionAuthorityRead,
  LockedFence,
  SessionResult,
  IssuedSession,
  Activity,
  SessionFailure,
} from './session-ports';
function lookupKey(token: unknown): string | null {
  if (
    typeof token !== 'string' ||
    token.length !== 43 ||
    !/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(token)
  )
    return null;
  return `myims:session:v1:${createHash('sha256').update(token).digest('hex')}`;
}
function decode(raw: string | null): SessionRecord | null {
  if (!raw || Buffer.byteLength(raw) > 2048) return null;
  try {
    const r: unknown = JSON.parse(raw);
    return record(r) ? r : null;
  } catch {
    return null;
  }
}
function facts(r: SessionRecord): SessionAuthority {
  return {
    plane: r.plane,
    identityId: r.identityId,
    authenticationVersion: r.authenticationVersion,
    ...(r.plane === 'tenant'
      ? {
          tenantId: r.tenantId,
          tenantAuthorityVersion: r.tenantAuthorityVersion,
        }
      : {}),
  } as SessionAuthority;
}
export class SharedSessionLifecycle implements SessionLifecycle {
  constructor(
    private readonly records: SessionRecords,
    private readonly fences: SessionFences,
    private readonly canonical: SessionAuthorityRead,
    private readonly config: SessionConfig,
  ) {}
  async issue(
    verified: SessionAuthority,
    consumer: SessionConsumer,
  ): Promise<IssuedSession> {
    if (!authority(verified) || !['web', 'mobile'].includes(consumer))
      return { kind: 'invalid' };
    try {
      const current = await this.canonical.current(verified);
      if (current.kind === 'unavailable') return { kind: 'unavailable' };
      if (current.kind !== 'eligible' || !same(verified, current.authority))
        return { kind: 'conflict' };
      const token = randomBytes(32).toString('base64url');
      const key = lookupKey(token);
      if (!key) return { kind: 'unavailable' };
      const lifecycleId = randomUUID();
      return await this.fences.lock(lifecycleId, async (f) => {
        const now = await f.now();
        const policy = this.config[consumer];
        const r: SessionRecord = {
          ...current.authority,
          schema: 1,
          state: 'active',
          lifecycleId,
          generation: 1,
          consumer,
          idleMs: policy.idleMs,
          createdAt: now,
          lastActivityAt: now,
          idleExpiresAt: now + policy.idleMs,
          absoluteExpiresAt: now + policy.absoluteMs,
        };
        // The durable lock and the record must identify the same lifecycle.
        return this.createLocked(token, key, r, f);
      });
    } catch {
      return { kind: 'unavailable' };
    }
  }
  private async createLocked(
    token: string,
    key: string,
    r: SessionRecord,
    f: LockedFence,
  ): Promise<IssuedSession> {
    if (!record(r)) return { kind: 'invalid' };
    await f.create(r.absoluteExpiresAt);
    const now = await f.now();
    if (!(await this.records.create(key, r, now)))
      return { kind: 'unavailable' };
    const durable = await f.read();
    if (
      !durable ||
      durable.revoked ||
      durable.generation !== r.generation ||
      !live(r, await f.now())
    )
      return { kind: 'unavailable' };
    return { kind: 'issued', token, record: r };
  }
  private async validated(
    key: string,
    f: LockedFence,
    expected?: SessionReference,
  ) {
    const raw = await this.records.get(key);
    const r = decode(raw);
    if (
      !r ||
      (expected &&
        (expected.lifecycleId !== r.lifecycleId ||
          expected.generation !== r.generation))
    )
      return null;
    const durable = await f.read();
    const now = await f.now();
    if (
      !durable ||
      durable.revoked ||
      durable.generation !== r.generation ||
      durable.absoluteExpiresAt !== r.absoluteExpiresAt ||
      !live(r, now)
    )
      return null;
    return { raw: raw as string, record: r, now };
  }
  async lookup(token: unknown): Promise<SessionResult> {
    const key = lookupKey(token);
    if (!key) return { kind: 'invalid' };
    try {
      const r = decode(await this.records.get(key));
      if (!r) return { kind: 'invalid' };
      return await this.fences.lock(r.lifecycleId, async (f) => {
        const value = await this.validated(key, f, {
          lifecycleId: r.lifecycleId,
          generation: r.generation,
        });
        return value
          ? { kind: 'found', record: value.record }
          : { kind: 'invalid' };
      });
    } catch {
      return { kind: 'unavailable' };
    }
  }
  async renew(
    token: unknown,
    expected: SessionReference,
    activity: Activity,
  ): Promise<SessionResult> {
    const key = lookupKey(token);
    if (!key || !reference(expected)) return { kind: 'invalid' };
    if (activity === 'unavailable') return { kind: 'unavailable' };
    if (activity !== 'successful-operational') return { kind: 'invalid' };
    try {
      return await this.fences.lock(expected.lifecycleId, async (f) => {
        const v = await this.validated(key, f, expected);
        if (!v) return { kind: 'invalid' };
        const current = await this.canonical.current(facts(v.record));
        if (current.kind === 'unavailable') return { kind: 'unavailable' };
        if (
          current.kind !== 'eligible' ||
          !same(facts(v.record), current.authority)
        )
          return { kind: 'invalid' };
        const now = await f.now();
        if (!live(v.record, now)) return { kind: 'invalid' };
        const next = {
          ...v.record,
          lastActivityAt: now,
          idleExpiresAt: Math.min(
            now + v.record.idleMs,
            v.record.absoluteExpiresAt,
          ),
        };
        if (!(await this.records.renew(key, v.raw, next, now)))
          return { kind: 'conflict' };
        const durable = await f.read();
        if (
          !durable ||
          durable.revoked ||
          durable.generation !== next.generation ||
          !live(next, await f.now())
        )
          return { kind: 'unavailable' };
        return { kind: 'found', record: next };
      });
    } catch {
      return { kind: 'unavailable' };
    }
  }
  async rotate(
    token: unknown,
    expected: SessionReference,
  ): Promise<IssuedSession> {
    const key = lookupKey(token);
    if (!key || !reference(expected)) return { kind: 'invalid' };
    try {
      return await this.fences.lock(expected.lifecycleId, async (f) => {
        const v = await this.validated(key, f, expected);
        if (!v) return { kind: 'conflict' };
        const current = await this.canonical.current(facts(v.record));
        if (current.kind === 'unavailable') return { kind: 'unavailable' };
        if (
          current.kind !== 'eligible' ||
          !same(facts(v.record), current.authority)
        )
          return { kind: 'invalid' };
        const now = await f.now();
        if (!live(v.record, now)) return { kind: 'invalid' };
        const replacement = randomBytes(32).toString('base64url');
        const newKey = lookupKey(replacement);
        if (!newKey || !(await f.advance(expected.generation)))
          return { kind: 'conflict' };
        const next = { ...v.record, generation: v.record.generation + 1 };
        if (
          !(await this.records.rotate(key, newKey, v.raw, next, await f.now()))
        )
          return { kind: 'unavailable' };
        const durable = await f.read();
        if (
          !durable ||
          durable.revoked ||
          durable.generation !== next.generation ||
          !live(next, await f.now())
        )
          return { kind: 'unavailable' };
        return { kind: 'rotated', token: replacement, record: next };
      });
    } catch {
      return { kind: 'unavailable' };
    }
  }
  async revoke(
    token: unknown,
    expected: SessionReference,
  ): Promise<SessionFailure | { kind: 'revoked' }> {
    const key = lookupKey(token);
    if (!key || !reference(expected)) return { kind: 'invalid' };
    try {
      return await this.fences.lock(expected.lifecycleId, async (f) => {
        const raw = await this.records.get(key);
        const r = decode(raw);
        if (
          raw &&
          (!r ||
            r.lifecycleId !== expected.lifecycleId ||
            r.generation !== expected.generation)
        )
          return { kind: 'invalid' };
        // A trusted reference permits durable revocation even if Redis lost the key.
        // A stale reference intentionally revokes the whole lineage, including a replacement.
        await f.revoke();
        await this.records.delete(key);
        return { kind: 'revoked' };
      });
    } catch {
      return { kind: 'unavailable' };
    }
  }
  async cleanupExpired(
    limit: number,
  ): Promise<SessionFailure | { kind: 'cleaned'; count: number }> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      return { kind: 'invalid' };
    try {
      return { kind: 'cleaned', count: await this.fences.cleanup(limit) };
    } catch {
      return { kind: 'unavailable' };
    }
  }
  // Canonical version changes must commit first. Later owners supply bounded
  // trusted token/reference batches; no identity key index or unbounded scan.
  async cleanupInvalidated(
    items: ReadonlyArray<{ token: unknown; reference: SessionReference }>,
  ) {
    if (items.length > 100) return { kind: 'invalid' as const };
    for (const item of items) {
      const result = await this.revoke(item.token, item.reference);
      if (result.kind !== 'revoked') return result;
    }
    return { kind: 'revoked' as const };
  }
}
