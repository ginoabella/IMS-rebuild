// Investigation only: never imported by a production entrypoint or retained helper.
// A trusted composition must fix these bounds and independently attest clock health.
export class AuthorizationDeadlineCandidate {
  #clock;
  #wall;
  #mono;
  #lastMono;
  #identity;
  #absolute;
  #lease;
  #blocked = false;
  #paused = false;
  #pauseEpoch = 0;
  #reconciliationAttempts = 0;
  #reconciling = false;
  #settings;
  constructor(identity, clock, settings = {}) {
    this.#settings = {
      maximumSeconds: 86400,
      skewBoundMs: 2000,
      safetyMarginMs: 3000,
      clockDivergenceMs: 250,
      minimumRenewalSeconds: 60,
      maximumReconciliationAttempts: 2,
      expectedPolicy: undefined,
      ...settings,
    };
    this.#clock = clock;
    this.#wall = clock.wall();
    this.#mono = this.#lastMono = clock.monotonic();
    if (
      typeof this.#settings.expectedPolicy !== 'string' ||
      !/^[a-z0-9_-]{1,128}$/.test(this.#settings.expectedPolicy)
    )
      this.#fail('deadline_configuration');
    for (const value of Object.entries(this.#settings)
      .filter(([key]) => key !== 'expectedPolicy')
      .map(([, value]) => value))
      if (!Number.isFinite(value) || value <= 0)
        this.#fail('deadline_configuration');
    if (
      !Number.isFinite(this.#wall) ||
      !Number.isFinite(this.#mono) ||
      !clock.healthy()
    )
      this.#fail('deadline_clock_untrusted');
    if (
      !Number.isInteger(this.#settings.maximumSeconds) ||
      this.#settings.maximumSeconds > 86400 ||
      !Number.isInteger(this.#settings.maximumReconciliationAttempts) ||
      this.#settings.maximumReconciliationAttempts > 3
    )
      this.#fail('deadline_configuration');
    this.#identity = this.#validate(identity);
    const margin = this.#settings.skewBoundMs + this.#settings.safetyMarginMs;
    // creation_time is rounded down: restart never resets original issuance time.
    this.#absolute =
      identity.creation_time * 1000 +
      this.#settings.maximumSeconds * 1000 -
      margin;
    this.#lease = Date.parse(identity.expire_time) - margin;
    this.check();
  }
  #fail(code) {
    this.#blocked = true;
    throw new Error(code);
  }
  #validate(d) {
    const issued = Date.parse(d?.issue_time);
    const expires = Date.parse(d?.expire_time);
    if (
      !d ||
      !Number.isFinite(issued) ||
      !Number.isFinite(expires) ||
      !Number.isInteger(d.creation_time) ||
      Math.floor(issued / 1000) !== d.creation_time ||
      d.explicit_max_ttl !== this.#settings.maximumSeconds ||
      d.orphan !== true ||
      d.renewable !== true ||
      d.type !== 'service' ||
      (d.period ?? 0) !== 0 ||
      !Array.isArray(d.policies) ||
      d.policies.length !== 1 ||
      d.policies[0] !== this.#settings.expectedPolicy ||
      !Array.isArray(d.identity_policies ?? []) ||
      (d.identity_policies?.length ?? 0) !== 0 ||
      typeof d.accessor !== 'string' ||
      !d.accessor ||
      expires <= issued
    )
      this.#fail('deadline_identity_invalid');
    return JSON.stringify([
      d.accessor,
      d.creation_time,
      d.issue_time,
      d.explicit_max_ttl,
      d.policies,
    ]);
  }
  remainingMs() {
    return this.#remainingMs();
  }
  #remainingMs(allowPaused = false) {
    if (this.#blocked) throw new Error('deadline_paused');
    if (this.#paused && !allowPaused) throw new Error('deadline_paused');
    const wall = this.#clock.wall(),
      mono = this.#clock.monotonic();
    if (
      !Number.isFinite(wall) ||
      !Number.isFinite(mono) ||
      !this.#clock.healthy() ||
      mono < this.#lastMono ||
      Math.abs(wall - (this.#wall + mono - this.#mono)) >
        this.#settings.clockDivergenceMs
    )
      this.#fail('deadline_clock_untrusted');
    this.#lastMono = mono;
    const now = Math.max(wall, this.#wall + mono - this.#mono);
    return Math.min(this.#absolute, this.#lease) - now;
  }
  check(budgetMs = 0) {
    this.#check(budgetMs);
  }
  #check(budgetMs = 0, allowPaused = false) {
    if (!Number.isFinite(budgetMs) || budgetMs < 0)
      this.#fail('deadline_budget_invalid');
    const remaining = this.#remainingMs(allowPaused);
    if (remaining <= 0) this.#fail('deadline_reprovision_required');
    if (remaining <= budgetMs) throw new Error('deadline_reprovision_required');
  }
  observeRenewal(response, identity) {
    this.check();
    const lease = response?.value?.auth?.lease_duration;
    if (response?.status === 403 || response?.status === 404)
      this.#fail('deadline_authority_revoked');
    if (
      response?.status !== 200 ||
      !Number.isInteger(lease) ||
      lease < this.#settings.minimumRenewalSeconds ||
      lease > Math.min(3600, this.#settings.maximumSeconds) ||
      response.value.auth.renewable !== true
    )
      this.#pause();
    if (this.#validate(identity) !== this.#identity)
      this.#fail('deadline_identity_changed');
    this.#lease =
      Date.parse(identity.expire_time) -
      this.#settings.skewBoundMs -
      this.#settings.safetyMarginMs;
    this.check();
  }
  renewalUnavailable() {
    this.#check(0, true);
    this.#pause();
  }
  #pause() {
    this.#paused = true;
    this.#pauseEpoch++;
    throw new Error('deadline_renewal_uncertain');
  }
  async reconcile(lookupSelf, budgetMs = 5000) {
    // Investigation only: composition must bind lookupSelf to the SAME token.
    // This path never renews, issues or swaps a token. Consumption stays paused.
    if (!this.#paused || this.#blocked)
      throw new Error('deadline_reconciliation_unavailable');
    if (this.#reconciling)
      throw new Error('deadline_reconciliation_in_progress');
    this.#check(budgetMs, true);
    if (
      this.#reconciliationAttempts >=
      this.#settings.maximumReconciliationAttempts
    )
      this.#fail('deadline_reconciliation_exhausted');
    this.#reconciliationAttempts++;
    this.#reconciling = true;
    const epoch = this.#pauseEpoch;
    const abort = new globalThis.AbortController();
    let timer;
    try {
      const response = await Promise.race([
        Promise.resolve().then(() => lookupSelf(abort.signal)),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            abort.abort();
            reject(new Error('deadline_reconciliation_uncertain'));
          }, budgetMs);
        }),
      ]);
      // Both the old lease and original maximum must still be valid. A late
      // lookup cannot resurrect authority, even if the provider reports it live.
      this.#check(0, true);
      if (epoch !== this.#pauseEpoch)
        throw new Error('deadline_reconciliation_uncertain');
      if (response?.status === 403 || response?.status === 404)
        this.#fail('deadline_authority_revoked');
      if (response?.status !== 200)
        throw new Error('deadline_reconciliation_uncertain');
      const identity = response.value?.data;
      if (this.#validate(identity) !== this.#identity)
        this.#fail('deadline_identity_changed');
      if (
        !Number.isInteger(identity.ttl) ||
        identity.ttl < 1 ||
        identity.ttl > Math.min(3600, this.#settings.maximumSeconds)
      )
        this.#fail('deadline_identity_invalid');
      const lease =
        Date.parse(identity.expire_time) -
        this.#settings.skewBoundMs -
        this.#settings.safetyMarginMs;
      // Validate the proposed bound before changing authority or unpausing.
      const priorLease = this.#lease;
      this.#lease = Math.min(
        lease,
        this.#clock.wall() +
          identity.ttl * 1000 -
          this.#settings.skewBoundMs -
          this.#settings.safetyMarginMs,
      );
      try {
        this.#check(0, true);
      } catch (error) {
        this.#lease = priorLease;
        throw error;
      }
      this.#paused = false;
      return { state: 'same_token_reconciled' };
    } finally {
      clearTimeout(timer);
      this.#reconciling = false;
    }
  }
  async run(work, budgetMs = 5000) {
    this.check(budgetMs);
    const abort = new globalThis.AbortController();
    let timer;
    try {
      const value = await Promise.race([
        Promise.resolve().then(() => work(abort.signal)),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            abort.abort();
            reject(new Error('deadline_request_uncertain'));
          }, budgetMs);
        }),
      ]);
      // A late response or blocked event loop cannot authorize finalization.
      this.check();
      return value;
    } finally {
      clearTimeout(timer);
    }
  }
}
