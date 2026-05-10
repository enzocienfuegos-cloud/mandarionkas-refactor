import type { PlatformAuthProvider } from '../provider';
import { login as loginLocal, logout as logoutLocal } from '../auth-service';

export const demoAuthProvider: PlatformAuthProvider = {
  mode: 'demo',
  async login(email, password, options) {
    return loginLocal(email, password, options);
  },
  async logout() {
    logoutLocal();
  },
};
