import type { PlatformAuthProvider } from '../provider';
import { login, logout } from '../auth-service';

export const apiAuthProvider: PlatformAuthProvider = {
  async login(email, password, options) {
    return login(email, password, options);
  },
  async logout() {
    await logout();
  },
};
