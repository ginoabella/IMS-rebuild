import type {
  SessionAuthority,
  SessionConsumer,
  SessionRecord,
  SessionReference,
} from '../domain/session';
export type SessionFailure = { kind: 'invalid' | 'conflict' | 'unavailable' };
export type SessionResult =
  SessionFailure | { kind: 'found'; record: SessionRecord };
export type IssuedSession =
  | SessionFailure
  | { kind: 'issued' | 'rotated'; token: string; record: SessionRecord };
export type Activity =
  'successful-operational' | 'denied' | 'failed' | 'unavailable' | 'passive';
// Backend-only: owning sign-in verifies credentials before supplying this snapshot.
export interface SessionLifecycle {
  cleanupExpired(
    limit: number,
  ): Promise<SessionFailure | { kind: 'cleaned'; count: number }>;
  cleanupInvalidated(
    items: ReadonlyArray<{ token: unknown; reference: SessionReference }>,
  ): Promise<SessionFailure | { kind: 'revoked' }>;
  issue(
    verified: SessionAuthority,
    consumer: SessionConsumer,
  ): Promise<IssuedSession>;
  lookup(token: unknown): Promise<SessionResult>;
  renew(
    token: unknown,
    expected: SessionReference,
    activity: Activity,
  ): Promise<SessionResult>;
  rotate(token: unknown, expected: SessionReference): Promise<IssuedSession>;
  // expected is obtained by trusted backend lookup, never selected by clients.
  revoke(
    token: unknown,
    expected: SessionReference,
  ): Promise<SessionFailure | { kind: 'revoked' }>;
}
export interface SessionAuthorityRead {
  current(
    authority: SessionAuthority,
  ): Promise<
    | { kind: 'eligible'; authority: SessionAuthority }
    | { kind: 'denied' | 'unavailable' }
  >;
}
export interface SessionRecords {
  get(key: string): Promise<string | null>;
  create(key: string, record: SessionRecord, now: number): Promise<boolean>;
  renew(
    key: string,
    previous: string,
    next: SessionRecord,
    now: number,
  ): Promise<boolean>;
  rotate(
    oldKey: string,
    newKey: string,
    previous: string,
    next: SessionRecord,
    now: number,
  ): Promise<boolean>;
  delete(key: string): Promise<void>;
}
export interface DurableFence {
  generation: number;
  revoked: boolean;
  absoluteExpiresAt: number;
}
export interface LockedFence {
  now(): Promise<number>;
  read(): Promise<DurableFence | null>;
  create(absoluteExpiresAt: number): Promise<void>;
  advance(expected: number): Promise<boolean>;
  revoke(): Promise<void>;
}
export interface SessionFences {
  lock<T>(id: string, action: (fence: LockedFence) => Promise<T>): Promise<T>;
  cleanup(limit: number): Promise<number>;
}
