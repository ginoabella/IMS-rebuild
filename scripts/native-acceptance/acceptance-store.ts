// Copied only into the isolated acceptance app; never imported by responder-mobile.
import * as RealSecureStore from 'expo-secure-store';

export type StorageFault = 'none' | 'write' | 'delete' | 'interrupt';
let fault: StorageFault = 'none';
let changed: ((message: string) => void) | undefined;
const history: string[] = [];
// Only callers' finite operation labels enter this UI; never values/errors/headers.
export function recordAcceptance(message: string) {
  history.push(message);
  if (history.length > 10) history.shift();
  changed?.(history.join('\n'));
}
async function storageOperation<T>(label: string, operation: () => Promise<T>) {
  recordAcceptance(`${label}: started`);
  try {
    const result = await operation();
    recordAcceptance(`${label}: completed`);
    return result;
  } catch (error) {
    recordAcceptance(`${label}: failed`);
    throw error;
  }
}
const keyLabel = (key: string) =>
  key.endsWith('.pending')
    ? 'pending marker'
    : key.endsWith('.token')
      ? 'token'
      : 'other';
export function observeFault(listener: (message: string) => void) {
  changed = listener;
  if (history.length) listener(history.join('\n'));
  return () => {
    if (changed === listener) changed = undefined;
  };
}
export function armFault(next: StorageFault) {
  fault = next;
  history.length = 0;
  recordAcceptance(`Armed: ${next}. No operation has run yet.`);
}
export const SecureStore = {
  ...RealSecureStore,
  async isAvailableAsync() {
    return storageOperation('storage availability', () =>
      RealSecureStore.isAvailableAsync(),
    );
  },
  async getItemAsync(
    key: string,
    options?: RealSecureStore.SecureStoreOptions,
  ) {
    return storageOperation(`read ${keyLabel(key)}`, () =>
      RealSecureStore.getItemAsync(key, options),
    );
  },
  async setItemAsync(
    key: string,
    value: string,
    options?: RealSecureStore.SecureStoreOptions,
  ) {
    if (key.endsWith('.token') && ['write', 'interrupt'].includes(fault)) {
      const captured = fault;
      fault = 'none';
      recordAcceptance(
        captured === 'write'
          ? 'Injected token-write rejection after real protected pending marker.'
          : 'Paused before token write after real protected pending marker. Force-stop now.',
      );
      if (captured === 'write') throw new Error('Acceptance write rejection');
      // Deliberately remains pending until process death; the real adapter's
      // deadline and single-flight quarantine continue to apply.
      return await new Promise<void>(() => {});
    }
    return storageOperation(`write ${keyLabel(key)}`, () =>
      RealSecureStore.setItemAsync(key, value, options),
    );
  },
  async deleteItemAsync(
    key: string,
    options?: RealSecureStore.SecureStoreOptions,
  ) {
    if (key.endsWith('.token') && fault === 'delete') {
      fault = 'none';
      recordAcceptance(
        'Injected token-delete rejection after real protected marker.',
      );
      throw new Error('Acceptance delete rejection');
    }
    return storageOperation(`delete ${keyLabel(key)}`, () =>
      RealSecureStore.deleteItemAsync(key, options),
    );
  },
};
