import {
  validatePassword,
  verifyPasswordOutcome,
} from '../../../infrastructure/password/scrypt';
import { normalizeUsername, onlyFields } from '../../identity/domain/storage';
import type {
  Admission,
  AdmissionResult,
} from '../../identity/application/admission';
import type {
  SessionLifecycle,
  IssuedSession,
} from '../../identity/application/session-ports';
import type { PlatformAuthorityRead } from './authority-read';
import type { PlatformCredentialRead } from './credential-read';
export type SignInResult =
  | IssuedSession
  | Exclude<AdmissionResult, { kind: 'admitted' }>
  | { kind: 'denied' };
export function signInInput(
  value: unknown,
): { username: string; password: Buffer } | null {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !onlyFields(value, ['username', 'password'])
  )
    return null;
  const data = value as Record<string, unknown>;
  if (
    typeof data.username !== 'string' ||
    Buffer.byteLength(data.username) > 512 ||
    typeof data.password !== 'string' ||
    Buffer.byteLength(data.password) > 512
  )
    return null;
  const username = normalizeUsername(data.username);
  const password = Buffer.from(data.password, 'utf8');
  try {
    if (
      !username ||
      password.toString('utf8') !== data.password ||
      Buffer.from(data.username).toString('utf8') !== data.username
    )
      throw new Error('Invalid input');
    validatePassword(password);
    return { username, password };
  } catch {
    password.fill(0);
    return null;
  }
}
export class PlatformSignIn {
  // Reserve the complete admitted credential pipeline: DB waits must not queue plaintext.
  private verifying = false;
  constructor(
    private readonly admission: Admission,
    private readonly candidates: PlatformAuthorityRead,
    private readonly credentials: PlatformCredentialRead,
    private readonly lifecycle: SessionLifecycle,
  ) {}
  async execute(value: unknown, source: string | null): Promise<SignInResult> {
    const input = signInInput(value);
    if (!input) return { kind: 'invalid' };
    let capacityHeld = false;
    try {
      const admitted = await this.admission.signIn({
        plane: 'platform',
        source,
        username: input.username,
      });
      if (admitted.kind !== 'admitted') return admitted;
      if (this.verifying) return { kind: 'unavailable' };
      this.verifying = true;
      capacityHeld = true;
      const candidate = await this.candidates.candidate({
        plane: 'platform',
        username: input.username,
      });
      if (candidate.kind === 'unavailable') return { kind: 'unavailable' };
      const material =
        candidate.kind === 'eligible'
          ? await this.credentials.read({
              plane: 'platform',
              operatorId: candidate.snapshot.operatorId,
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
          plane: 'platform',
          identityId: candidate.snapshot.operatorId,
          authenticationVersion: material.credential.authenticationVersion,
        },
        'web',
      );
    } catch {
      return { kind: 'unavailable' };
    } finally {
      if (capacityHeld) this.verifying = false;
      input.password.fill(0);
    }
  }
}
