import { beforeAll, beforeEach } from 'vitest';
import { registerBuiltins } from '../widgets/registry/register-builtins';

type StorageRecord = Record<string, string>;

function createMemoryStorage() {
  let store: StorageRecord = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    clear() {
      store = {};
    },
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null;
    },
    removeItem(key: string) {
      delete store[key];
    },
    setItem(key: string, value: string) {
      store[key] = String(value);
    },
  } satisfies Storage;
}

const localStorageMock = createMemoryStorage();
const sessionStorageMock = createMemoryStorage();

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    configurable: true,
    writable: true,
  });
}

if (typeof globalThis.sessionStorage === 'undefined') {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: sessionStorageMock,
    configurable: true,
    writable: true,
  });
}

if (typeof globalThis.window === 'undefined') {
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage },
    configurable: true,
    writable: true,
  });
} else {
  if (!('localStorage' in globalThis.window)) {
    Object.defineProperty(globalThis.window, 'localStorage', {
      value: globalThis.localStorage,
      configurable: true,
      writable: true,
    });
  }
  if (!('sessionStorage' in globalThis.window)) {
    Object.defineProperty(globalThis.window, 'sessionStorage', {
      value: globalThis.sessionStorage,
      configurable: true,
      writable: true,
    });
  }
}

beforeAll(() => {
  registerBuiltins();
});

beforeEach(() => {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
});
