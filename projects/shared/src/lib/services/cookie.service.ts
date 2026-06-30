import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

export type CookieSameSite = 'Strict' | 'Lax' | 'None';

export type CookieOptions = {
  path?: string;
  domain?: string;
  expires?: Date;
  maxAgeSeconds?: number;
  secure?: boolean;
  sameSite?: CookieSameSite;
};

@Injectable({ providedIn: 'root' })
export class CookieService {
  private readonly document = inject(DOCUMENT);

  get(name: string): string | null {
    const prefix = `${encodeURIComponent(name)}=`;
    const cookies = (this.document.cookie || '').split(';');
    for (const cookie of cookies) {
      const value = cookie.trim();
      if (value.startsWith(prefix)) {
        return decodeURIComponent(value.slice(prefix.length));
      }
    }
    return null;
  }

  getJson<T>(name: string): T | null {
    const raw = this.get(name);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      this.delete(name);
      return null;
    }
  }

  has(name: string): boolean {
    return this.get(name) !== null;
  }

  set(name: string, value: string, options: CookieOptions = {}): void {
    const parts = [
      `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
      `Path=${options.path || '/'}`,
      `SameSite=${options.sameSite || 'Lax'}`,
    ];
    if (options.domain) parts.push(`Domain=${options.domain}`);
    if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
    if (options.maxAgeSeconds != null) {
      parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`);
    }
    if (options.secure) parts.push('Secure');
    this.document.cookie = parts.join('; ');
  }

  setJson(name: string, value: unknown, options: CookieOptions = {}): void {
    this.set(name, JSON.stringify(value), options);
  }

  delete(name: string, options: Pick<CookieOptions, 'path' | 'domain'> = {}): void {
    this.set(name, '', {
      path: options.path || '/',
      domain: options.domain,
      expires: new Date(0),
      maxAgeSeconds: 0,
    });
  }
}
