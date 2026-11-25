import { invoke } from "@tauri-apps/api/core";

export type LoginResult = {
  ok: boolean;
  code?: string;
  message?: string;
  expiresAt?: string;
  user?: { email: string; name: string; role: string };
};

export function login(email: string, password: string, twoFactorCode?: string) {
  return invoke<LoginResult>("login", { email, password, twoFactorCode: twoFactorCode || null });
}

export function logout() {
  return invoke<void>("logout");
}

export function hasSession() {
  return invoke<boolean>("has_session");
}

export function apiGet<T>(path: string) {
  return invoke<T>("api_get", { path });
}

export function apiPost<T>(path: string, body: unknown) {
  return invoke<T>("api_post", { path, body });
}
