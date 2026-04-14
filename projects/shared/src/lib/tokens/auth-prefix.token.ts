import { InjectionToken } from '@angular/core';

/**
 * Per-portal localStorage key prefix.
 * Each app provides its own value in app.config.ts so sessions are fully isolated.
 *
 * Storage keys become: `{prefix}_access_token`, `{prefix}_user`, etc.
 *
 * Example:
 *   { provide: AUTH_PREFIX, useValue: 'admin' }  → 'admin_access_token'
 *   { provide: AUTH_PREFIX, useValue: 'vendor' } → 'vendor_access_token'
 */
export const AUTH_PREFIX = new InjectionToken<string>('AUTH_PREFIX', {
  factory: () => 'app' // safe fallback
});
