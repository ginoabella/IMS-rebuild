import { createHash } from 'node:crypto';
import type { LimiterOperation } from '@myims/config';
import type { Principal } from './request-authority';
import { normalizeTenantCode, normalizeUsername } from '../domain/storage';
export type AdmissionResult =
  | { kind: 'admitted' }
  | { kind: 'limited'; retrySeconds: number }
  | { kind: 'invalid' | 'unavailable' };
export interface DistributedLimiter {
  consume(
    operation: LimiterOperation,
    sourceHash: string,
    identityHash: string,
  ): Promise<AdmissionResult>;
}
export function identifyingHash(parts: readonly string[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}
export class Admission {
  // At most four operations times four outcomes. Diagnostics never decide admission.
  private readonly observations = new Map<
    string,
    {
      operation: LimiterOperation;
      outcome: AdmissionResult['kind'];
      count: number;
    }
  >();
  metrics() {
    return Array.from(this.observations.values(), (value) => ({ ...value }));
  }
  private async observed(
    operation: LimiterOperation,
    work: Promise<AdmissionResult>,
  ): Promise<AdmissionResult> {
    let result: AdmissionResult;
    try {
      result = await work;
    } catch {
      result = { kind: 'unavailable' };
    }
    const name = `${operation}:${result.kind}`;
    const prior = this.observations.get(name)?.count ?? 0;
    this.observations.set(name, {
      operation,
      outcome: result.kind,
      count: Math.min(Number.MAX_SAFE_INTEGER, prior + 1),
    });
    return result;
  }
  constructor(private readonly limiter: DistributedLimiter) {}
  protected(source: string | null, p: Principal): Promise<AdmissionResult> {
    if (!source || source.length > 64)
      return this.observed(
        `${p.plane}.protected`,
        Promise.resolve({ kind: 'invalid' }),
      );
    const identity =
      p.plane === 'platform' ? [p.operatorId] : [p.tenantId, p.staffId];
    return this.observed(
      `${p.plane}.protected`,
      this.limiter.consume(
        `${p.plane}.protected`,
        identifyingHash([source]),
        identifyingHash(identity),
      ),
    );
  }
  signIn(input: {
    plane: 'platform' | 'tenant';
    source: string | null;
    username: unknown;
    tenantCode?: unknown;
  }): Promise<AdmissionResult> {
    if (
      !['platform', 'tenant'].includes(input.plane) ||
      !input.source ||
      input.source.length > 64 ||
      typeof input.username !== 'string' ||
      Buffer.byteLength(input.username) > 256 ||
      (input.plane === 'tenant' &&
        (typeof input.tenantCode !== 'string' ||
          Buffer.byteLength(input.tenantCode) > 128))
    )
      return ['platform', 'tenant'].includes(input.plane)
        ? this.observed(
            `${input.plane}.sign-in`,
            Promise.resolve({ kind: 'invalid' }),
          )
        : Promise.resolve({ kind: 'invalid' });
    const username = normalizeUsername(input.username);
    const tenant =
      input.plane === 'tenant' ? normalizeTenantCode(input.tenantCode) : null;
    if (!username || (input.plane === 'tenant' && !tenant))
      return this.observed(
        `${input.plane}.sign-in`,
        Promise.resolve({ kind: 'invalid' }),
      );
    return this.observed(
      `${input.plane}.sign-in`,
      this.limiter.consume(
        `${input.plane}.sign-in`,
        identifyingHash([input.source]),
        identifyingHash(tenant ? [tenant, username] : [username]),
      ),
    );
  }
}
