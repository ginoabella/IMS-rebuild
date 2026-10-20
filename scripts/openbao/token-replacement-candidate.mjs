// Investigation only. No production imports, token bytes, issuance or custody I/O.
import { AuthorizationDeadlineCandidate } from './authorization-deadline-candidate.mjs';

export class TokenReplacementCandidate {
  #clock;
  #settings;
  #current;
  #staged;
  #prior;
  #state = 'active';
  #running = 0;
  #overlapEnd;
  #priorRevoked = false;

  constructor(identity, clock, settings = {}) {
    this.#clock = clock;
    const { maximumOverlapMs = 30000, ...deadline } = settings;
    if (
      !Number.isInteger(maximumOverlapMs) ||
      maximumOverlapMs < 1 ||
      maximumOverlapMs > 60000
    )
      throw new Error('replacement_configuration');
    this.#settings = { maximumOverlapMs, deadline };
    this.#current = this.#validated(identity);
  }
  #validated(identity) {
    if (
      !Number.isInteger(identity.ttl) ||
      identity.ttl < 1 ||
      identity.ttl > 3600
    )
      throw new Error('replacement_identity_invalid');
    const expires = Date.parse(identity.expire_time);
    if (!Number.isFinite(expires))
      throw new Error('replacement_identity_invalid');
    const guard = new AuthorizationDeadlineCandidate(
      {
        ...identity,
        expire_time: new Date(
          Math.min(expires, this.#clock.wall() + identity.ttl * 1000),
        ).toISOString(),
      },
      this.#clock,
      this.#settings.deadline,
    );
    return {
      guard,
      accessor: identity.accessor,
      issued: Date.parse(identity.issue_time),
    };
  }
  status() {
    return {
      state: this.#state,
      currentTokens: 1,
      stagedCandidates: this.#staged ? 1 : 0,
      priorUnconfirmedTokens: this.#prior && !this.#priorRevoked ? 1 : 0,
    };
  }
  async run(work, budgetMs = 5000) {
    if (this.#state !== 'active')
      throw new Error('replacement_consumption_paused');
    this.#running++;
    try {
      return await this.#current.guard.run(work, budgetMs);
    } catch (error) {
      // A timed-out caller may ignore abort and still be using the old token.
      // Do not claim the old generation is idle or begin replacement afterward.
      this.#state = 'cleanup_required';
      throw error;
    } finally {
      this.#running--;
    }
  }
  stage(identity) {
    if (this.#state !== 'active' || this.#running)
      throw new Error('replacement_not_available');
    // Caller must record exact new-token custody BEFORE invoking stage, including
    // malformed identities. Rejection leaves that candidate requiring cleanup.
    this.#staged = { guard: undefined };
    this.#state = 'cleanup_required';
    this.#current.guard.check();
    const next = this.#validated(identity);
    if (
      next.accessor === this.#current.accessor ||
      next.issued <= this.#current.issued ||
      next.issued > this.#clock.wall()
    )
      throw new Error('replacement_identity_invalid');
    this.#overlapEnd = next.issued + this.#settings.maximumOverlapMs;
    if (this.#clock.wall() >= this.#overlapEnd)
      throw new Error('replacement_overlap_expired');
    this.#staged = next;
    this.#state = 'staged';
    return this.status();
  }
  async switch(revokePrior, confirmPriorRevoked, budgetMs = 5000) {
    if (this.#state !== 'staged') throw new Error('replacement_not_available');
    // Never switch while old/new local authority or overlap cannot cover cleanup.
    try {
      if (
        !Number.isFinite(budgetMs) ||
        budgetMs <= 0 ||
        this.#clock.wall() + budgetMs >= this.#overlapEnd
      )
        throw new Error('replacement_overlap_expired');
      this.#current.guard.check(budgetMs);
      this.#staged.guard.check(budgetMs);
    } catch {
      this.#state = 'cleanup_required';
      throw new Error('replacement_preflight_failed');
    }
    this.#prior = this.#current;
    this.#current = this.#staged;
    this.#staged = undefined;
    this.#state = 'switching';
    const abort = new globalThis.AbortController();
    let timer;
    try {
      await Promise.race([
        (async () => {
          // Both callbacks must be bound to the exact PRIOR token by trusted
          // composition; no accessors or bearer tokens are passed or returned.
          const revoked = await revokePrior(abort.signal);
          if (abort.signal.aborted) throw new Error();
          if (revoked?.status !== 204 && revoked?.status !== 200)
            throw new Error();
          this.#current.guard.check();
          if (this.#clock.wall() >= this.#overlapEnd) throw new Error();
          const confirmed = await confirmPriorRevoked(abort.signal);
          if (abort.signal.aborted || confirmed?.status !== 403)
            throw new Error();
          this.#priorRevoked = true;
        })(),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            abort.abort();
            reject(new Error());
          }, budgetMs);
        }),
      ]);
      this.#current.guard.check();
      if (this.#clock.wall() >= this.#overlapEnd) throw new Error();
      this.#prior = undefined;
      this.#priorRevoked = false;
      this.#state = 'active';
      return { state: 'replacement_active_prior_revoked' };
    } catch {
      this.#state = 'cleanup_required';
      throw new Error('replacement_cleanup_uncertain');
    } finally {
      clearTimeout(timer);
    }
  }
}
