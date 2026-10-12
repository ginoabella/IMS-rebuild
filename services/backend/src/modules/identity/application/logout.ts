import type { Admission, AdmissionResult } from './admission';
import type { RequestAuthority } from './request-authority';
export type StaffLogoutResult =
  | Exclude<AdmissionResult, { kind: 'admitted' }>
  | { kind: 'signed-out' | 'denied' };
export class StaffLogout {
  constructor(
    private readonly authority: RequestAuthority,
    private readonly admission: Admission,
  ) {}
  async execute(
    token: string | null,
    preAuthentication: boolean,
    source: string | null,
    consumer: 'web' | 'mobile',
  ): Promise<StaffLogoutResult> {
    if (!source) return { kind: 'invalid' };
    try {
      const current = token
        ? await this.authority.validate(token)
        : { kind: 'invalid' as const };
      if (current.kind === 'unavailable') return current;
      if (current.kind === 'authorized') {
        if (
          current.principal.plane !== 'tenant' ||
          current.record.consumer !== consumer ||
          preAuthentication
        )
          return { kind: 'denied' };
        const admitted = await this.admission.protected(
          source,
          current.principal,
        );
        if (admitted.kind !== 'admitted') return admitted;
        const revoked = await this.authority.lifecycle.revoke(token, {
          lifecycleId: current.record.lifecycleId,
          generation: current.record.generation,
        });
        if (revoked.kind !== 'revoked') return { kind: 'unavailable' };
      }
      return { kind: 'signed-out' };
    } catch {
      return { kind: 'unavailable' };
    }
  }
}
