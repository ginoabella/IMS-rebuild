import type {
  StaffSecureStorage,
  StaffSessionDto,
  StaffSignInDto,
} from '@myims/contracts';
import { MobileAccessError, type MobileTransport } from './transport';
export type MobileState = {
  mode: 'locked' | 'ready' | 'reauth' | 'cleanup';
  session: StaffSessionDto | null;
  message: string;
  pending: boolean;
};
// Authority stays transient; storage content never supplies local owner/role authority.
export class MobileAccess {
  private token: string | undefined;
  private orphan: string | undefined;
  private epoch = 0;
  private busy = false;
  private retryAt = 0;
  private cleanup = false;
  private revoked = false;
  private deadline: ReturnType<typeof setTimeout> | undefined;
  private state: MobileState = {
    mode: 'locked',
    session: null,
    message: 'Check stored access to continue.',
    pending: false,
  };
  constructor(
    private storage: StaffSecureStorage & {
      readForRevocation?: StaffSecureStorage['read'];
    },
    private transport: MobileTransport,
    private changed: (state: MobileState) => void,
  ) {}
  private emit(
    mode: MobileState['mode'],
    message: string,
    session: StaffSessionDto | null = null,
  ) {
    this.state = { mode, message, session, pending: this.busy };
    this.changed(this.state);
  }
  hide() {
    this.epoch++;
    clearTimeout(this.deadline);
    this.emit(
      this.cleanup ? 'cleanup' : 'locked',
      'Access is hidden. Explicitly check access to continue.',
    );
  }
  dispose() {
    this.hide();
    this.token = undefined;
  }
  private accept(session: StaffSessionDto) {
    const remaining =
      Math.min(session.idleExpiresAt, session.absoluteExpiresAt) - Date.now();
    if (remaining <= 0) throw new MobileAccessError(401);
    this.emit('ready', 'Staff access verified.', session);
    clearTimeout(this.deadline);
    this.deadline = setTimeout(
      () => {
        this.hide();
        this.emit('reauth', 'Session ended. Sign in again.');
      },
      Math.min(2147483647, remaining),
    );
  }
  private async run(operation: (epoch: number) => Promise<void>) {
    if (this.busy || Date.now() < this.retryAt) return;
    this.hide();
    this.busy = true;
    const captured = this.epoch;
    this.emit(this.cleanup ? 'cleanup' : 'locked', 'Checking access…');
    try {
      await operation(captured);
    } catch (error) {
      if (
        error instanceof MobileAccessError &&
        [429, 503].includes(error.status)
      )
        this.retryAt = Date.now() + error.retryAfter * 1000;
      if (captured === this.epoch)
        this.emit(
          this.cleanup
            ? 'cleanup'
            : error instanceof MobileAccessError &&
                [400, 401].includes(error.status)
              ? 'reauth'
              : 'locked',
          error instanceof MobileAccessError &&
            [400, 401].includes(error.status)
            ? 'Invalid credentials or session ended. Sign in again.'
            : error instanceof MobileAccessError && error.status === 429
              ? `Too many requests. Retry after ${error.retryAfter} seconds.`
              : 'Access unavailable or uncertain. Retry explicitly.',
        );
    } finally {
      this.busy = false;
      this.changed({ ...this.state, pending: false });
    }
  }
  async check() {
    await this.run(async (epoch) => {
      if (this.cleanup) {
        if (!this.token && !this.orphan && !this.revoked)
          throw new MobileAccessError(503);
        await this.reconcile();
        return;
      }
      const stored = await this.storage.read();
      if (stored.kind === 'unavailable') {
        this.cleanup = true;
        throw new MobileAccessError(503);
      }
      if (stored.kind === 'absent') {
        this.token = undefined;
        if (epoch === this.epoch) this.emit('reauth', 'Sign in to continue.');
        return;
      }
      if (stored.kind !== 'found') throw new MobileAccessError(503);
      this.token = stored.token;
      const session = await this.transport.session(stored.token);
      if (epoch === this.epoch) this.accept(session);
    });
  }
  async signIn(input: StaffSignInDto) {
    await this.run(async (epoch) => {
      if (this.cleanup) throw new MobileAccessError(503);
      // Replace only after old token has been explicitly revoked and cleaned.
      const previous = await this.storage.read();
      if (previous.kind === 'unavailable') throw new MobileAccessError(503);
      if (previous.kind === 'found') {
        this.token = previous.token;
        this.cleanup = true;
        await this.reconcile();
      }
      const result = await this.transport.signIn(input);
      this.revoked = false;
      this.orphan = result.token;
      this.cleanup = true;
      if (
        epoch !== this.epoch ||
        (await this.storage.save(result.token)) !== 'stored'
      ) {
        await this.reconcile();
        throw new MobileAccessError(503);
      }
      this.token = result.token;
      this.orphan = undefined;
      this.cleanup = false;
      const session = await this.transport.session(result.token);
      if (epoch === this.epoch) this.accept(session);
    });
  }
  private async reconcile() {
    const token = this.orphan ?? this.token;
    if (!token && !this.revoked) throw new MobileAccessError(503);
    if (!this.revoked) await this.transport.logout(token);
    this.revoked = true; // Never infer revocation from local deletion.
    this.orphan = undefined;
    this.token = undefined;
    if ((await this.storage.clear()) !== 'cleared') {
      this.cleanup = true;
      throw new MobileAccessError(503);
    }
    this.cleanup = false;
    this.emit('reauth', 'Sign-out confirmed and protected storage cleared.');
  }
  async logout() {
    await this.run(async () => {
      this.cleanup = true;
      if (!this.orphan && !this.token && !this.revoked) {
        const stored = await (this.storage.readForRevocation?.() ??
          this.storage.read());
        if (stored.kind === 'unavailable') throw new MobileAccessError(503);
        if (stored.kind === 'found') this.token = stored.token;
      }
      if (this.orphan || this.token || this.revoked) await this.reconcile();
      else {
        // A prior confirmed revoke may still require local deletion retry.
        await this.transport.logout();
        this.revoked = true;
        if ((await this.storage.clear()) !== 'cleared')
          throw new MobileAccessError(503);
        this.cleanup = false;
        this.emit(
          'reauth',
          'Local access cleared. No stored session was available to revoke.',
        );
      }
    });
  }
}
