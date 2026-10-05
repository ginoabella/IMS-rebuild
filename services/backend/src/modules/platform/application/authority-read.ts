import type {
  AuthorityResult,
  PlatformAuthority,
} from '../../identity/domain/authority';
export interface PlatformAuthorityRead {
  candidate(input: {
    plane: 'platform';
    username: unknown;
  }): Promise<AuthorityResult<PlatformAuthority>>;
  byId(input: {
    plane: 'platform';
    operatorId: string;
  }): Promise<AuthorityResult<PlatformAuthority>>;
}
