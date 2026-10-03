import { inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, Observable, of, shareReplay, tap } from 'rxjs';
import { ApiService, AuthService } from '@shared/public-api';
import { AdminIdentity } from '@shared/lib/models/admin-console';

import { firstAccessibleAdminRoute, permissionForRoute } from './admin-policy';
export { permissionForRoute } from './admin-policy';

@Injectable({ providedIn: 'root' })
export class AdminAccessService {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  identity = signal<AdminIdentity | null>(null);
  private loadedUser = '';
  private pending?: Observable<AdminIdentity | null>;

  load(force = false): Observable<AdminIdentity | null> {
    const id = this.auth.user()?.id ?? '';
    if (!id) { this.identity.set(null); this.loadedUser = ''; return of(null); }
    if (!force && this.loadedUser === id && this.identity()) return of(this.identity());
    if (this.pending && this.loadedUser===id) return this.pending;
    this.loadedUser=id;
    this.pending = this.api.getAdminAccess().pipe(
      tap(value => { if(this.auth.user()?.id===id){this.identity.set(value); this.loadedUser = id;} }),
      catchError(() => { this.identity.set(null); return of(null); }),
      finalize(() => { this.pending = undefined; }), shareReplay({ bufferSize: 1, refCount: true }),
    );
    return this.pending;
  }
  can(permission: string | null): boolean {
    if (!this.auth.isLoggedIn() || this.auth.user()?.role !== 'admin') return false;
    if (this.auth.isSuperUser()) return true;
    if (!permission) return true;
    const identity = this.identity();
    return !!identity && this.loadedUser===this.auth.user()?.id && (identity.permissions.includes(permission) || (permission.endsWith('.view') && identity.permissions.includes(permission.replace('.view', '.manage'))));
  }
  canRoute(url: string): boolean { return this.can(permissionForRoute(url)); }
  landingRoute(): string { return firstAccessibleAdminRoute(route => this.canRoute(route)); }
}
