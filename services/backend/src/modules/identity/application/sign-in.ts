import {
  validatePassword,
  verifyPasswordOutcome,
} from '../../../infrastructure/password/scrypt';
import {
  normalizeTenantCode,
  normalizeUsername,
  onlyFields,
} from '../domain/storage';
import type { Admission, AdmissionResult } from './admission';
import type { SessionLifecycle, IssuedSession } from './session-ports';
import type { StaffAuthorityRead } from './authority-read';
import type { StaffCredentialRead } from './credential-read';
export type SignInResult =
  | IssuedSession
  | Exclude<AdmissionResult, { kind: 'admitted' }>
  | { kind: 'denied' };
export function staffSignInInput(
  value: unknown,
): { tenantCode: string; username: string; password: Buffer } | null {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !onlyFields(value, ['tenantCode', 'username', 'password'])
  )
    return null;
  const data = value as Record<string, unknown>;
  if (
    typeof data.tenantCode !== 'string' ||
    Buffer.byteLength(data.tenantCode) > 128 ||
    typeof data.username !== 'string' ||
    Buffer.byteLength(data.username) > 512 ||
    typeof data.password !== 'string' ||
    Buffer.byteLength(data.password) > 512
  )
    return null;
  const tenantCode = normalizeTenantCode(data.tenantCode);
  const username = normalizeUsername(data.username);
  const password = Buffer.from(data.password, 'utf8');
  try {
    if (
      !tenantCode ||
      !username ||
      password.toString('utf8') !== data.password ||
      Buffer.from(data.username).toString('utf8') !== data.username
    )
      throw new Error('Invalid input');
    validatePassword(password);
    return { tenantCode, username, password };
  } catch {
    password.fill(0);
    return null;
  }
}
export class StaffSignIn {
  // Reserve the complete admitted credential pipeline: DB waits must not queue plaintext.
  private verifying = false;
  constructor(
    private readonly admission: Admission,
    private readonly candidates: StaffAuthorityRead,
    private readonly credentials: StaffCredentialRead,
    private readonly lifecycle: SessionLifecycle,
  ) {}
  async execute(
    value: unknown,
    source: string | null,
    consumer: 'web' | 'mobile',
  ): Promise<SignInResult> {
    const input = staffSignInInput(value);
    if (!input) return { kind: 'invalid' };
    let capacityHeld = false;
    try {
      const admitted = await this.admission.signIn({
        plane: 'tenant',
        tenantCode: input.tenantCode,
        source,
        username: input.username,
      });
      if (admitted.kind !== 'admitted') return admitted;
      if (this.verifying) return { kind: 'unavailable' };
      this.verifying = true;
      capacityHeld = true;
      const candidate = await this.candidates.candidate({
        plane: 'tenant',
        tenantCode: input.tenantCode,
        username: input.username,
      });
      if (candidate.kind === 'unavailable') return { kind: 'unavailable' };
      const material =
        candidate.kind === 'eligible'
          ? await this.credentials.read({
              plane: 'tenant',
              tenantId: candidate.snapshot.tenantId,
              staffId: candidate.snapshot.staffId,
            })
          : { kind: 'denied' as const };
      if (material.kind === 'unavailable') return material;
      const verified = await verifyPasswordOutcome(
        input.password,
        material.kind === 'ready' ? material.credential.passwordHash : null,
      );
      if (verified.kind === 'unavailable') return verified;
      if (
        verified.kind !== 'match' ||
        candidate.kind !== 'eligible' ||
        material.kind !== 'ready' ||
        material.credential.authenticationVersion !==
          candidate.snapshot.authenticationVersion
      )
        return { kind: 'denied' };
      return await this.lifecycle.issue(
        {
          plane: 'tenant',
          tenantId: candidate.snapshot.tenantId,
          tenantAuthorityVersion: candidate.snapshot.tenantAuthorityVersion,
          identityId: candidate.snapshot.staffId,
          authenticationVersion: material.credential.authenticationVersion,
        },
        consumer,
      );
    } catch {
      return { kind: 'unavailable' };
    } finally {
      if (capacityHeld) this.verifying = false;
      input.password.fill(0);
    }
  }
}
