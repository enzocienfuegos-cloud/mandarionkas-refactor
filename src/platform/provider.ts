export type PlatformLoginResult = { ok: boolean; message?: string };

export interface PlatformAuthProvider {
  login(email: string, password: string, options?: { remember?: boolean }): Promise<PlatformLoginResult>;
  logout(): Promise<void>;
}
