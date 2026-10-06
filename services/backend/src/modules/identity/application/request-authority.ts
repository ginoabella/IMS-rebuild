import type { StaffAuthorityRead } from './authority-read';
import type { PlatformAuthorityRead } from '../../platform/application/authority-read';
import type { SessionLifecycle } from './session-ports';
import type { SessionRecord } from '../domain/session';
import {
  permissions,
  type StaffPermission,
  type StaffRole,
} from '../domain/roles';
import type { Actor } from '../../../infrastructure/execution/context';
export type Principal =
  | Readonly<{
      plane: 'platform';
      operatorId: string;
      authenticationVersion: number;
      grants: readonly ['platform_operator'];
    }>
  | Readonly<{
      plane: 'tenant';
      staffId: string;
      tenantId: string;
      authenticationVersion: number;
      tenantAuthorityVersion: number;
      roles: readonly StaffRole[];
      grants: readonly StaffPermission[];
    }>;
export type RequestAuthorityResult =
  | { kind: 'authorized'; principal: Principal; record: SessionRecord }
  | { kind: 'invalid' | 'unavailable' };
export class RequestAuthority {
  constructor(
    readonly lifecycle: SessionLifecycle,
    private readonly staff: StaffAuthorityRead,
    private readonly platform: PlatformAuthorityRead,
  ) {}
  async validate(token: unknown): Promise<RequestAuthorityResult> {
    try {
      const session = await this.lifecycle.lookup(token);
      if (session.kind !== 'found')
        return {
          kind: session.kind === 'unavailable' ? 'unavailable' : 'invalid',
        };
      const r = session.record;
      if (r.plane === 'platform') {
        const current = await this.platform.byId({
          plane: 'platform',
          operatorId: r.identityId,
        });
        if (current.kind !== 'eligible')
          return {
            kind: current.kind === 'unavailable' ? 'unavailable' : 'invalid',
          };
        const s = current.snapshot;
        if (
          s.operatorId !== r.identityId ||
          s.authenticationVersion !== r.authenticationVersion
        )
          return { kind: 'invalid' };
        return {
          kind: 'authorized',
          record: r,
          principal: Object.freeze({
            plane: 'platform',
            operatorId: s.operatorId,
            authenticationVersion: s.authenticationVersion,
            grants: Object.freeze(['platform_operator'] as const),
          }),
        };
      }
      const current = await this.staff.byId({
        plane: 'tenant',
        tenantId: r.tenantId,
        staffId: r.identityId,
      });
      if (current.kind !== 'eligible')
        return {
          kind: current.kind === 'unavailable' ? 'unavailable' : 'invalid',
        };
      const s = current.snapshot;
      if (
        s.staffId !== r.identityId ||
        s.tenantId !== r.tenantId ||
        s.authenticationVersion !== r.authenticationVersion ||
        s.tenantAuthorityVersion !== r.tenantAuthorityVersion
      )
        return { kind: 'invalid' };
      return {
        kind: 'authorized',
        record: r,
        principal: Object.freeze({
          plane: 'tenant',
          staffId: s.staffId,
          tenantId: s.tenantId,
          authenticationVersion: s.authenticationVersion,
          tenantAuthorityVersion: s.tenantAuthorityVersion,
          roles: Object.freeze([...s.roles]),
          grants: Object.freeze(permissions(s.roles)),
        }),
      };
    } catch {
      return { kind: 'unavailable' };
    }
  }
}
export function principalActor(p: Principal): Actor {
  return p.plane === 'platform'
    ? {
        kind: 'platform_operator',
        plane: 'platform',
        reference: p.operatorId,
        tenantId: null,
      }
    : {
        kind: 'tenant_staff',
        plane: 'tenant',
        reference: p.staffId,
        tenantId: p.tenantId,
      };
}
