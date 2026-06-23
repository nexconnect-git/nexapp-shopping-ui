import { inject, Injectable } from '@angular/core';
import { AUTH_PREFIX } from '../tokens/auth-prefix.token';

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly prefix = inject(AUTH_PREFIX);

  get tokenKey(): string {
    return `${this.prefix}_access_token`;
  }

  get refreshTokenKey(): string {
    return `${this.prefix}_refresh_token`;
  }

  get userKey(): string {
    return `${this.prefix}_user`;
  }

  get refreshSessionKey(): string {
    return `${this.prefix}_refresh_session`;
  }

  get vendorStatusKey(): string {
    return `${this.prefix}_vendor_status`;
  }

  migrateLegacySession(): void {
    if (this.prefix !== 'customer') return;
    const legacyToken = localStorage.getItem('nextou_token');
    if (!legacyToken || this.getAccessToken()) return;
    this.setAccessToken(legacyToken);
    localStorage.removeItem('nextou_token');
  }

  getAccessToken(): string | null {
    return (
      sessionStorage.getItem(this.tokenKey) ||
      localStorage.getItem(this.tokenKey)
    );
  }

  setAccessToken(token: string | null): void {
    if (token) {
      sessionStorage.setItem(this.tokenKey, token);
      localStorage.setItem(this.tokenKey, token);
      return;
    }
    sessionStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.tokenKey);
  }

  getRefreshToken(): string | null {
    return (
      sessionStorage.getItem(this.refreshTokenKey) ||
      localStorage.getItem(this.refreshTokenKey)
    );
  }

  setRefreshToken(token: string | null): void {
    if (token) {
      sessionStorage.setItem(this.refreshTokenKey, token);
      localStorage.setItem(this.refreshTokenKey, token);
      return;
    }
    sessionStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
  }

  getUserRaw(): string | null {
    return (
      sessionStorage.getItem(this.userKey) || localStorage.getItem(this.userKey)
    );
  }

  getUser<T = unknown>(): T | null {
    const raw = this.getUserRaw();
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      this.clearUser();
      return null;
    }
  }

  getCurrentUser<T = unknown>(): T | null {
    return this.getUser<T>();
  }

  setUser(user: unknown): void {
    const raw = JSON.stringify(user);
    sessionStorage.setItem(this.userKey, raw);
    localStorage.setItem(this.userKey, raw);
  }

  setCurrentUser(user: unknown): void {
    this.setUser(user);
  }

  clearUser(): void {
    sessionStorage.removeItem(this.userKey);
    localStorage.removeItem(this.userKey);
  }

  clearCurrentUser(): void {
    this.clearUser();
  }

  getRole(): string {
    return this.getUser<{ role?: string }>()?.role || '';
  }

  markRefreshSession(): void {
    localStorage.setItem(this.refreshSessionKey, '1');
  }

  hasRefreshSession(): boolean {
    return localStorage.getItem(this.refreshSessionKey) === '1';
  }

  clearRefreshState(): void {
    this.setRefreshToken(null);
    localStorage.removeItem(this.refreshSessionKey);
  }

  setVendorStatus(status: string): void {
    localStorage.setItem(this.vendorStatusKey, status);
  }

  getVendorStatus(): string {
    return localStorage.getItem(this.vendorStatusKey) || '';
  }

  clearVendorStatus(): void {
    localStorage.removeItem(this.vendorStatusKey);
  }

  clear(): void {
    this.setAccessToken(null);
    this.clearUser();
    this.clearRefreshState();
    this.clearVendorStatus();
  }
}
