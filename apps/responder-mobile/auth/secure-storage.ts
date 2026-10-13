import * as SecureStore from 'expo-secure-store';
import type { StaffSecureStorage } from '@myims/contracts';
// Separate protected marker prevents adoption after interrupted replacement/deletion.
const namespace = 'myims.responder.staff.v1';
const options: SecureStore.SecureStoreOptions = {
  keychainService: namespace,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  requireAuthentication: true,
  authenticationPrompt: 'Unlock MyIMS staff access',
};
const tokenKey = `${namespace}.token`,
  markerKey = `${namespace}.pending`;
let flight: Promise<unknown> | null = null;
async function bounded<T>(operation: () => Promise<T>): Promise<T> {
  if (flight) throw new Error('Storage busy');
  const task = operation();
  flight = task;
  void task
    .finally(() => {
      if (flight === task) flight = null;
    })
    .catch(() => {});
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Storage unavailable')),
          15000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const get = (key: string) => SecureStore.getItemAsync(key, options);
const remove = (key: string) => SecureStore.deleteItemAsync(key, options);
export const staffSecureStorage: StaffSecureStorage & {
  readForRevocation: StaffSecureStorage['read'];
} = {
  async readForRevocation() {
    try {
      return await bounded(async () => {
        const token = await get(tokenKey);
        return token === null
          ? { kind: 'absent' }
          : /^[A-Za-z0-9_-]{43}$/.test(token)
            ? { kind: 'found', token }
            : { kind: 'unavailable' };
      });
    } catch {
      return { kind: 'unavailable' };
    }
  },
  async save(token) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return 'failed';
    try {
      return await bounded(async () => {
        if (!(await SecureStore.isAvailableAsync())) return 'failed';
        await SecureStore.setItemAsync(markerKey, 'pending', options);
        await SecureStore.setItemAsync(tokenKey, token, options);
        if ((await get(tokenKey)) !== token) return 'uncertain';
        await remove(markerKey);
        return (await get(markerKey)) === null ? 'stored' : 'uncertain';
      });
    } catch {
      return 'uncertain';
    }
  },
  async read() {
    try {
      return await bounded(async () => {
        if (
          !(await SecureStore.isAvailableAsync()) ||
          (await get(markerKey)) !== null
        )
          return { kind: 'unavailable' };
        const token = await get(tokenKey);
        if (token === null) return { kind: 'absent' };
        return /^[A-Za-z0-9_-]{43}$/.test(token)
          ? { kind: 'found', token }
          : { kind: 'unavailable' };
      });
    } catch {
      return { kind: 'unavailable' };
    }
  },
  async clear() {
    try {
      return await bounded(async () => {
        await SecureStore.setItemAsync(markerKey, 'pending', options);
        await remove(tokenKey);
        if ((await get(tokenKey)) !== null) return 'uncertain';
        await remove(markerKey);
        return (await get(markerKey)) === null ? 'cleared' : 'uncertain';
      });
    } catch {
      return 'uncertain';
    }
  },
};
