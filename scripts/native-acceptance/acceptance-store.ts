// Copied only into the isolated acceptance app; never imported by responder-mobile.
import * as RealSecureStore from 'expo-secure-store';

export type StorageFault = 'none' | 'write' | 'delete' | 'interrupt';
let fault: StorageFault = 'none';
let changed: ((message: string) => void) | undefined;
export function observeFault(listener: (message: string) => void) {
  changed = listener;
  return () => {
    if (changed === listener) changed = undefined;
  };
}
export function armFault(next: StorageFault) {
  fault = next;
  changed?.(`Armed: ${next}. No operation has run yet.`);
}
export const SecureStore = {
  ...RealSecureStore,
  async setItemAsync(
    key: string,
    value: string,
    options?: RealSecureStore.SecureStoreOptions,
  ) {
    if (key.endsWith('.token') && ['write', 'interrupt'].includes(fault)) {
      const captured = fault;
      fault = 'none';
      changed?.(
        captured === 'write'
          ? 'Injected token-write rejection after real protected pending marker.'
          : 'Paused before token write after real protected pending marker. Force-stop now.',
      );
      if (captured === 'write') throw new Error('Acceptance write rejection');
      // Deliberately remains pending until process death; the real adapter's
      // deadline and single-flight quarantine continue to apply.
      return await new Promise<void>(() => {});
    }
    return RealSecureStore.setItemAsync(key, value, options);
  },
  async deleteItemAsync(
    key: string,
    options?: RealSecureStore.SecureStoreOptions,
  ) {
    if (key.endsWith('.token') && fault === 'delete') {
      fault = 'none';
      changed?.('Injected token-delete rejection after real protected marker.');
      throw new Error('Acceptance delete rejection');
    }
    return RealSecureStore.deleteItemAsync(key, options);
  },
};
