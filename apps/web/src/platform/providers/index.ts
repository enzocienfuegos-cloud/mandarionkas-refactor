import type { PlatformAuthProvider } from '../provider';
import { apiAuthProvider } from './api-auth-provider';

export function getPlatformAuthProvider(): PlatformAuthProvider {
  return apiAuthProvider;
}
