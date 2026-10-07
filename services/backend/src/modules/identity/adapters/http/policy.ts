import { SetMetadata } from '@nestjs/common';
import type { StaffPermission } from '../../domain/roles';
export const HTTP_POLICY = Symbol('HTTP_POLICY');
export type HttpPolicy =
  | { access: 'public' }
  | {
      access: 'protected';
      channel: 'bearer' | 'platform-cookie';
      plane: 'platform';
      sourceFailureStatus?: 403;
      permissions: readonly ['platform_operator'];
      activity: 'passive' | 'operational';
    }
  | {
      access: 'protected';
      channel: 'bearer';
      plane: 'tenant';
      permissions: readonly [StaffPermission, ...StaffPermission[]];
      activity: 'passive' | 'operational';
    };
export const HttpAccess = (policy: HttpPolicy) =>
  SetMetadata(HTTP_POLICY, Object.freeze(policy));
