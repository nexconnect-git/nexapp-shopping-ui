import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, Observable, of, shareReplay, tap } from 'rxjs';
import { ApiService } from './api.service';
import { AuthResponse, User } from '../models';
import { AUTH_PREFIX } from '../tokens/auth-prefix.token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly prefix = inject(AUTH_PREFIX);
  private readonly currentUser = signal<User | null>(null);
  private readonly accessToken = signal<string | null>(null);
  private refreshRequest$?: Observable<boolean>;

  readonly user = this.currentUser.asReadonly();
  readonly isLoggedIn = computed(() => !!this.currentUser() && !!this.accessToken());

  get tokenKey() { return `${this.prefix}_access_token`; }
  get userKey() { return `${this.prefix}_user`; }
  get vendorKey() { return `${this.prefix}_vendor_status`; }

  constructor(private api: ApiService, private router: Router) {
    this.loadSession();
  }

  private loadSession() {
    const token = sessionStorage.getItem(this.tokenKey);
    const userData = sessionStorage.getItem(this.userKey);

    if (token) {
      this.accessToken.set(token);
    }

    if (userData) {
      try {
        this.currentUser.set(JSON.parse(userData));
      } catch {
        sessionStorage.removeItem(this.userKey);
      }
    }
  }

  private setAccessToken(token: string | null) {
    this.accessToken.set(token);
    if (token) {
      sessionStorage.setItem(this.tokenKey, token);
    } else {
      sessionStorage.removeItem(this.tokenKey);
    }
  }

  getToken(): string | null {
    return this.accessToken();
  }

  login(username: string, password: string) {
    return this.api.login({ username, password });
  }

  requestCustomerLoginOtp(phone: string) {
    return this.api.requestCustomerLoginOtp({ phone });
  }

  verifyCustomerLoginOtp(phone: string, otp: string) {
    return this.api.verifyCustomerLoginOtp({ phone, otp });
  }

  register(data: any) {
    return this.api.register(data);
  }

  requestCustomerRegisterOtp(phone: string) {
    return this.api.requestCustomerRegisterOtp({ phone });
  }

  verifyCustomerRegisterOtp(data: { phone: string; otp: string; first_name: string; last_name?: string; email?: string }) {
    return this.api.verifyCustomerRegisterOtp(data);
  }

  handleAuthResponse(response: AuthResponse) {
    this.setAccessToken(response.tokens.access);
    sessionStorage.setItem(this.userKey, JSON.stringify(response.user));
    this.currentUser.set(response.user);
    this.initializePushNotifications();
  }

  refreshAccessToken(): Observable<boolean> {
    if (this.refreshRequest$) {
      return this.refreshRequest$;
    }

    this.refreshRequest$ = this.api.refreshToken().pipe(
      tap((response) => this.setAccessToken(response.tokens.access)),
      map(() => true),
      catchError(() => {
        this.clearSession();
        return of(false);
      }),
      tap(() => {
        this.refreshRequest$ = undefined;
      }),
      shareReplay(1),
    );

    return this.refreshRequest$;
  }

  private initializePushNotifications() {
    // Web push registration is intentionally disabled until a real service-worker
    // + Firebase/Web Push flow is wired in. Registering fake tokens pollutes the
    // device token store and creates false positives in production.
  }

  private clearSession() {
    sessionStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.userKey);
    localStorage.removeItem(this.vendorKey);
    this.accessToken.set(null);
    this.currentUser.set(null);
  }

  logout(redirectToLogin = true) {
    if (this.accessToken()) {
      this.api.logout().subscribe({ error: () => {} });
    }
    this.clearSession();
    if (redirectToLogin) {
      this.router.navigate(['/login']);
    }
  }

  getRole(): string {
    return this.currentUser()?.role || '';
  }

  isSuperUser(): boolean {
    return !!(this.currentUser() as any)?.is_superuser;
  }

  updateUserData(user: User) {
    sessionStorage.setItem(this.userKey, JSON.stringify(user));
    this.currentUser.set(user);
  }
}
