// Private IPC barriers alter only the isolated production-HTTP fixture process.
export function credentialControls(load) {
  const password = load('infrastructure/password/scrypt');
  const { CredentialActionRepository } = load(
    'modules/identity/adapters/db/credential-actions',
  );
  let gate = null,
    fail = false;
  const stats = { hashes: 0, lookups: 0 };
  async function wait(stage) {
    if (gate?.stage === stage) {
      gate.entered = true;
      await gate.promise;
    }
  }
  const originalHash = password.hashPassword;
  password.hashPassword = async (...args) => {
    stats.hashes++;
    await wait('before-hash');
    if (fail) throw new Error('Fixture hash unavailable');
    const result = await originalHash(...args);
    await wait('after-hash');
    return result;
  };
  const originalFind = CredentialActionRepository.prototype.find;
  CredentialActionRepository.prototype.find = function (...args) {
    stats.lookups++;
    return originalFind.apply(this, args);
  };
  const originalTerminal = CredentialActionRepository.prototype.terminal;
  CredentialActionRepository.prototype.terminal = async function (...args) {
    await wait('before-terminal');
    return originalTerminal.apply(this, args);
  };
  return function (operation, stage) {
    if (operation === 'prepare') {
      if (gate) throw new Error('Barrier already armed');
      let release;
      const promise = new Promise((r) => {
        release = r;
      });
      gate = { stage, promise, release, entered: false };
      return { ready: true };
    }
    if (operation === 'barrier') return { entered: gate?.entered ?? false };
    if (operation === 'release') {
      gate?.release();
      gate = null;
      return { released: true };
    }
    if (operation === 'stats') return stats;
    if (operation === 'hash-failure') {
      fail = !!stage;
      return { ready: true };
    }
    return {};
  };
}
