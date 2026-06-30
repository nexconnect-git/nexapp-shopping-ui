import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, Observable, of, shareReplay, tap } from 'rxjs';
import { AuthApi } from '../api/auth-api.service';
import { AuthResponse, User } from '../models';
import { AUTH_PREFIX } from '../tokens/auth-prefix.token';
import { CurrencyService } from './currency.service';
import { NativePlatformService } from './native-platform.service';
import { SessionStore } from './session-store.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly prefix = inject(AUTH_PREFIX);
  private readonly expectedRoleByPrefix: Record<string, User['role']> = {
    customer: 'customer',
    vendor: 'vendor',
    delivery: 'delivery',
    admin: 'admin',
  };
  private readonly currentUser = signal<User | null>(null);
  private readonly accessToken = signal<string | null>(null);
  private readonly session = inject(SessionStore);
  private refreshRequest$?: Observable<boolean>;

  readonly user = this.currentUser.asReadonly();
  readonly isLoggedIn = computed(
    () => !!this.currentUser() && !!this.accessToken(),
  );

  get tokenKey() {
    return `${this.prefix}_access_token`;
  }
  get refreshTokenKey() {
    return `${this.prefix}_refresh_token`;
  }
  get userKey() {
    return `${this.prefix}_user`;
  }
  get refreshSessionKey() {
    return `${this.prefix}_refresh_session`;
  }
  get vendorKey() {
    return `${this.prefix}_vendor_status`;
  }

  private get expectedRole(): User['role'] | null {
    return this.expectedRoleByPrefix[this.prefix] || null;
  }

  private isPortalUser(user: User | null | undefined): boolean {
    if (!user) return false;
    if (!this.expectedRole) return true;
    return user.role === this.expectedRole;
  }

  constructor(
    private api: AuthApi,
    private router: Router,
    private currency: CurrencyService,
    private nativePlatform: NativePlatformService,
  ) {
    this.loadSession();
  }

  private loadSession() {
    this.session.migrateLegacySession();
    const token = this.session.getAccessToken();
    const userData = this.session.getUserRaw();

    if (token) {
      this.accessToken.set(token);
      this.session.setAccessToken(token);
    }

    if (token && !userData) {
      this.clearSession();
      return;
    }

    if (userData && token) {
      try {
        const user = JSON.parse(userData) as User;
        if (!this.isPortalUser(user)) {
          this.clearSession();
          return;
        }
        this.currentUser.set(user);
        this.currency.configureFromLocation(user);
      } catch {
        this.session.clearUser();
      }
    }

    this.session.setRefreshToken(null);

    if (!token && (userData || this.session.hasRefreshSession())) {
      this.refreshAccessToken().subscribe({ error: () => this.clearSession() });
    }
  }

  private setAccessToken(token: string | null) {
    this.accessToken.set(token);
    this.session.setAccessToken(token);
  }

  getToken(): string | null {
    return this.accessToken();
  }

  getRefreshToken(): string | null {
    return this.session.getRefreshToken();
  }

  async setTokens(tokens: {
    access?: string | null;
    refresh?: string | null;
  }): Promise<void> {
    if (tokens.access !== undefined) this.setAccessToken(tokens.access);
    if (tokens.refresh !== undefined) {
      this.session.setRefreshToken(tokens.refresh);
    }
  }

  login(username: string, password: string) {
    return this.api.login({ username, password });
  }

  requestCustomerLoginOtp(phone: string, email?: string) {
    return this.api.requestCustomerLoginOtp({ phone, email: email || '' });
  }

  verifyCustomerLoginOtp(phone: string, otp: string, email?: string) {
    return this.api.verifyCustomerLoginOtp({ phone, otp, email: email || '' });
  }

  register(data: any) {
    return this.api.register(data);
  }

  requestCustomerRegisterOtp(phone: string, email?: string) {
    return this.api.requestCustomerRegisterOtp({ phone, email: email || '' });
  }

  verifyCustomerRegisterOtp(data: {
    phone: string;
    otp: string;
    first_name: string;
    last_name?: string;
    email?: string;
  }) {
    return this.api.verifyCustomerRegisterOtp(data);
  }

  handleAuthResponse(response: AuthResponse): boolean {
    if (!this.isPortalUser(response.user)) {
      this.clearSession();
      return false;
    }

    this.setAccessToken(response.tokens.access);
    this.session.setUser(response.user);
    this.session.markRefreshSession();
    this.currentUser.set(response.user);
    this.currency.configureFromLocation(response.user);
    return true;
  }

  refreshAccessToken(): Observable<boolean> {
    if (this.refreshRequest$) {
      return this.refreshRequest$;
    }

    this.refreshRequest$ = this.api.refreshToken().pipe(
      tap((response) => {
        const tokens = response.tokens || response;
        this.setAccessToken(tokens.access);
        this.session.setRefreshToken(tokens.refresh || null);
        this.session.markRefreshSession();
        if (response.user) {
          if (!this.isPortalUser(response.user as User)) {
            this.clearSession();
            throw new Error('Portal role mismatch');
          }
          this.session.setUser(response.user);
          this.currentUser.set(response.user);
          this.currency.configureFromLocation(response.user);
        }
      }),
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
    void this.nativePlatform.registerForPushNotifications().then((registration) => {
      if (!registration) return;
      this.api.registerDeviceToken(registration).subscribe({ error: () => {} });
    });
  }

  private clearSession() {
    this.session.clear();
    this.accessToken.set(null);
    this.currentUser.set(null);
    this.currency.resetToDefault();
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

  clearInvalidSession() {
    this.clearSession();
  }

  getRole(): string {
    return this.currentUser()?.role || '';
  }

  isSuperUser(): boolean {
    return !!(this.currentUser() as any)?.is_superuser;
  }

  updateUserData(user: User) {
    if (!this.isPortalUser(user)) {
      this.clearSession();
      return;
    }
    this.session.setUser(user);
    this.currentUser.set(user);
    this.currency.configureFromLocation(user);
  }
}
